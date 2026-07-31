import { useLayoutEffect, useRef, useState } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export interface ComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  /** A turn is in flight: sending is blocked and Send becomes Stop. */
  isBusy?: boolean;
}

export function Composer({ onSend, onStop, isBusy = false }: ComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const send = () => {
    const text = value.trim();
    if (!text || isBusy) return;
    setValue('');
    onSend(text);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // An IME candidate window uses Enter to commit a selection. Sending on that
    // keystroke would fire mid-word for anyone typing a non-Latin script.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <div className="flex items-end gap-2 border-t border-border bg-background p-3">
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
  );
}
