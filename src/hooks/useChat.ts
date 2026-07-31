import { useCallback, useRef } from 'react';
import { sendChatMessage, toHistory } from '@/lib/chatClient';
import { useChatStore } from '@/store/chatStore';
import type { ChatMessage, HistoryTurn } from '@/lib/types';

/** Shown when a turn fails outright. Deliberately plain — the customer cannot
 * act on a stack trace, and Retry is right beside it. */
const ERROR_TEXT =
  'Sorry — something went wrong reaching the assistant. Please try again.';

export interface RunChatOptions {
  /**
   * Whether `text` should be appended to the transcript as a user turn. False
   * for retry and regenerate, where the user's message is already on screen and
   * only the reply is being produced again.
   */
  appendUser?: boolean;
}

/**
 * The history to send with a turn.
 *
 * `text` always travels separately as `userMessage`, so when it is already in
 * the transcript (retry, regenerate) the trailing user turn has to come off the
 * snapshot or the server sees the same question twice.
 */
function historyFor(messages: ChatMessage[], appendUser: boolean): HistoryTurn[] {
  const turns = toHistory(messages);
  if (appendUser) return turns;
  return turns.at(-1)?.role === 'user' ? turns.slice(0, -1) : turns;
}

/**
 * Owns one conversation turn end to end: the request, the streaming loop, and
 * every way a turn can finish — completed, stopped, or failed.
 *
 * State lives in the store, so this hook holds only what a render must never
 * see: the in-flight `AbortController` and a run counter used to fence off a
 * cancelled turn's late writes.
 */
export function useChat() {
  const abortRef = useRef<AbortController | null>(null);
  /**
   * Bumped whenever a turn's output must be thrown away rather than landed —
   * currently only by `reset`. A stop keeps its partial reply, so it does not
   * bump; the abort still unwinds the loop, but the handler below recognises
   * the run as current and marks the message `stopped`.
   */
  const runIdRef = useRef(0);

  const runChat = useCallback(
    async (text: string, { appendUser = true }: RunChatOptions = {}) => {
      const store = useChatStore.getState();
      if (store.isLoading) return;

      // Snapshot before appending: the current message goes up as `userMessage`,
      // and history is what came before it.
      const history = historyFor(store.messages, appendUser);
      const leadProfile = store.leadProfile;

      if (appendUser) {
        store.appendMessage({ role: 'user', content: text, timestamp: Date.now() });
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const runId = runIdRef.current;
      const isCurrent = () => runIdRef.current === runId;

      store.setLoading(true);
      store.setStreaming(false);

      /**
       * `intent`, `context`, `tool` and `questions` can all arrive before the
       * first `delta`, when there is no assistant message to hang them on yet.
       * They accumulate here and are applied the moment the message exists, or
       * flushed onto an empty one at stream end if no delta ever came — a
       * tool-only turn is a real outcome and must not vanish.
       */
      let started = false;
      let content = '';
      const buffered: Partial<ChatMessage> = {};

      const applyMeta = (patch: Partial<ChatMessage>) => {
        if (started) useChatStore.getState().patchLastMessage(patch);
        else Object.assign(buffered, patch);
      };

      try {
        const events = await sendChatMessage({
          userMessage: text,
          history,
          leadProfile,
          signal: controller.signal,
        });

        for await (const event of events) {
          if (!isCurrent()) return;

          switch (event.type) {
            case 'delta': {
              content += event.text;
              if (started) {
                useChatStore.getState().patchLastMessage({ content });
              } else {
                started = true;
                useChatStore.getState().setStreaming(true);
                useChatStore.getState().appendMessage({
                  role: 'assistant',
                  content,
                  timestamp: Date.now(),
                  ...buffered,
                });
              }
              break;
            }

            case 'intent':
              applyMeta({
                intent: {
                  intent: event.label,
                  journeyStage: event.stage,
                  confidence: event.confidence,
                },
              });
              break;

            case 'context':
              // Profile state, not message metadata — it outlives this turn.
              useChatStore.getState().applyContextUpdates(event.updates);
              break;

            case 'tool':
              applyMeta({ toolExecuted: event.name, toolResult: event.result });
              break;

            case 'sources':
              applyMeta({ sources: event.items });
              break;

            case 'usage':
              applyMeta({
                usage: {
                  input: event.input,
                  output: event.output,
                  total: event.total,
                  costINR: event.costINR,
                },
              });
              break;

            case 'error':
              throw new Error(event.message ?? 'The assistant reported an error');

            // `questions` is dropped on purpose. Those are slot-filling prompts
            // for the assistant to put to the customer ("May I have your name?");
            // surfacing them as suggested questions hands the customer our own
            // prompts to ask us. `workflow` and `unrecognised` are not rendered.
            case 'questions':
            case 'workflow':
            case 'done':
            case 'unrecognised':
              break;
          }
        }

        if (!isCurrent()) return;

        // No delta ever arrived but the turn still produced something.
        if (!started && Object.keys(buffered).length > 0) {
          useChatStore
            .getState()
            .appendMessage({
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
              ...buffered,
            });
        }
      } catch (error) {
        if (!isCurrent()) return;

        // An abort is the customer pressing Stop, not a failure: keep whatever
        // arrived and label it.
        if (controller.signal.aborted) {
          if (started) useChatStore.getState().patchLastMessage({ stopped: true });
          return;
        }

        console.error('[useChat] turn failed', error);
        const failure = {
          content: content ? `${content}\n\n${ERROR_TEXT}` : ERROR_TEXT,
          error: true,
          // Retry resends this rather than re-reading the transcript, which by
          // then has the failed reply in it.
          userMessage: text,
        };
        if (started) useChatStore.getState().patchLastMessage(failure);
        else
          useChatStore
            .getState()
            .appendMessage({ role: 'assistant', timestamp: Date.now(), ...failure });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        if (isCurrent()) {
          useChatStore.getState().setLoading(false);
          useChatStore.getState().setStreaming(false);
        }
      }
    },
    [],
  );

  const send = useCallback((text: string) => void runChat(text), [runChat]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Re-ask the question that failed, after dropping the failed reply. */
  const retry = useCallback(
    (index: number) => {
      const { messages, removeMessageAt } = useChatStore.getState();
      const failed = messages[index];
      if (!failed) return;

      const question = failed.userMessage ?? findPrecedingUserMessage(messages, index);
      if (!question) return;

      removeMessageAt(index);
      void runChat(question, { appendUser: false });
    },
    [runChat],
  );

  /** Answer the same question again, replacing the reply at `index`. */
  const regenerate = useCallback(
    (index: number) => {
      const { messages, truncateFrom } = useChatStore.getState();
      const question = findPrecedingUserMessage(messages, index);
      if (!question) return;

      truncateFrom(index);
      void runChat(question, { appendUser: false });
    },
    [runChat],
  );

  /**
   * Start over. The in-flight turn is aborted *and* fenced off by the run
   * counter, so a chunk already in the pipe cannot write itself into the fresh
   * conversation. Phase 6 adds stopping the recorder and any playback here.
   */
  const reset = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    useChatStore.getState().reset();
  }, []);

  return { send, stop, retry, regenerate, reset };
}

/** The customer's question that a reply at `index` was answering. */
function findPrecedingUserMessage(messages: ChatMessage[], index: number): string | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return null;
}
