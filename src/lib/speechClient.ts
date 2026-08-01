import { apiUrl } from './api';

/** The voices `/api/speak` accepts. Anything else is a 422 from the server. */
export type Voice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export const DEFAULT_VOICE: Voice = 'alloy';

/**
 * The transcription upload ceiling. It is OpenAI's limit rather than the
 * backend's choice, so it will not move — checking here turns a 400 halfway
 * through an upload into an immediate, explainable refusal.
 */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * The recorder hands back whatever container the browser agreed to produce, and
 * the transcription model keys off the filename extension as well as the MIME
 * type. Sending `audio.webm` for an mp4 blob is a rejected upload, so the name
 * has to follow the blob.
 */
function fileNameFor(type: string): string {
  if (type.includes('mp4') || type.includes('m4a')) return 'audio.mp4';
  if (type.includes('ogg')) return 'audio.ogg';
  if (type.includes('wav')) return 'audio.wav';
  return 'audio.webm';
}

/** Speech to text. Returns the transcript, which may legitimately be empty. */
export async function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  if (blob.size > MAX_AUDIO_BYTES) {
    throw new Error('That recording is too long. Please keep it under 25MB.');
  }

  const form = new FormData();
  form.append('audio', blob, fileNameFor(blob.type));

  // No Content-Type header: fetch sets multipart/form-data with the boundary,
  // and setting it by hand omits the boundary and breaks the upload.
  const response = await fetch(apiUrl('/api/transcribe'), {
    method: 'POST',
    body: form,
    signal,
  });

  if (!response.ok) throw new Error('Transcription failed');

  const data = (await response.json()) as { text?: unknown };
  return typeof data.text === 'string' ? data.text : '';
}

/** Text to speech. Returns the MP3 body as a blob, ready for an object URL. */
export async function fetchSpeech(
  text: string,
  voice: Voice = DEFAULT_VOICE,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(apiUrl('/api/speak'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal,
  });

  if (!response.ok) throw new Error('Speech synthesis failed');

  return response.blob();
}
