import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_LIMIT, sendChatMessage, toHistory } from '@/lib/chatClient';
import { EMPTY_LEAD_PROFILE, type ChatMessage, type HistoryTurn } from '@/lib/types';

function ndjsonResponse(body = '{"type":"done"}\n'): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

/** The JSON body of the most recent fetch call. */
function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string);
}

describe('sendChatMessage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(ndjsonResponse());
    vi.stubGlobal('fetch', fetchMock);
  });

  it('posts userMessage, history and the whole lead profile', async () => {
    const history: HistoryTurn[] = [{ role: 'user', content: 'Earlier question' }];
    await sendChatMessage({
      userMessage: 'What is the subsidy?',
      history,
      leadProfile: { ...EMPTY_LEAD_PROFILE, name: 'Asha', location: 'Kochi' },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/chatbot');
    expect(init.method).toBe('POST');

    const body = sentBody(fetchMock);
    expect(body.userMessage).toBe('What is the subsidy?');
    expect(body.history).toEqual(history);
    // The server folds the profile into the system prompt, so every field goes
    // up every turn — including the nulls.
    expect(Object.keys(body.leadProfile).sort()).toEqual(
      Object.keys(EMPTY_LEAD_PROFILE).sort(),
    );
    expect(body.leadProfile.name).toBe('Asha');
  });

  it('caps history at the last 8 turns, in order', async () => {
    const history: HistoryTurn[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `turn ${i}`,
    }));

    await sendChatMessage({
      userMessage: 'next',
      history,
      leadProfile: EMPTY_LEAD_PROFILE,
    });

    const sent = sentBody(fetchMock).history as HistoryTurn[];
    expect(sent).toHaveLength(HISTORY_LIMIT);
    // The *last* eight, not the first — the recent turns are the context.
    expect(sent[0].content).toBe('turn 12');
    expect(sent.at(-1)?.content).toBe('turn 19');
  });

  it('passes the abort signal through to fetch', async () => {
    const controller = new AbortController();
    await sendChatMessage({
      userMessage: 'hello',
      history: [],
      leadProfile: EMPTY_LEAD_PROFILE,
      signal: controller.signal,
    });
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('throws on a non-OK response', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    await expect(
      sendChatMessage({ userMessage: 'x', history: [], leadProfile: EMPTY_LEAD_PROFILE }),
    ).rejects.toThrow('Chatbot request failed');
  });

  it('throws when the response carries no body', async () => {
    fetchMock.mockResolvedValue({ ok: true, body: null } as Response);
    await expect(
      sendChatMessage({ userMessage: 'x', history: [], leadProfile: EMPTY_LEAD_PROFILE }),
    ).rejects.toThrow('Chatbot request failed');
  });
});

describe('toHistory', () => {
  const message = (over: Partial<ChatMessage>): ChatMessage => ({
    role: 'user',
    content: 'hello',
    timestamp: 0,
    ...over,
  });

  it('reduces messages to role and content only', () => {
    expect(
      toHistory([
        message({ role: 'user', content: 'Question' }),
        message({ role: 'assistant', content: 'Answer', usage: undefined, sources: [] }),
      ]),
    ).toEqual([
      { role: 'user', content: 'Question' },
      { role: 'assistant', content: 'Answer' },
    ]);
  });

  it('drops failed turns — they carry an apology, not conversation', () => {
    const turns = toHistory([
      message({ role: 'user', content: 'Question' }),
      message({ role: 'assistant', content: 'Sorry, it broke', error: true }),
      message({ role: 'user', content: 'Again' }),
    ]);
    expect(turns.map((t) => t.content)).toEqual(['Question', 'Again']);
  });

  it('drops empty and whitespace-only turns', () => {
    const turns = toHistory([
      message({ content: '' }),
      message({ content: '   \n ' }),
      message({ content: 'Real' }),
    ]);
    expect(turns).toEqual([{ role: 'user', content: 'Real' }]);
  });
});
