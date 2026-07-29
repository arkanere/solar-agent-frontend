import { apiUrl } from './api';
import { parseNdjsonStream } from './stream';
import type { HistoryTurn, LeadProfile, StreamEvent } from './types';

/**
 * How many prior turns go up with each request. The server condenses them into
 * a standalone query, so this is a context/cost tradeoff rather than a limit —
 * far enough back to follow a thread, not so far that every turn re-sends the
 * whole conversation.
 */
export const HISTORY_LIMIT = 8;

export interface SendChatMessageOptions {
  userMessage: string;
  history: HistoryTurn[];
  leadProfile: LeadProfile;
  signal?: AbortSignal;
}

/**
 * Open one turn against the streaming chat endpoint.
 *
 * Resolves as soon as the response headers land — the body is consumed lazily
 * by iterating the returned generator, which is what gives the typewriter
 * effect. Throws on a non-OK response or a body-less one; an abort surfaces as
 * an `AbortError` from `fetch`, which callers treat as a user action rather
 * than a failure.
 */
export async function sendChatMessage({
  userMessage,
  history,
  leadProfile,
  signal,
}: SendChatMessageOptions): Promise<AsyncGenerator<StreamEvent, void, undefined>> {
  const response = await fetch(apiUrl('/api/chatbot'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // The server folds leadProfile into the system prompt itself, so the whole
    // profile goes up every turn — the LLM is stateless per request.
    body: JSON.stringify({
      userMessage,
      leadProfile,
      history: history.slice(-HISTORY_LIMIT),
    }),
    signal,
  });

  if (!response.ok || !response.body) throw new Error('Chatbot request failed');

  return parseNdjsonStream(response);
}

/**
 * Reduce a transcript to the `{ role, content }` pairs the server expects.
 * Failed turns are excluded — they carry an apology, not conversation.
 */
export function toHistory(
  messages: { role: 'user' | 'assistant'; content: string; error?: boolean }[],
): HistoryTurn[] {
  return messages
    .filter((m) => !m.error && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
}
