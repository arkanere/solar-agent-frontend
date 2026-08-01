import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Named in the fallback and the log line, so a failure is traceable. */
  toolName: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Keeps one bad tool payload from blanking the whole conversation.
 *
 * Widget payloads are not validated on the way in — they are whatever a tool
 * returned, and a widget that throws while rendering would otherwise unmount the
 * entire transcript above it, including the customer's own words. A rendering
 * failure is worth a line of apology, not the loss of the conversation.
 *
 * Class syntax because React has no hook equivalent: `componentDidCatch` and
 * `getDerivedStateFromError` are only available on a class.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[WidgetErrorBoundary] ${this.props.toolName} failed to render`,
      error,
      info.componentStack,
    );
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <p
        role="status"
        className="w-full max-w-[46ch] rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:max-w-[60ch]"
      >
        This result could not be displayed. The answer above still stands.
      </p>
    );
  }
}
