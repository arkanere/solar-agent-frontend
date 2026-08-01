import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Containers to try, best first. Opus in WebM is what the transcription model
 * handles most cheaply; `audio/mp4` is here because Safari's MediaRecorder
 * accepts nothing else, and Ogg is the last resort for older Firefox builds.
 */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

export type MicPermission = 'prompt' | 'checking' | 'granted' | 'denied';

export interface AudioRecorderApi {
  /** The browser has both getUserMedia and MediaRecorder. False hides the mic. */
  isSupported: boolean;
  isRecording: boolean;
  permission: MicPermission;
  /** Customer-facing, already phrased for display. */
  error: string | null;
  start: () => Promise<void>;
  /** Ends the recording and resolves with the audio, or null if there is none. */
  stop: () => Promise<Blob | null>;
  /** Ends the recording and throws the audio away. */
  cancel: () => void;
  /** Refresh `permission` from the Permissions API, where it exists. */
  syncPermission: () => Promise<void>;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

function detectSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

/**
 * Microphone capture for the composer.
 *
 * The `MediaRecorder`, its media stream and the collected chunks are all
 * imperative browser resources with a lifetime longer than a render, so they
 * live in refs; only what the UI draws is state. The rule the whole hook is
 * built around: **every exit path releases the stream**. A track left running
 * keeps the browser's recording indicator lit, which reads to the customer as
 * the page still listening to them.
 */
export function useAudioRecorder(): AudioRecorderApi {
  const [isSupported] = useState(detectSupport);
  const [isRecording, setIsRecording] = useState(false);
  const [permission, setPermission] = useState<MicPermission>('prompt');
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** Set by `stop`, called by the recorder's own `stop` event. */
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  /** A cancelled recording still fires `stop`; the audio is dropped on the floor. */
  const cancelledRef = useRef(false);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const finish = useCallback(
    (blob: Blob | null) => {
      releaseStream();
      recorderRef.current = null;
      chunksRef.current = [];
      setIsRecording(false);
      resolveRef.current?.(blob);
      resolveRef.current = null;
    },
    [releaseStream],
  );

  const syncPermission = useCallback(async () => {
    // Firefox has no `microphone` descriptor and throws on the query; Safari
    // gained one only recently. Either way the prompt still works, so an
    // unavailable Permissions API is not an error.
    if (typeof navigator.permissions?.query !== 'function') return;
    try {
      const status = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      setPermission(status.state === 'prompt' ? 'prompt' : status.state);
    } catch {
      /* no descriptor for microphone in this browser */
    }
  }, []);

  const start = useCallback(async () => {
    if (!isSupported || recorderRef.current) return;

    setError(null);
    setPermission('checking');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      const denied = cause instanceof DOMException && cause.name === 'NotAllowedError';
      setPermission(denied ? 'denied' : 'prompt');
      setError(
        denied
          ? 'Microphone access was blocked. Allow it in your browser settings to speak.'
          : 'No microphone was found.',
      );
      return;
    }

    streamRef.current = stream;
    setPermission('granted');
    cancelledRef.current = false;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const chunks = chunksRef.current;
      const blob =
        cancelledRef.current || chunks.length === 0
          ? null
          : new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      finish(blob);
    };

    recorder.onerror = () => {
      setError('Recording failed. Please try again.');
      cancelledRef.current = true;
      finish(null);
    };

    recorder.start();
    setIsRecording(true);
  }, [finish, isSupported]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      // Nothing running, but the stream might be if start() failed mid-way.
      releaseStream();
      return null;
    }

    return new Promise<Blob | null>((resolve) => {
      resolveRef.current = resolve;
      recorder.stop();
    });
  }, [releaseStream]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // `onstop` runs the teardown, including releasing the stream.
      recorder.stop();
      return;
    }
    finish(null);
  }, [finish]);

  // A component unmounting mid-recording must not leave the microphone open.
  useEffect(() => cancel, [cancel]);

  // Memoised so the callbacks a consumer puts in a dependency array only change
  // when something it can see has actually changed.
  return useMemo(
    () => ({
      isSupported,
      isRecording,
      permission,
      error,
      start,
      stop,
      cancel,
      syncPermission,
    }),
    [isSupported, isRecording, permission, error, start, stop, cancel, syncPermission],
  );
}
