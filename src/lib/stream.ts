import { isKnownEventType, type RawStreamEvent, type StreamEvent } from './types';

/**
 * Turn an NDJSON response body into a stream of typed events.
 *
 * The backend speaks newline-delimited JSON, not SSE — there is no `data:`
 * prefix and no blank-line record separator. Each non-empty line is one JSON
 * object.
 *
 * Two things make this less trivial than it looks:
 *
 * - Chunk boundaries do not align with newlines. A single JSON object is
 *   routinely split across two reads, so the trailing partial line has to be
 *   held in a buffer until the rest of it arrives.
 * - A malformed line must not kill an otherwise healthy stream. One unparseable
 *   line is skipped with a warning; the reply keeps streaming.
 */
export async function* parseNdjsonStream(
  response: Response,
): AsyncGenerator<StreamEvent, void, undefined> {
  if (!response.body) throw new Error('Response has no body to stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);

        const event = parseLine(line);
        if (!event) continue;
        yield event;
        // Nothing after `done` is meaningful, and the reader is released in the
        // `finally` below so the connection does not stay open behind us.
        if (event.type === 'done') return;
      }
    }

    // Flush any multi-byte character left half-decoded, then the final line.
    // A well-formed stream ends with a newline, but a last event without one
    // would otherwise be silently lost.
    buffer += decoder.decode();
    const trailing = parseLine(buffer);
    if (trailing) yield trailing;
  } finally {
    reader.cancel().catch(() => {
      // The reader is already errored or closed — nothing left to release.
    });
  }
}

/**
 * Parse one line into an event, or return null if it carries nothing usable.
 * Unrecognised `type` values are passed through rather than dropped, so the
 * backend can add events freely; the consumer ignores what it does not handle.
 */
function parseLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    console.warn('Skipping unparseable stream line:', trimmed);
    return null;
  }

  // A bare value or an object without a string `type` cannot be routed.
  if (typeof parsed !== 'object' || parsed === null) {
    console.warn('Skipping non-object stream line:', trimmed);
    return null;
  }
  const raw = parsed as RawStreamEvent;
  if (typeof raw.type !== 'string') {
    console.warn('Skipping stream event with no type:', trimmed);
    return null;
  }

  if (!isKnownEventType(raw.type)) return { type: 'unrecognised', raw };
  return raw as unknown as StreamEvent;
}
