import { useState } from 'react';
import { Check, Copy, RefreshCw, RotateCcw, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';

export interface MessageBubbleProps {
  message: ChatMessage;
  /** Position in the transcript. The action handlers address messages by index. */
  index: number;
  /** Regenerate is only offered on the newest reply — rewriting an older one
   * would strand every turn that followed it. */
  isLast: boolean;
  onRegenerate?: (index: number) => void;
  onRetry?: (index: number) => void;
}

export function MessageBubble({
  message,
  index,
  isLast,
  onRegenerate,
  onRetry,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access is denied outside a secure context and in some
      // embedded webviews. Nothing to recover — just don't flash "copied".
      console.warn('[MessageBubble] clipboard write was refused');
    }
  };

  const canRegenerate = !isUser && isLast && !message.error && onRegenerate;

  return (
    <div
      className={cn('group flex w-full gap-2', isUser ? 'justify-end' : 'justify-start')}
      data-role={message.role}
    >
      {!isUser && (
        <div
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Sun className="size-4" />
        </div>
      )}

      <div
        className={cn(
          'flex min-w-0 flex-col gap-1',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'max-w-[46ch] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap sm:max-w-[60ch]',
            isUser && 'bg-primary text-primary-foreground',
            !isUser &&
              !message.error &&
              'border border-border bg-card text-card-foreground',
            message.error &&
              'border border-destructive/40 bg-destructive/10 text-foreground',
          )}
        >
          {message.content}
        </div>

        <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <time dateTime={new Date(message.timestamp).toISOString()}>
            {formatTime(message.timestamp)}
          </time>

          {message.stopped && (
            <Badge variant="outline" className="h-4 px-1.5 text-[0.65rem]">
              Stopped
            </Badge>
          )}

          {/* Kept mounted rather than conditionally rendered so the row does not
              reflow on hover; focus-within keeps it reachable by keyboard. */}
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={copy}
              aria-label="Copy message"
            >
              {copied ? <Check /> : <Copy />}
            </Button>

            {canRegenerate && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onRegenerate(index)}
                aria-label="Regenerate reply"
              >
                <RefreshCw />
              </Button>
            )}
          </div>

          {message.error && onRetry && (
            <Button variant="ghost" size="xs" onClick={() => onRetry(index)}>
              <RotateCcw />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
