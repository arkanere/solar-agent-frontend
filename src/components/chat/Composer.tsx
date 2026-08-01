import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, Mic, Send, Square, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { VoiceApi } from '@/hooks/useChat';
import { useChatStore } from '@/store/chatStore';

export interface ComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  /** A turn is in flight: sending is blocked and Send becomes Stop. */
  isBusy?: boolean;
  /** Absent on hosts that do not wire voice up; the mic and speaker are hidden. */
  voice?: VoiceApi;
}

export function Composer({ onSend, onStop, isBusy = false, voice }: ComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceOutputEnabled = useChatStore((s) => s.voiceOutputEnabled);

  /**
   * Grow the textarea to fit its content. `height: auto` first, otherwise
   * `scrollHeight` reports the height the box already has and the field can
   * only ever grow. The ceiling is the max-height below, which then hands
   * overflow back to the scrollbar.
   */
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Ask the browser what it already knows about the microphone, so a customer
  // who blocked it once sees a disabled button rather than a prompt that never
  // appears. Cheap, and silently skipped where the Permissions API has no
  // microphone descriptor.
  const syncPermission = voice?.syncPermission;
  useEffect(() => {
    void syncPermission?.();
  }, [syncPermission]);

  const send = () => {
    const text = value.trim();
    if (!text || isBusy) return;
    setValue('');
    onSend(text);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Escape abandons a recording — the same key that dismisses everything else.
    if (event.key === 'Escape' && voice?.isRecording) {
      event.preventDefault();
      voice.cancelRecording();
      return;
    }
    // An IME candidate window uses Enter to commit a selection. Sending on that
    // keystroke would fire mid-word for anyone typing a non-Latin script.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  const micDenied = voice?.permission === 'denied';
  const micBusy = voice?.isTranscribing || voice?.permission === 'checking';

  return (
    <div className="border-t border-border bg-background">
      {voice?.error && (
        <p role="status" className="px-3 pt-2 text-xs text-destructive">
          {voice.error}
        </p>
      )}

      {voice?.isRecording && (
        <p
          role="status"
          className="flex items-center gap-2 px-3 pt-2 text-xs text-muted-foreground"
        >
          <span
            className="size-2 animate-pulse rounded-full bg-destructive"
            aria-hidden="true"
          />
          Recording — press the square to send, Escape to discard.
        </p>
      )}

      <div className="flex items-end gap-2 p-3">
        {voice?.isSupported && (
          <Button
            variant={voice.isRecording ? 'destructive' : 'outline'}
            size="icon-lg"
            onClick={() => void voice.toggleRecording()}
            disabled={micDenied || micBusy || (isBusy && !voice.isRecording)}
            aria-label={
              voice.isRecording ? 'Stop recording and send' : 'Record a question'
            }
            aria-pressed={voice.isRecording}
            title={
              micDenied
                ? 'Microphone access is blocked in your browser settings'
                : undefined
            }
          >
            {voice.isTranscribing ? (
              <Loader2 className="animate-spin" />
            ) : voice.isRecording ? (
              <Square />
            ) : (
              <Mic />
            )}
          </Button>
        )}

        {voice?.isRecording && (
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={voice.cancelRecording}
            aria-label="Discard recording"
          >
            <X />
          </Button>
        )}

        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask about costs, subsidies, system size…"
          aria-label="Message"
          className="max-h-32 min-h-9 resize-none overflow-y-auto py-2"
        />

        {voice && (
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={voice.toggleVoiceOutput}
            aria-label={
              voiceOutputEnabled ? 'Turn off spoken replies' : 'Read replies aloud'
            }
            aria-pressed={voiceOutputEnabled}
            className={voiceOutputEnabled ? 'text-primary' : 'text-muted-foreground'}
          >
            {voice.isSynthesising ? (
              <Loader2 className="animate-spin" />
            ) : voiceOutputEnabled ? (
              <Volume2 className={voice.isSpeaking ? 'animate-pulse' : undefined} />
            ) : (
              <VolumeX />
            )}
          </Button>
        )}

        {isBusy && onStop ? (
          <Button
            variant="outline"
            size="icon-lg"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <Square />
          </Button>
        ) : (
          <Button
            size="icon-lg"
            onClick={send}
            disabled={!value.trim() || isBusy}
            aria-label="Send message"
          >
            <Send />
          </Button>
        )}
      </div>
    </div>
  );
}
