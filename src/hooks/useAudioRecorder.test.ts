import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

/**
 * A `MediaRecorder` stand-in. jsdom has none, and the point of these tests is
 * the lifecycle around it — in particular that the media stream is released on
 * every path out, because a track left running keeps the browser's recording
 * indicator lit and reads as the page still listening.
 */
class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static supported = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  static isTypeSupported = (type: string) => FakeMediaRecorder.supported.includes(type);

  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  // Plain fields rather than parameter properties: `erasableSyntaxOnly` is on,
  // and parameter properties are the one class syntax that is not type-only.
  stream: MediaStream;
  options?: { mimeType?: string };

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this.stream = stream;
    this.options = options;
    FakeMediaRecorder.instances.push(this);
  }

  get mimeType() {
    return this.options?.mimeType ?? '';
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

/** Tracks that record whether they were stopped. */
function fakeStream() {
  const tracks = [
    {
      stopped: false,
      stop() {
        this.stopped = true;
      },
    },
  ];
  return {
    stream: { getTracks: () => tracks } as unknown as MediaStream,
    tracks,
  };
}

let media: ReturnType<typeof fakeStream>;
let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.supported = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  media = fakeStream();
  getUserMedia = vi.fn().mockResolvedValue(media.stream);

  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('useAudioRecorder', () => {
  it('reports support only when both APIs exist', () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.isSupported).toBe(true);
  });

  it('picks the first supported container, best first', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());
    expect(FakeMediaRecorder.instances[0].options?.mimeType).toBe(
      'audio/webm;codecs=opus',
    );
  });

  it('falls back to audio/mp4 where only Safari’s container is supported', async () => {
    FakeMediaRecorder.supported = ['audio/mp4'];
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());
    expect(FakeMediaRecorder.instances[0].options?.mimeType).toBe('audio/mp4');
  });

  it('records, hands back a blob, and releases the stream', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());
    expect(result.current.isRecording).toBe(true);
    expect(result.current.permission).toBe('granted');

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stop();
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(result.current.isRecording).toBe(false);
    expect(media.tracks.every((t) => t.stopped)).toBe(true);
  });

  it('cancel throws the audio away and still releases the stream', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());
    act(() => result.current.cancel());

    await waitFor(() => expect(result.current.isRecording).toBe(false));
    expect(media.tracks.every((t) => t.stopped)).toBe(true);
  });

  it('explains a denied microphone and does not start', async () => {
    getUserMedia.mockRejectedValue(new DOMException('nope', 'NotAllowedError'));
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());

    expect(result.current.permission).toBe('denied');
    expect(result.current.error).toMatch(/blocked/i);
    expect(result.current.isRecording).toBe(false);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it('distinguishes no microphone from a refused one', async () => {
    getUserMedia.mockRejectedValue(new DOMException('none', 'NotFoundError'));
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.start());

    expect(result.current.permission).toBe('prompt');
    expect(result.current.error).toMatch(/no microphone/i);
  });

  it('resolves stop() with null when nothing is recording', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await expect(result.current.stop()).resolves.toBeNull();
  });

  it('releases the microphone when the component unmounts mid-recording', async () => {
    const { result, unmount } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());

    unmount();

    expect(media.tracks.every((t) => t.stopped)).toBe(true);
  });

  it('tolerates a browser with no microphone permission descriptor', async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: { query: vi.fn().mockRejectedValue(new TypeError('unknown name')) },
      configurable: true,
    });
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.syncPermission());
    expect(result.current.permission).toBe('prompt');
  });

  it('reads a previously granted permission back from the Permissions API', async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
      configurable: true,
    });
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => result.current.syncPermission());
    expect(result.current.permission).toBe('granted');
  });
});
