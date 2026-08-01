import { WidgetShell } from '@/components/chat/widgets/WidgetShell';
import { formatCurrency } from '@/lib/format';

/** `check_subsidies`. */
export interface SubsidyResult {
  location?: string;
  subsidies?: {
    scheme?: string;
    provider?: string;
    /** Prose, not a number: "₹30,000 per kW (40% subsidy)". */
    subsidy_amount?: string;
    /** Only the central scheme carries a computed total. */
    total_subsidy?: number;
    eligibility?: string;
    application?: string;
  }[];
}

export function SubsidyDisplay({ result }: { result: SubsidyResult }) {
  const subsidies = result.subsidies ?? [];

  return (
    <WidgetShell emoji="🏛️" title="Subsidies and incentives" subtitle={result.location}>
      {subsidies.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No schemes were matched for this location.
        </p>
      )}

      {subsidies.map((subsidy, index) => (
        <div
          key={`${subsidy.scheme}-${index}`}
          className="rounded-md border border-border/70 px-2.5 py-2"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">{subsidy.scheme ?? 'Scheme'}</h4>
            {subsidy.total_subsidy != null && (
              <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
                {formatCurrency(subsidy.total_subsidy)}
              </span>
            )}
          </div>
          {subsidy.provider && (
            <p className="text-xs text-muted-foreground">{subsidy.provider}</p>
          )}
          {subsidy.subsidy_amount && (
            <p className="mt-1 text-xs">{subsidy.subsidy_amount}</p>
          )}
          {subsidy.eligibility && (
            <p className="mt-1 text-xs text-muted-foreground">
              Who qualifies: {subsidy.eligibility}
            </p>
          )}
          {subsidy.application && (
            <p className="text-xs text-muted-foreground">
              How to apply: {subsidy.application}
            </p>
          )}
        </div>
      ))}
    </WidgetShell>
  );
}
