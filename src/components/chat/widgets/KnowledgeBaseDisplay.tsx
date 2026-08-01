import { WidgetShell } from '@/components/chat/widgets/WidgetShell';

/** `search_knowledge_base`. */
export interface KnowledgeBaseResult {
  /** Retrieved passages, already concatenated by the backend. */
  context?: string;
  sources?: { title?: string; url?: string }[];
}

export function KnowledgeBaseDisplay({ result }: { result: KnowledgeBaseResult }) {
  const sources = (result.sources ?? []).filter((source) => source.url);

  return (
    <WidgetShell emoji="📚" title="From our knowledge base">
      {/* Plain text, deliberately. This is retrieved page content, and rendering
          it as markdown or HTML would let a scraped page decide how it appears
          in the transcript. `whitespace-pre-wrap` keeps the passage breaks. */}
      {result.context && (
        <p className="max-h-64 overflow-y-auto text-xs whitespace-pre-wrap text-muted-foreground">
          {result.context}
        </p>
      )}

      {sources.length > 0 && (
        <div className="border-t border-border/60 pt-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Sources</p>
          <ul className="space-y-0.5">
            {sources.map((source, index) => (
              <li key={`${source.url}-${index}`} className="text-xs">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  {source.title || source.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetShell>
  );
}
