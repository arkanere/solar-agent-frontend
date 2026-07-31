import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

/**
 * Assistant replies are markdown, and the welcome message is raw HTML, so the
 * pipeline needs `rehype-raw` — which switches off react-markdown's default
 * refusal to render HTML at all.
 *
 * That protection is replaced here rather than simply dropped. Reply text is
 * model output, and one of the agent's tools scrapes arbitrary websites, so a
 * page the model reads can try to talk it into emitting markup. Three things
 * stand between that and script execution:
 *
 * - `ALLOWED_ELEMENTS` below, an allowlist — anything else is unwrapped to its
 *   text. No `<script>`, `<iframe>`, `<style>`, `<form>` or `<img>`.
 * - `rehypeHardenRawHtml`, which drops every `on*` attribute — closing the
 *   `<a onclick=…>` hole an element allowlist leaves open — and cuts out
 *   script-like subtrees whose contents would otherwise surface as text.
 * - react-markdown's own `urlTransform`, on by default, which already refuses
 *   `javascript:` and `data:` URLs on `href`.
 *
 * This is deliberately not a full sanitiser. `rehype-sanitize` is the real
 * answer if the threat model ever hardens — see the Session log.
 */
const ALLOWED_ELEMENTS = [
  'p',
  'br',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'blockquote',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/**
 * Elements whose *contents* are code rather than prose. The allowlist alone
 * unwraps a disallowed element to its children, which for these would print
 * the script body into the bubble as visible text — harmless but nonsense. They
 * are cut out here, subtree and all, before that can happen.
 */
const DROPPED_SUBTREES = new Set(['script', 'style', 'template', 'iframe', 'object']);

/**
 * Drop those subtrees and strip every inline event handler. Walked by hand
 * rather than with `unist-util-visit`, which is only a transitive dependency
 * here and would be a direct import of something nothing declares.
 */
function rehypeHardenRawHtml() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.properties) {
        for (const key of Object.keys(node.properties)) {
          if (key.toLowerCase().startsWith('on')) delete node.properties[key];
        }
      }
      if (node.children) {
        node.children = node.children.filter(
          (child) => !(child.tagName && DROPPED_SUBTREES.has(child.tagName)),
        );
        node.children.forEach(walk);
      }
    };
    walk(tree);
  };
}

/**
 * Tailwind reset strips list markers and heading sizes, so every element the
 * assistant can emit has to be styled back explicitly. Spacing is tight on
 * purpose: these render inside a chat bubble, not an article.
 */
const COMPONENTS: Components = {
  p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => (
    <h4 className="mt-2 mb-1 font-semibold first:mt-0">{children}</h4>
  ),
  h2: ({ children }) => (
    <h4 className="mt-2 mb-1 font-semibold first:mt-0">{children}</h4>
  ),
  h3: ({ children }) => (
    <h4 className="mt-2 mb-1 font-semibold first:mt-0">{children}</h4>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2 mb-1 font-semibold first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h4 className="mt-2 mb-1 font-semibold first:mt-0">{children}</h4>
  ),
  h6: ({ children }) => (
    <h4 className="mt-2 mb-1 font-semibold first:mt-0">{children}</h4>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-1 overflow-x-auto rounded bg-muted p-2 text-xs">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-1 overflow-x-auto">
      <table className="w-full text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border py-1 pr-3 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/50 py-1 pr-3">{children}</td>
  ),
};

export interface MarkdownProps {
  children: string;
}

/**
 * Memoised on the source string. During streaming this re-parses on every
 * delta, and the reply is the only thing changing in the transcript — without
 * this, each chunk re-renders every earlier message's markdown too.
 */
export const Markdown = memo(function Markdown({ children }: MarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeHardenRawHtml]}
      allowedElements={ALLOWED_ELEMENTS}
      unwrapDisallowed
      components={COMPONENTS}
    >
      {children}
    </ReactMarkdown>
  );
});
