import { StatRow } from '@/components/chat/widgets/StatRow';
import { StatTile } from '@/components/chat/widgets/StatTile';
import { WidgetShell } from '@/components/chat/widgets/WidgetShell';
import { formatCurrency, formatNumber } from '@/lib/format';

/** `calculate_roi`. */
export interface RoiResult {
  investment?: number;
  system_cost?: number;
  subsidy?: number;
  monthly_savings?: number;
  annual_savings?: number;
  payback_period_years?: number;
  total_25_year_savings?: number;
  roi_percentage?: number;
  monthly_generation_kwh?: number;
  /** kg of CO2 per year. */
  co2_offset_annually?: number;
  yearly_breakdown?: {
    year: number;
    annual_savings: number;
    cumulative_savings: number;
  }[];
}

/**
 * How many milestones to show. The tool sends years 1–5 and then every fifth
 * year to 25; the early years are the ones a customer weighs a decision on, and
 * the rest turn the widget into a table nobody reads inside a chat bubble.
 */
const MILESTONES_SHOWN = 5;

/** A tree absorbs roughly 21 kg of CO2 a year — the usual comparison. */
const CO2_KG_PER_TREE_YEAR = 21;

export function RoiDisplay({ result }: { result: RoiResult }) {
  const milestones = (result.yearly_breakdown ?? []).slice(0, MILESTONES_SHOWN);
  const trees = result.co2_offset_annually
    ? Math.round(result.co2_offset_annually / CO2_KG_PER_TREE_YEAR)
    : null;

  return (
    <WidgetShell emoji="📈" title="Return on investment" subtitle="Over 25 years">
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Payback"
          value={
            result.payback_period_years ? `${result.payback_period_years} years` : '—'
          }
          emphasis
        />
        <StatTile
          label="25-year savings"
          value={formatCurrency(result.total_25_year_savings)}
          emphasis
        />
        <StatTile label="Your investment" value={formatCurrency(result.investment)} />
        <StatTile
          label="Return"
          value={result.roi_percentage ? `${formatNumber(result.roi_percentage)}%` : '—'}
        />
      </div>

      <div>
        <StatRow label="System cost" value={formatCurrency(result.system_cost)} />
        <StatRow label="Subsidy" value={`− ${formatCurrency(result.subsidy)}`} />
        <StatRow
          label="Net investment"
          value={formatCurrency(result.investment)}
          strong
        />
      </div>

      <div>
        <StatRow label="Monthly savings" value={formatCurrency(result.monthly_savings)} />
        <StatRow label="Annual savings" value={formatCurrency(result.annual_savings)} />
        <StatRow
          label="Monthly generation"
          value={
            result.monthly_generation_kwh
              ? `${formatNumber(result.monthly_generation_kwh)} kWh`
              : '—'
          }
        />
      </div>

      {milestones.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold">First years</h4>
          {milestones.map((row) => (
            <StatRow
              key={row.year}
              label={`Year ${row.year}`}
              value={
                <>
                  {formatCurrency(row.annual_savings)}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatCurrency(row.cumulative_savings)} total
                  </span>
                </>
              }
            />
          ))}
          <p className="pt-1 text-[0.7rem] text-muted-foreground">
            Savings rise each year with electricity prices, less panel degradation.
          </p>
        </div>
      )}

      {result.co2_offset_annually != null && (
        <div className="rounded-md border border-border/70 bg-muted/40 px-2.5 py-2">
          <h4 className="text-xs font-semibold">Environmental impact</h4>
          <p className="text-xs text-muted-foreground">
            About {formatNumber(result.co2_offset_annually)} kg of CO₂ avoided every year
            {trees ? ` — roughly ${formatNumber(trees)} trees' worth.` : '.'}
          </p>
        </div>
      )}
    </WidgetShell>
  );
}
