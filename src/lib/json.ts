/**
 * `JSON.stringify` that cannot throw.
 *
 * Used by the generic tool widget, whose payload is whatever a tool this client
 * has never heard of decided to send. A cycle or a BigInt would otherwise take
 * the whole transcript down with it, so both are rendered rather than thrown.
 */
export function safeStringify(value: unknown, indent = 2): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_key, item: unknown) => {
        if (typeof item === 'bigint') return item.toString();
        if (typeof item === 'object' && item !== null) {
          if (seen.has(item)) return '[Circular]';
          seen.add(item);
        }
        return item;
      },
      indent,
    );
  } catch {
    return '[This result could not be displayed]';
  }
}
