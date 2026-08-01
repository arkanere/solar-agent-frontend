import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface StatRowProps {
  label: ReactNode;
  value: ReactNode;
  /** Totals and other lines that should stand out from the rows above them. */
  strong?: boolean;
  className?: string;
}

/** A label/value line for the detail lists inside a widget. */
export function StatRow({ label, value, strong, className }: StatRowProps) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 py-0.5',
        strong && 'border-t border-border pt-1.5 font-semibold',
        className,
      )}
    >
      <span className={cn('min-w-0 text-xs', strong ? '' : 'text-muted-foreground')}>
        {label}
      </span>
      <span className="shrink-0 text-right text-sm tabular-nums">{value}</span>
    </div>
  );
}
