import { WidgetShell } from '@/components/chat/widgets/WidgetShell';
import { humanizeToolName } from '@/lib/format';
import { safeStringify } from '@/lib/json';

export interface GenericToolDisplayProps {
  name: string;
  result: unknown;
}

/** The fallback for a tool with no widget of its own. */
export function GenericToolDisplay({ name, result }: GenericToolDisplayProps) {
  return (
    <WidgetShell emoji="🛠️" title={humanizeToolName(name)}>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-[0.7rem] whitespace-pre-wrap">
        {safeStringify(result)}
      </pre>
    </WidgetShell>
  );
}
