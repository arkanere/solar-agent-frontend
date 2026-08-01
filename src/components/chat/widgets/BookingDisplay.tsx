import { Badge } from '@/components/ui/badge';
import { StatRow } from '@/components/chat/widgets/StatRow';
import { WidgetShell } from '@/components/chat/widgets/WidgetShell';

/** `book_site_visit`. */
export interface BookingResult {
  booking_id?: string;
  customer_name?: string;
  phone_number?: string;
  location?: string;
  preferred_date?: string;
  preferred_time?: string;
  status?: string;
  created_at?: string;
}

export interface BookingDisplayProps {
  result: BookingResult;
  /** The only booking the agent can make today, but the tool set is meant to grow. */
  type?: 'site_visit';
}

const TITLES: Record<string, string> = { site_visit: 'Site visit booked' };

/** `pending_confirmation` → `Pending confirmation`. */
function humanizeStatus(status: string): string {
  const words = status.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function BookingDisplay({ result, type = 'site_visit' }: BookingDisplayProps) {
  return (
    <WidgetShell
      emoji="📅"
      title={TITLES[type] ?? 'Booking confirmed'}
      subtitle={result.booking_id}
      actions={
        result.status ? (
          <Badge variant="outline">{humanizeStatus(result.status)}</Badge>
        ) : undefined
      }
    >
      <div>
        <StatRow label="Name" value={result.customer_name ?? '—'} />
        <StatRow label="Phone" value={result.phone_number ?? '—'} />
        <StatRow label="Location" value={result.location ?? '—'} />
        <StatRow label="Date" value={result.preferred_date ?? 'To be confirmed'} />
        <StatRow label="Time" value={result.preferred_time ?? 'To be confirmed'} />
      </div>

      <p className="text-xs text-muted-foreground">
        Our team will call to confirm the appointment.
      </p>
    </WidgetShell>
  );
}
