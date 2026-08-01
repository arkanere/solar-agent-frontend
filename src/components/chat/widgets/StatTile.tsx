import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Small print under the figure — the basis for it, or a unit. */
  hint?: ReactNode;
  /** Draws the eye to the one number the customer came for. */
  emphasis?: boolean;
  className?: string;
}

/** One headline figure. Tiles are laid out in a grid by their parent widget. */
export function StatTile({ label, value, hint, emphasis, className }: StatTileProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-border/70 px-2.5 py-2',
        emphasis && 'border-primary/40 bg-primary/5',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'font-semibold break-words',
          emphasis ? 'text-base text-primary' : 'text-sm',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}
