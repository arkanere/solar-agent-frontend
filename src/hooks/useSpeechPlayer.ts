import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_VOICE, fetchSpeech, type Voice } from '@/lib/speechClient';

export interface SpeechPlayerApi {
  /** Audio is playing right now. */
  isSpeaking: boolean;
  /** The clip is being synthesised — nothing is audible yet. */
  isLoading: boolean;
  error: string | null;
  speak: (text: string, voice?: Voice) => Promise<void>;
  stop: () => void;
}

/**
 * Strip markdown down to something worth reading aloud.
 *
 * Text-to-speech pronounces syntax: `**` becomes "asterisk asterisk", a table
 * becomes a wall of pipes, and a URL is read character by character. Link text
 * is kept and the target dropped, code fences go entirely — a customer asking
 * about subsidies does not want a JSON payload read to them.
 *
 * Exported for the tests in Phase 9.
 */
export function stripMarkdown(input: string): string {
  return (
    input
      // Fenced code, then inline code. Fences first, or the closing fence's
      // backticks get eaten as inline markers.
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      // Images before links: an image is a link with a leading `!`.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Bare HTML, including the welcome message's <p> wrapper.
      .replace(/<[^>]+>/g, ' ')
      // Headings, blockquotes, list bullets and horizontal rules, at line start.
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, '')
      .replace(/^\s{0,3}([-*_])\s*(\1\s*){2,}$/gm, ' ')
      // Emphasis and strikethrough markers.
      .replace(/(\*\*\*|___)(.*?)\1/g, '$2')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      // Table pipes. The cell text is still worth hearing; the rules are not.
      .replace(/^\s*\|?[\s:|-]{4,}\|?\s*$/gm, ' ')
      .replace(/\|/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Plays assistant replies aloud through `/api/speak`.
 *
 * Two failure modes drive the shape of this hook. The first is ordering: a
 * request takes a second or two, so a reply that finishes while an earlier clip
 * is still being fetched would otherwise play second, or both at once. Every
 * call takes a ticket from `requestIdRef`, and a response holding a stale ticket
 * is discarded rather than played. The second is the stuck state: normal end,
 * playback error, synthesis failure and an explicit stop must all converge on
 * the same teardown, or the UI sits on "speaking" with nothing audible and no
 * way back.
 */
export function useSpeechPlayer(): SpeechPlayerApi {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  /** The single teardown every path lands on. Idempotent on purpose. */
  const release = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.src = '';
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  const stop = useCallback(() => {
    // Invalidating the ticket also abandons any synthesis still in flight, so a
    // clip the customer has already dismissed cannot arrive and start playing.
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    release();
  }, [release]);

  const speak = useCallback(
    async (text: string, voice: Voice = DEFAULT_VOICE) => {
      const clean = stripMarkdown(text);
      if (!clean) return;

      stop();
      const id = (requestIdRef.current += 1);
      const isCurrent = () => requestIdRef.current === id;

      const controller = new AbortController();
      controllerRef.current = controller;
      setError(null);
      setIsLoading(true);

      let blob: Blob;
      try {
        blob = await fetchSpeech(clean, voice, controller.signal);
      } catch (cause) {
        if (!isCurrent() || controller.signal.aborted) return;
        console.error('[useSpeechPlayer] synthesis failed', cause);
        setError('Could not read that reply aloud.');
        release();
        return;
      }

      if (!isCurrent()) return;

      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;

      /** Tear down *this* clip without touching whatever replaced it. */
      const discard = () => {
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        audio.src = '';
        URL.revokeObjectURL(url);
      };

      // Guarded, because a superseded clip's own `ended` or `error` event would
      // otherwise run the shared teardown over the clip now playing.
      audio.onended = () => {
        if (isCurrent()) release();
      };
      audio.onerror = () => {
        if (!isCurrent()) return;
        setError('Playback failed.');
        release();
      };

      try {
        await audio.play();
      } catch (cause) {
        if (!isCurrent()) {
          discard();
          return;
        }
        // Browsers refuse audio that no gesture asked for. That is a policy
        // decision, not a fault, and telling the customer to "try again" would
        // be wrong — the speaker toggle is the gesture that unblocks it.
        const blocked = cause instanceof DOMException && cause.name === 'NotAllowedError';
        setError(
          blocked
            ? 'Your browser blocked autoplay. Press the speaker button to hear replies.'
            : 'Playback failed.',
        );
        release();
        return;
      }

      if (!isCurrent()) {
        // A newer request landed while play() was resolving; that one wins.
        discard();
        return;
      }

      setIsLoading(false);
      setIsSpeaking(true);
    },
    [release, stop],
  );

  useEffect(() => stop, [stop]);

  return { isSpeaking, isLoading, error, speak, stop };
}
