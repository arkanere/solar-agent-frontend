import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WidgetErrorBoundary } from '@/components/chat/WidgetErrorBoundary';

function Exploding(): never {
  throw new Error('bad payload');
}

describe('WidgetErrorBoundary', () => {
  it('renders its child when nothing goes wrong', () => {
    render(
      <WidgetErrorBoundary toolName="generate_quotation">
        <p>A quotation</p>
      </WidgetErrorBoundary>,
    );
    expect(screen.getByText('A quotation')).toBeInTheDocument();
  });

  it('replaces a throwing widget with an apology, and logs which tool it was', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <>
        <p>The answer above</p>
        <WidgetErrorBoundary toolName="generate_quotation">
          <Exploding />
        </WidgetErrorBoundary>
      </>,
    );

    // The transcript around it is untouched — that is the whole point.
    expect(screen.getByText('The answer above')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /could not be displayed.*answer above still stands/i,
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('generate_quotation'),
      expect.any(Error),
      expect.anything(),
    );
  });
});
