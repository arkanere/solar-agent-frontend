import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatRow } from '@/components/chat/widgets/StatRow';
import { WidgetShell } from '@/components/chat/widgets/WidgetShell';
import { formatNumber } from '@/lib/format';

/** `generate_cad_drawing`. */
export interface CadDrawingResult {
  drawing_id?: string;
  customer_name?: string;
  system_size_kw?: number;
  roof_type?: string;
  roof_dimensions?: { length?: number; width?: number; area?: number };
  roof_orientation?: string;
  panel_layout?: {
    rows?: number;
    columns?: number;
    total_panels?: number;
    orientation?: string;
  };
  /** Percentages and areas arrive pre-formatted, as strings. */
  utilization?: { percent?: string; area_used?: string; area_total?: string };
  recommendations?: string[];
  status?: string;
  note?: string;
  preview_url?: string;
  /** The layout as SVG source. Offered as a download; never put into the page. */
  svg?: string;
  created_at?: string;
}

/**
 * The drawing is model-adjacent content, and SVG is executable — an inline
 * `<svg>` or a same-origin `<object>` can carry script. It is handed over as a
 * file the customer opens deliberately instead, which costs nothing here: the
 * layout is a preliminary sketch, not something to study in a chat bubble.
 */
function downloadSvg(svg: string, name: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.svg`;
  link.click();
  // The click is synchronous but the fetch of the blob is not, so the URL has to
  // outlive this tick.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function CadDrawingDisplay({ result }: { result: CadDrawingResult }) {
  const layout = result.panel_layout;
  const dimensions = result.roof_dimensions;

  // Clamped, because the figure is computed upstream and a layout overshooting
  // its roof would otherwise render a bar running out of its own track.
  const percent = Number(result.utilization?.percent);
  const utilisation = Number.isFinite(percent)
    ? Math.min(100, Math.max(0, percent))
    : null;

  return (
    <WidgetShell
      emoji="📐"
      title="Preliminary panel layout"
      subtitle={result.drawing_id}
      actions={
        result.svg ? (
          <Button
            variant="outline"
            size="xs"
            onClick={() => downloadSvg(result.svg!, result.drawing_id ?? 'layout')}
          >
            <Download />
            SVG
          </Button>
        ) : undefined
      }
    >
      <div>
        <StatRow
          label="System size"
          value={result.system_size_kw ? `${result.system_size_kw} kW` : '—'}
        />
        <StatRow label="Panels" value={layout?.total_panels ?? '—'} />
        <StatRow
          label="Grid"
          value={
            layout?.rows && layout?.columns
              ? `${layout.rows} × ${layout.columns}${layout.orientation ? `, ${layout.orientation}` : ''}`
              : '—'
          }
        />
        <StatRow label="Roof type" value={result.roof_type ?? '—'} />
        <StatRow
          label="Roof size"
          value={
            dimensions?.length && dimensions?.width
              ? `${formatNumber(dimensions.length, 1)} × ${formatNumber(dimensions.width, 1)} m`
              : '—'
          }
        />
        <StatRow label="Orientation" value={result.roof_orientation ?? '—'} />
      </div>

      {utilisation !== null && (
        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Roof used</span>
            <span className="font-semibold tabular-nums">{utilisation}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={utilisation}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Roof area used"
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary" style={{ width: `${utilisation}%` }} />
          </div>
          {result.utilization?.area_used && result.utilization?.area_total && (
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              {result.utilization.area_used} m² of {result.utilization.area_total} m²
            </p>
          )}
        </div>
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs">
          {result.recommendations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {result.note && (
        <p className="text-[0.7rem] text-muted-foreground">{result.note}</p>
      )}
    </WidgetShell>
  );
}
