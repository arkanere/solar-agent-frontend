import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Sun, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Composer } from '@/components/chat/Composer';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { stripHtml } from '@/lib/format';
import { useChatStore } from '@/store/chatStore';

/** Openers for a cold conversation. Hidden the moment the customer says anything. */
const STARTER_PROMPTS = [
  'How much can I save with solar?',
  'What government subsidies am I eligible for?',
  'What size system does my home need?',
  'How much maintenance do solar panels need?',
];

/**
 * How far from the bottom counts as "reading back". Auto-scrolling someone who
 * has deliberately scrolled up to re-read an answer is the single most annoying
 * thing a streaming chat can do, so the threshold to break anchoring is
 * generous and the one to restore it is tight — drifting back into anchoring by
 * accident is worse than having to scroll the last few pixels yourself.
 */
const DETACH_THRESHOLD_PX = 100;
const REATTACH_THRESHOLD_PX = 20;

export interface ChatBoxProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  onRetry?: (index: number) => void;
  onRegenerate?: (index: number) => void;
  /** Clearing has to abort an in-flight turn as well as empty the transcript,
   * which only the chat hook can do. Falls back to the store's own reset. */
  onReset?: () => void;
  /** Supplied by the popup host in Phase 8; absent on the full-page chat. */
  onClose?: () => void;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2" aria-label="Assistant is typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

export function ChatBox({
  onSend,
  onStop,
  onRetry,
  onRegenerate,
  onReset,
  onClose,
}: ChatBoxProps) {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const reset = useChatStore((s) => s.reset);

  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  /** Whether new content should pull the view down. A ref, not state: it changes
   * on every scroll event and no render depends on it. */
  const anchored = useRef(true);

  const handleScroll = () => {
    const el = historyRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance > DETACH_THRESHOLD_PX) anchored.current = false;
    else if (distance < REATTACH_THRESHOLD_PX) anchored.current = true;
  };

  // Runs after every transcript change, which during streaming means once per
  // delta — cheap, because it is a single scrollTop assignment.
  useEffect(() => {
    const el = historyRef.current;
    if (!el || !anchored.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const hasUserSpoken = messages.some((m) => m.role === 'user');

  /**
   * The conversation as something a customer can paste into an email or a
   * WhatsApp message. Markup is flattened rather than carried across — the
   * welcome message is raw HTML, and replies contain markdown that reads badly
   * as source. Citations are appended per turn, since the links are the part
   * most worth keeping and nothing else in plain text preserves them.
   */
  const copyTranscript = async () => {
    const text = messages
      .map((m) => {
        const speaker = m.role === 'user' ? 'You' : 'Assistant';
        const body = stripHtml(m.content);
        const citations = m.sources?.length
          ? '\n' + m.sources.map((s) => `  - ${s.title || s.url}: ${s.url}`).join('\n')
          : '';
        return `${speaker}: ${body}${citations}`;
      })
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTranscript(true);
      window.setTimeout(() => setCopiedTranscript(false), 1500);
    } catch {
      console.warn('[ChatBox] clipboard write was refused');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <Sun className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">Solar Vipani Assistant</h2>
          <p className="truncate text-xs text-muted-foreground">
            Costs, subsidies and system sizing
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={copyTranscript}
          aria-label="Copy conversation"
        >
          {copiedTranscript ? <Check /> : <Copy />}
        </Button>

        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close chat"
          >
            <X />
          </Button>
        )}
      </header>

      <div
        ref={historyRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-busy={isLoading}
        aria-label="Conversation"
        className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.map((message, index) => (
          <MessageBubble
            key={`${message.timestamp}-${index}`}
            message={message}
            index={index}
            isLast={index === messages.length - 1}
            onRetry={onRetry}
            onRegenerate={onRegenerate}
          />
        ))}

        {/* Only while waiting: once deltas arrive the growing reply is its own
            progress indicator. */}
        {isLoading && !isStreaming && <TypingIndicator />}

        {!hasUserSpoken && (
          <div className="flex flex-wrap gap-2 pt-2">
            {STARTER_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                className="h-auto rounded-4xl py-1.5 text-left font-normal whitespace-normal"
                onClick={() => onSend(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        )}
      </div>

      <Composer onSend={onSend} onStop={onStop} isBusy={isLoading} />

      <footer className="flex justify-center border-t border-border px-4 py-2">
        <Button
          variant="ghost"
          size="xs"
          onClick={onReset ?? reset}
          className="text-muted-foreground"
        >
          <Trash2 />
          Clear conversation
        </Button>
      </footer>
    </div>
  );
}
