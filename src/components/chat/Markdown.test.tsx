import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from '@/components/chat/Markdown';

/**
 * `rehype-raw` is on because the welcome message is raw HTML, which switches off
 * react-markdown's blanket refusal to render markup. Reply text is model output
 * from an agent that reads web pages, so these are the tests that matter most in
 * this file — the rendering ones below are almost incidental by comparison.
 */
describe('Markdown — injection', () => {
  it('renders no script, iframe, img or object, whatever the reply contains', () => {
    const { container } = render(
      <Markdown>
        {[
          '<script>window.__owned = true</script>',
          '<img src=x onerror="window.__owned = true">',
          '<iframe src="https://evil.test"></iframe>',
          '<object data="https://evil.test"></object>',
          '<style>body{display:none}</style>',
        ].join('\n')}
      </Markdown>,
    );

    for (const tag of ['script', 'iframe', 'img', 'object', 'style', 'form']) {
      expect(container.querySelector(tag), tag).toBeNull();
    }
    expect((window as unknown as Record<string, unknown>).__owned).toBeUndefined();
  });

  it('does not leak a script body as visible text either', () => {
    const { container } = render(
      <Markdown>{'<script>window.__owned = true</script>'}</Markdown>,
    );
    expect(container.textContent).not.toContain('__owned');
  });

  it('strips every event-handler attribute', () => {
    const { container } = render(
      <Markdown>
        {'<a href="https://x.test" onclick="alert(1)" onmouseover="alert(2)">link</a>'}
      </Markdown>,
    );
    const link = container.querySelector('a')!;
    expect(link.getAttribute('onclick')).toBeNull();
    expect(link.getAttribute('onmouseover')).toBeNull();
  });

  it('empties a javascript: href', () => {
    const { container } = render(
      <Markdown>{'[click me](javascript:alert(1))'}</Markdown>,
    );
    expect(container.querySelector('a')?.getAttribute('href')).not.toMatch(
      /javascript:/i,
    );
  });
});

describe('Markdown — rendering', () => {
  it('renders the raw-HTML welcome message as a paragraph, not as text', () => {
    const { container } = render(<Markdown>{'<p>Hi! I am the assistant.</p>'}</Markdown>);
    expect(container.querySelector('p')).toHaveTextContent('Hi! I am the assistant.');
    expect(container.textContent).not.toContain('<p>');
  });

  it('renders lists, emphasis and links', () => {
    render(
      <Markdown>
        {
          'Solar is **cheap**.\n\n- 1 kW: ₹30,000\n- 2 kW: ₹60,000\n\n[Read more](https://x.test)'
        }
      </Markdown>,
    );

    expect(screen.getByText('cheap').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const link = screen.getByRole('link', { name: 'Read more' });
    expect(link).toHaveAttribute('href', 'https://x.test');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders a GFM table', () => {
    render(<Markdown>{'| kW | Subsidy |\n| --- | --- |\n| 1 | ₹30,000 |'}</Markdown>);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Subsidy' })).toBeInTheDocument();
  });

  it('flattens every heading level to one size — a bubble has no outline', () => {
    const { container } = render(<Markdown>{'# One\n\n###### Six'}</Markdown>);
    expect(container.querySelectorAll('h4')).toHaveLength(2);
    expect(container.querySelector('h1')).toBeNull();
  });
});
