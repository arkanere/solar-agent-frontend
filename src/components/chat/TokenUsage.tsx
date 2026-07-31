import { formatNumber } from '@/lib/format';
import type { MessageUsage } from '@/lib/types';

export interface TokenUsageProps {
  usage: MessageUsage;
}

/**
 * What the turn cost. Kept to four decimal places because a single reply is
 * fractions of a rupee — rounding to two would show ₹0.00 for most turns and
 * make the figure look broken rather than small.
 */
export function TokenUsage({ usage }: TokenUsageProps) {
  return (
    <span className="text-[0.65rem] text-muted-foreground tabular-nums">
      {formatNumber(usage.input)} in · {formatNumber(usage.output)} out ·{' '}
      {formatNumber(usage.total)} total · ₹{usage.costINR.toFixed(4)}
    </span>
  );
}
