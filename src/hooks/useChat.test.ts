import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/store/chatStore';

/**
 * A response body that emits `lines` one at a time, and does not finish until
 * `close()` is called — which is what lets a test act in the middle of a stream
 * (stop, clear) rather than only before or after one.
 */
function controllableStream(lines: string[]) {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      for (const line of lines) c.enqueue(encoder.encode(`${line}\n`));
    },
  });
  const response = new Response(body);
  return {
    response,
    push: (line: string) => controller.enqueue(encoder.encode(`${line}\n`)),
    close: () => controller.close(),
    /**
     * A `fetch` stand-in that behaves like the real one under abort: it errors
     * the body stream when the signal fires. Without this the hook's read loop
     * would sit on a stream nothing ever ends, and Stop would appear to hang —
     * an artefact of the mock, not of the hook.
     */
    fetch: vi.fn((_url: string, init?: RequestInit) => {
      init?.signal?.addEventListener('abort', () => {
        controller.error(new DOMException('The operation was aborted.', 'AbortError'));
      });
      return Promise.resolve(response);
    }),
  };
}

function ndjson(...lines: string[]): Response {
  return new Response(lines.map((l) => `${l}\n`).join(''));
}

const messages = () => useChatStore.getState().messages;
const lastMessage = () => messages().at(-1)!;

beforeEach(() => {
  localStorage.clear();
  useChatStore.getState().reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.unstubAllGlobals());

describe('runChat — the happy path', () => {
  it('appends the user turn, then streams the reply into one message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          ndjson(
            '{"type":"delta","text":"Solar "}',
            '{"type":"delta","text":"saves money."}',
            '{"type":"done"}',
          ),
        ),
    );

    const { result } = renderHook(() => useChat());
    await act(async () => result.current.send('Will solar save me money?'));

    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));
    expect(messages().map((m) => m.content)).toEqual([
      expect.stringContaining('Solar Vipani assistant'),
      'Will solar save me money?',
      'Solar saves money.',
    ]);
    expect(lastMessage().role).toBe('assistant');
  });

  it('attaches metadata that arrived before the first delta', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          ndjson(
            '{"type":"intent","label":"subsidy_inquiry","stage":"consideration","confidence":0.91}',
            '{"type":"tool","name":"check_subsidies","result":{"location":"Kerala"}}',
            '{"type":"delta","text":"Up to ₹78,000."}',
            '{"type":"sources","items":[{"title":"Scheme","url":"https://x.test"}]}',
            '{"type":"usage","input":812,"output":143,"total":955,"costINR":0.42}',
            '{"type":"done"}',
          ),
        ),
    );

    const { result } = renderHook(() => useChat());
    await act(async () => result.current.send('subsidies?'));
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));

    expect(lastMessage()).toMatchObject({
      content: 'Up to ₹78,000.',
      // Buffered before the message existed…
      intent: { intent: 'subsidy_inquiry', journeyStage: 'consideration' },
      toolExecuted: 'check_subsidies',
      // …and patched on after it did.
      sources: [{ title: 'Scheme', url: 'https://x.test' }],
      usage: { total: 955, costINR: 0.42 },
    });
  });

  it('applies context updates to the lead profile immediately', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          ndjson('{"type":"context","updates":{"name":"Asha"}}', '{"type":"done"}'),
        ),
    );

    const { result } = renderHook(() => useChat());
    await act(async () => result.current.send('I am Asha'));
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));

    expect(useChatStore.getState().leadProfile.name).toBe('Asha');
  });

  it('lands a tool-only turn as an assistant message with no prose', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          ndjson(
            '{"type":"tool","name":"offer_lead_form","result":{"form":"lead_consultation"}}',
            '{"type":"done"}',
          ),
        ),
    );

    const { result } = renderHook(() => useChat());
    await act(async () => result.current.send('put me in touch'));
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));

    expect(lastMessage()).toMatchObject({
      role: 'assistant',
      content: '',
      toolExecuted: 'offer_lead_form',
    });
  });

  it('ignores `questions` and unknown event types', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          ndjson(
            '{"type":"questions","items":["May I have your name?"]}',
            '{"type":"telemetry","ms":12}',
            '{"type":"delta","text":"Sure."}',
            '{"type":"done"}',
          ),
        ),
    );

    const { result } = renderHook(() => useChat());
    await act(async () => result.current.send('hello'));
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));

    expect(lastMessage().content).toBe('Sure.');
    expect(JSON.stringify(messages())).not.toContain('May I have your name?');
  });
});

describe('runChat — failures and interruption', () => {
  it('marks a stopped turn and keeps the partial reply', async () => {
    const stream = controllableStream(['{"type":"delta","text":"Half an ans"}']);
    vi.stubGlobal('fetch', stream.fetch);

    const { result } = renderHook(() => useChat());
    act(() => result.current.send('long question'));
    await waitFor(() => expect(lastMessage().content).toBe('Half an ans'));

    act(() => result.current.stop());
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));

    expect(lastMessage()).toMatchObject({ content: 'Half an ans', stopped: true });
    expect(lastMessage().error).toBeUndefined();
  });

  it('turns an `error` event into a retryable message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(ndjson('{"type":"error","message":"model exploded"}')),
    );

    const { result } = renderHook(() => useChat());
    await act(async () => result.current.send('a question'));
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));

    expect(lastMessage()).toMatchObject({
      role: 'assistant',
      error: true,
      userMessage: 'a question',
    });
    expect(lastMessage().content).toMatch(/something went wrong/i);
  });

  it('appends the error to a partial reply rather than orphaning it', async () => {
    const stream = controllableStream(['{"type":"delta","text":"Partly answered"}']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));

    const { result } = renderHook(() => useChat());
    act(() => result.current.send('a question'));
    await waitFor(() => expect(lastMessage().content).toBe('Partly answered'));

    act(() => stream.push('{"type":"error","message":"died mid-stream"}'));
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));

    // One message, not two: the partial and the apology are the same turn.
    expect(messages()).toHaveLength(3);
    expect(lastMessage().content).toMatch(/^Partly answered/);
    expect(lastMessage()).toMatchObject({ error: true, userMessage: 'a question' });
  });

  it('produces an error message when the request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { result } = renderHook(() => useChat());
    await act(async () => result.current.send('hello'));
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));

    expect(lastMessage()).toMatchObject({ error: true, userMessage: 'hello' });
  });

  it('refuses to start a second turn while one is in flight', async () => {
    const stream = controllableStream(['{"type":"delta","text":"first"}']);
    const fetchMock = vi.fn().mockResolvedValue(stream.response);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat());
    act(() => result.current.send('one'));
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(true));

    act(() => result.current.send('two'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(messages().filter((m) => m.role === 'user')).toHaveLength(1);
  });
});

describe('retry, regenerate and reset', () => {
  it('retry drops the failed turn and resends the same question', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ndjson('{"type":"error"}'))
      .mockResolvedValueOnce(
        ndjson('{"type":"delta","text":"Second time lucky."}', '{"type":"done"}'),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat());
    await act(async () => result.current.send('a question'));
    await waitFor(() => expect(lastMessage().error).toBe(true));

    await act(async () => result.current.retry(messages().length - 1));
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));

    expect(lastMessage()).toMatchObject({ content: 'Second time lucky.' });
    expect(messages().some((m) => m.error)).toBe(false);
    // The question is not duplicated in the transcript…
    expect(messages().filter((m) => m.content === 'a question')).toHaveLength(1);
    // …nor in the history sent up, where it travels as `userMessage` instead.
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(retryBody.userMessage).toBe('a question');
    expect(retryBody.history).not.toContainEqual({
      role: 'user',
      content: 'a question',
    });
  });

  it('regenerate replaces the last reply and keeps the question above it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ndjson('{"type":"delta","text":"First answer."}', '{"type":"done"}'),
      )
      .mockResolvedValueOnce(
        ndjson('{"type":"delta","text":"Different answer."}', '{"type":"done"}'),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat());
    await act(async () => result.current.send('a question'));
    await waitFor(() => expect(lastMessage().content).toBe('First answer.'));

    await act(async () => result.current.regenerate(messages().length - 1));
    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));

    expect(messages().map((m) => m.content)).toEqual([
      expect.stringContaining('Solar Vipani assistant'),
      'a question',
      'Different answer.',
    ]);
  });

  it('reset fences off a live stream so a late chunk cannot land', async () => {
    const stream = controllableStream(['{"type":"delta","text":"Being replaced"}']);
    // Deliberately *not* `stream.fetch`: this test is about a chunk that is
    // already in the pipe and gets delivered anyway. The abort is not what
    // protects the fresh conversation — the run counter is.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));

    const { result } = renderHook(() => useChat());
    act(() => result.current.send('a question'));
    await waitFor(() => expect(lastMessage().content).toBe('Being replaced'));

    act(() => result.current.reset());
    // A chunk already in the pipe when Clear was pressed.
    act(() => {
      stream.push('{"type":"delta","text":" — too late"}');
      stream.close();
    });

    await waitFor(() => expect(useChatStore.getState().isLoading).toBe(false));
    expect(messages()).toHaveLength(1);
    expect(messages()[0].content).toContain('Solar Vipani assistant');
  });
});
