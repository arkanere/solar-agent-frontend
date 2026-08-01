import { describe, expect, it } from 'vitest';
import { stripMarkdown } from '@/hooks/useSpeechPlayer';

/**
 * Text-to-speech pronounces syntax. Every case here is something a customer
 * would otherwise hear read out: "asterisk asterisk", a URL spelled character
 * by character, or a JSON payload.
 */
describe('stripMarkdown', () => {
  it('drops heading markers', () => {
    expect(stripMarkdown('## Subsidies\n\nYou can claim…')).toBe(
      'Subsidies\n\nYou can claim…',
    );
  });

  it('drops emphasis markers but keeps the words', () => {
    expect(stripMarkdown('Up to **₹78,000**, or _more_ with ***both***.')).toBe(
      'Up to ₹78,000, or more with both.',
    );
    expect(stripMarkdown('~~struck~~ out')).toBe('struck out');
  });

  it('keeps link text and drops the target', () => {
    expect(stripMarkdown('See [the portal](https://pmsuryaghar.gov.in) today.')).toBe(
      'See the portal today.',
    );
  });

  it('drops images entirely', () => {
    expect(stripMarkdown('Before ![a chart](https://x.test/c.png) after')).toBe(
      'Before after',
    );
  });

  it('drops fenced code — a payload read aloud is worse than silence', () => {
    expect(stripMarkdown('Here:\n\n```json\n{"kw": 5}\n```\n\nThat is it.')).toBe(
      'Here:\n\nThat is it.',
    );
  });

  it('keeps inline code as its own words', () => {
    expect(stripMarkdown('The `net metering` form')).toBe('The net metering form');
  });

  it('drops list bullets and blockquote markers', () => {
    expect(stripMarkdown('- 1 kW: ₹30,000\n- 2 kW: ₹60,000')).toBe(
      '1 kW: ₹30,000\n2 kW: ₹60,000',
    );
    expect(stripMarkdown('1. First\n2. Second')).toBe('First\nSecond');
    expect(stripMarkdown('> quoted line')).toBe('quoted line');
  });

  it('flattens a table to its cell text', () => {
    const spoken = stripMarkdown('| kW | Subsidy |\n| --- | --- |\n| 1 | ₹30,000 |');
    expect(spoken).not.toContain('|');
    expect(spoken).not.toContain('---');
    expect(spoken).toContain('Subsidy');
    expect(spoken).toContain('₹30,000');
  });

  it('strips the raw HTML of the welcome message', () => {
    expect(stripMarkdown('<p>Hi! I am the assistant.</p>')).toBe(
      'Hi! I am the assistant.',
    );
  });

  it('returns an empty string for input with nothing to say', () => {
    expect(stripMarkdown('')).toBe('');
    expect(stripMarkdown('   \n\n ')).toBe('');
    expect(stripMarkdown('```\nonly code\n```')).toBe('');
  });

  it('leaves ordinary prose untouched', () => {
    const prose = 'A 4.7 kW system costs about ₹3,05,500 before subsidy.';
    expect(stripMarkdown(prose)).toBe(prose);
  });
});
