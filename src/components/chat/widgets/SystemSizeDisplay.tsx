import { StatRow } from '@/components/chat/widgets/StatRow';
import { StatTile } from '@/components/chat/widgets/StatTile';
import { WidgetShell } from '@/components/chat/widgets/WidgetShell';
import { formatNumber } from '@/lib/format';

/** `calculate_system_size`. */
export interface SystemSizeResult {
  monthly_consumption_kwh?: number;
  daily_consumption_kwh?: number;
  recommended_system_size_kw?: number;
  number_of_panels?: number;
  panel_wattage?: string;
  required_roof_area_sqft?: number;
  available_roof_area_sqft?: number | null;
  /** null when no roof area was given — not a failure, just unknown. */
  is_roof_sufficient?: boolean | null;
  estimated_monthly_generation?: number;
  estimated_coverage_percent?: number;
  /** The tool's own account of how the coverage figure was reached. */
  coverage_basis?: string;
  roof_area_note?: string;
}

export function SystemSizeDisplay({ result }: { result: SystemSizeResult }) {
  return (
    <WidgetShell
      emoji="☀️"
      title="Recommended system"
      subtitle={
        result.monthly_consumption_kwh
          ? `For ${formatNumber(result.monthly_consumption_kwh)} kWh a month`
          : undefined
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="System size"
          value={
            result.recommended_system_size_kw
              ? `${result.recommended_system_size_kw} kW`
              : '—'
          }
          emphasis
        />
        <StatTile
          label="Panels"
          value={result.number_of_panels ?? '—'}
          hint={result.panel_wattage}
        />
      </div>

      <div>
        <StatRow
          label="Monthly generation"
          value={
            result.estimated_monthly_generation
              ? `${formatNumber(result.estimated_monthly_generation)} kWh`
              : '—'
          }
        />
        <StatRow
          label="Covers"
          value={
            result.estimated_coverage_percent != null
              ? `${formatNumber(result.estimated_coverage_percent)}% of your usage`
              : '—'
          }
        />
        <StatRow
          label="Roof area needed"
          value={
            result.required_roof_area_sqft
              ? `${formatNumber(result.required_roof_area_sqft)} sq ft`
              : '—'
          }
        />
        {/* Only shown when the customer actually supplied a roof area. Absent is
            the normal case — the sizing does not depend on it. */}
        {result.is_roof_sufficient != null && (
          <StatRow
            label="Your roof"
            value={
              result.is_roof_sufficient ? 'Enough space' : 'May need a smaller system'
            }
          />
        )}
      </div>

      {result.coverage_basis && (
        <p className="text-[0.7rem] text-muted-foreground">{result.coverage_basis}</p>
      )}
    </WidgetShell>
  );
}
