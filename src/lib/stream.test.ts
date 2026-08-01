import { describe, expect, it, vi } from 'vitest';
import { parseNdjsonStream } from '@/lib/stream';
import type { StreamEvent } from '@/lib/types';

/**
 * A Response whose body delivers exactly these chunks, in order. The point of
 * every test here is that chunk edges are arbitrary — they do not align with
 * newlines, or even with character boundaries.
 */
function responseOf(chunks: (string | Uint8Array)[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
  return new Response(body);
}

async function collect(chunks: (string | Uint8Array)[]): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of parseNdjsonStream(responseOf(chunks))) events.push(event);
  return events;
}

/** Every one-byte-at-a-time split of a string, as chunks. */
function byteChunks(text: string): Uint8Array[] {
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes, (byte) => new Uint8Array([byte]));
}

const DELTA = '{"type":"delta","text":"Sure"}';
const DONE = '{"type":"done"}';

describe('parseNdjsonStream', () => {
  it('yields events in order from a single chunk', async () => {
    const events = await collect([`${DELTA}\n${DONE}\n`]);
    expect(events).toEqual([{ type: 'delta', text: 'Sure' }, { type: 'done' }]);
  });

  it('reassembles an object split mid-token across chunks', async () => {
    const events = await collect(['{"type":"del', 'ta","text":"Sure"}\n']);
    expect(events).toEqual([{ type: 'delta', text: 'Sure' }]);
  });

  it('splits one byte either side of a newline', async () => {
    const stream = `${DELTA}\n${DONE}\n`;
    const at = stream.indexOf('\n');
    for (const boundary of [at - 1, at, at + 1]) {
      const events = await collect([stream.slice(0, boundary), stream.slice(boundary)]);
      expect(events, `split at ${boundary}`).toEqual([
        { type: 'delta', text: 'Sure' },
        { type: 'done' },
      ]);
    }
  });

  it('survives byte-at-a-time chunking', async () => {
    const events = await collect(byteChunks(`${DELTA}\n${DONE}\n`));
    expect(events).toEqual([{ type: 'delta', text: 'Sure' }, { type: 'done' }]);
  });

  it('reassembles a multi-byte character split across chunks', async () => {
    // ₹ is three bytes in UTF-8; the split lands inside it.
    const line = '{"type":"delta","text":"₹1,25,000"}\n';
    const bytes = new TextEncoder().encode(line);
    const inside = line.indexOf('₹') + 1; // one byte into the rupee sign
    const events = await collect([bytes.slice(0, inside), bytes.slice(inside)]);
    expect(events).toEqual([{ type: 'delta', text: '₹1,25,000' }]);
  });

  it('skips a malformed line without killing the stream', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const events = await collect([`${DELTA}\nnot json at all\n${DONE}\n`]);
    expect(events).toEqual([{ type: 'delta', text: 'Sure' }, { type: 'done' }]);
    expect(warn).toHaveBeenCalled();
  });

  it('skips lines that are not objects, or carry no string type', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const events = await collect([`42\n"a string"\n{"text":"no type"}\n${DELTA}\n`]);
    expect(events).toEqual([{ type: 'delta', text: 'Sure' }]);
  });

  it('passes an unknown event type through as `unrecognised`', async () => {
    const events = await collect(['{"type":"telemetry","ms":12}\n']);
    expect(events).toEqual([
      { type: 'unrecognised', raw: { type: 'telemetry', ms: 12 } },
    ]);
  });

  it('yields a final event with no trailing newline', async () => {
    const events = await collect([`${DELTA}\n{"type":"usage","total":955}`]);
    expect(events).toEqual([
      { type: 'delta', text: 'Sure' },
      { type: 'usage', total: 955 },
    ]);
  });

  it('ignores blank and whitespace-only lines', async () => {
    const events = await collect([`\n   \n${DELTA}\n\n\t\n${DONE}\n`]);
    expect(events).toEqual([{ type: 'delta', text: 'Sure' }, { type: 'done' }]);
  });

  it('delivers nothing after `done`', async () => {
    const events = await collect([`${DONE}\n${DELTA}\n`]);
    expect(events).toEqual([{ type: 'done' }]);
  });

  it('yields nothing for an empty stream', async () => {
    expect(await collect([])).toEqual([]);
    expect(await collect([''])).toEqual([]);
  });

  it('throws when the response has no body', async () => {
    const bodyless = { body: null } as unknown as Response;
    await expect(parseNdjsonStream(bodyless).next()).rejects.toThrow('no body');
  });

  it('releases the reader when the consumer breaks out early', async () => {
    const response = responseOf([`${DELTA}\n${DELTA}\n${DONE}\n`]);
    for await (const event of parseNdjsonStream(response)) {
      expect(event).toEqual({ type: 'delta', text: 'Sure' });
      break;
    }
    // A cancelled body is what proves the `finally` ran; reading it again fails.
    expect(response.bodyUsed || response.body?.locked).toBeTruthy();
  });
});
