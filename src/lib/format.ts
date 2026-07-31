/**
 * Display formatting for the chat UI and the tool-result widgets.
 *
 * Everything here is Indian-locale by default: `en-IN` groups digits as
 * 1,23,456 rather than 123,456, and the amounts these widgets show — system
 * cost, subsidy, savings — are the numbers the customer will recognise from a
 * quotation.
 *
 * Tool payloads come off the wire loosely typed, so each of these accepts a
 * string or a nullish value and falls back to an em dash rather than rendering
 * `NaN` or `₹undefined` into the transcript.
 */

const EMPTY = '—';

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** `125000` → `₹1,25,000`. Whole rupees: paise are noise at these amounts. */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return EMPTY;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

/** `12500` → `12,500`. For counts and units, without a currency symbol. */
export function formatNumber(
  value: number | string | null | undefined,
  maximumFractionDigits = 0,
): string {
  const n = toNumber(value);
  if (n === null) return EMPTY;
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits }).format(n);
}

/** `250000` → `₹2.5 L`. Compact form for headline figures in stat tiles. */
export function formatLakh(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return EMPTY;
  return `₹${formatNumber(n / 100000, 1)} L`;
}

/** `18500` → `₹18.5 K`. The same idea one order of magnitude down. */
export function formatThousand(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return EMPTY;
  return `₹${formatNumber(n / 1000, 1)} K`;
}

/**
 * Acronyms the agent's tool names contain. Word-casing alone would render these
 * as "Cad" and "Roi", which reads as a typo in a customer-facing label.
 */
const ACRONYMS = new Set(['cad', 'roi', 'kw', 'kwh', 'emi', 'gst', 'pdf']);

/** `generate_cad_drawing` → `Generate CAD Drawing`, for the tool badge. */
export function humanizeToolName(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

/** A message timestamp as a short local wall-clock time, e.g. `4:07 pm`. */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
