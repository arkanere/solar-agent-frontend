import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface WidgetShellProps {
  /** A single emoji. Decorative — the title carries the meaning. */
  emoji: string;
  title: string;
  subtitle?: ReactNode;
  /** Buttons or links for the top-right corner: download, submit, and so on. */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * The frame every tool result sits in.
 *
 * Widgets are wide, structured content in a column of chat bubbles, so they
 * deliberately break out of the bubble's width and use the full column instead —
 * a quotation squeezed into 46 characters is unreadable.
 */
export function WidgetShell({
  emoji,
  title,
  subtitle,
  actions,
  children,
  className,
}: WidgetShellProps) {
  return (
    <section
      className={cn(
        'w-full max-w-[46ch] rounded-lg border border-border bg-card text-card-foreground sm:max-w-[60ch]',
        className,
      )}
    >
      <header className="flex items-start gap-2 border-b border-border px-3 py-2">
        <span aria-hidden="true" className="text-base leading-6">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm leading-6 font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-xs break-words text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>

      <div className="space-y-3 px-3 py-3 text-sm">{children}</div>
    </section>
  );
}
