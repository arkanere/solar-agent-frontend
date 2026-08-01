import { useState } from 'react';
import { Check, Copy, RefreshCw, RotateCcw, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IntentBadge } from '@/components/chat/IntentBadge';
import { Markdown } from '@/components/chat/Markdown';
import { TokenUsage } from '@/components/chat/TokenUsage';
import { WidgetErrorBoundary } from '@/components/chat/WidgetErrorBoundary';
import { ToolResultDisplay } from '@/components/chat/widgets/ToolResultDisplay';
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
      // The markdown source, not the rendered node: pasted into anything that
      // understands markdown it comes back as the same formatted reply, and
      // pasted into anything else it is still readable.
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
  const hasSources = (message.sources?.length ?? 0) > 0;
  // A tool-only turn streams no text at all. An empty bubble under it would
  // read as the assistant having said nothing, so the bubble is dropped and
  // Phase 7's widget stands on its own.
  const hasBody = message.content.trim().length > 0 || hasSources;

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
        {hasBody && (
          <div
            className={cn(
              'max-w-[46ch] rounded-lg px-3 py-2 text-sm break-words sm:max-w-[60ch]',
              // The customer's own words are literal text — their line breaks
              // matter and their asterisks do not mean emphasis.
              isUser && 'bg-primary whitespace-pre-wrap text-primary-foreground',
              !isUser &&
                !message.error &&
                'border border-border bg-card text-card-foreground',
              message.error &&
                'border border-destructive/40 bg-destructive/10 text-foreground',
            )}
          >
            {isUser ? message.content : <Markdown>{message.content}</Markdown>}

            {hasSources && (
              <div className="mt-2 border-t border-border/60 pt-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Sources</p>
                <ul className="space-y-0.5">
                  {message.sources?.map((source, i) => (
                    <li key={`${source.url}-${i}`} className="text-xs">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        {source.title || source.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {message.toolExecuted && (
          <WidgetErrorBoundary toolName={message.toolExecuted}>
            <ToolResultDisplay name={message.toolExecuted} result={message.toolResult} />
          </WidgetErrorBoundary>
        )}

        {(message.intent || message.usage) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
            {message.intent && <IntentBadge intent={message.intent} />}
            {message.usage && <TokenUsage usage={message.usage} />}
          </div>
        )}

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
