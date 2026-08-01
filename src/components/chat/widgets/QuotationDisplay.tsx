import { StatRow } from '@/components/chat/widgets/StatRow';
import { StatTile } from '@/components/chat/widgets/StatTile';
import { WidgetShell } from '@/components/chat/widgets/WidgetShell';
import { formatCurrency } from '@/lib/format';

/**
 * `generate_quotation`. Keys are snake_case because the tool's payload reaches
 * the client verbatim — the server only camelCases its own envelope, not the
 * tool data inside it.
 */
export interface QuotationResult {
  quotation_number?: string;
  date?: string;
  customer_name?: string;
  location?: string;
  property_type?: string;
  system_details?: {
    capacity?: string;
    panel_type?: string;
    panel_wattage?: string;
    number_of_panels?: number;
    inverter_type?: string;
    mounting_structure?: string;
    estimated_generation?: string;
  };
  pricing?: {
    system_cost?: number;
    subsidy?: number;
    final_cost?: number;
    cost_breakdown?: Record<string, number>;
  };
  /** Absent when the customer's bill was never established. */
  savings?: {
    monthly_bill?: number;
    estimated_monthly_savings?: number;
    annual_savings?: number;
    payback_period?: string;
  } | null;
  validity?: string;
  terms?: string[];
}

/** `solar_panels` → `Solar panels`, for the cost-breakdown rows. */
function humanizeKey(key: string): string {
  const words = key.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function QuotationDisplay({ result }: { result: QuotationResult }) {
  const { system_details: system, pricing, savings } = result;
  const breakdown = Object.entries(pricing?.cost_breakdown ?? {});

  return (
    <WidgetShell
      emoji="🧾"
      title="Quotation"
      subtitle={[result.quotation_number, result.date].filter(Boolean).join(' · ')}
    >
      {(result.customer_name || result.location) && (
        <p className="text-xs text-muted-foreground">
          {[result.customer_name, result.location].filter(Boolean).join(' · ')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="System cost" value={formatCurrency(pricing?.system_cost)} />
        <StatTile label="Subsidy" value={`− ${formatCurrency(pricing?.subsidy)}`} />
        <StatTile
          label="You pay"
          value={formatCurrency(pricing?.final_cost)}
          emphasis
          className="col-span-2"
        />
      </div>

      {system && (
        <div>
          <h4 className="mb-1 text-xs font-semibold">System</h4>
          <StatRow label="Capacity" value={system.capacity ?? '—'} />
          <StatRow
            label="Panels"
            value={
              system.number_of_panels
                ? `${system.number_of_panels} × ${system.panel_wattage ?? ''} ${system.panel_type ?? ''}`.trim()
                : '—'
            }
          />
          <StatRow label="Inverter" value={system.inverter_type ?? '—'} />
          <StatRow label="Mounting" value={system.mounting_structure ?? '—'} />
          <StatRow label="Generation" value={system.estimated_generation ?? '—'} />
        </div>
      )}

      {breakdown.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold">Cost breakdown</h4>
          {breakdown.map(([key, amount]) => (
            <StatRow key={key} label={humanizeKey(key)} value={formatCurrency(amount)} />
          ))}
        </div>
      )}

      {/* Only quoted when the tool was given a bill to work from; inventing a
          payback period without one would be the most misleading number here. */}
      {savings && (
        <div>
          <h4 className="mb-1 text-xs font-semibold">Savings</h4>
          <StatRow
            label="Monthly"
            value={formatCurrency(savings.estimated_monthly_savings)}
          />
          <StatRow label="Annually" value={formatCurrency(savings.annual_savings)} />
          <StatRow label="Payback" value={savings.payback_period ?? '—'} strong />
        </div>
      )}

      {result.terms && result.terms.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {result.terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      )}

      {result.validity && (
        <p className="text-xs text-muted-foreground">Valid for {result.validity}.</p>
      )}
    </WidgetShell>
  );
}
