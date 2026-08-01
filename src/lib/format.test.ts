import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatLakh,
  formatNumber,
  formatThousand,
  formatTime,
  humanizeToolName,
  stripHtml,
} from '@/lib/format';
import { safeStringify } from '@/lib/json';

const EMPTY = '—';

describe('money and numbers', () => {
  it('groups rupees the Indian way, without paise', () => {
    expect(formatCurrency(125000)).toBe('₹1,25,000');
    expect(formatCurrency('305500')).toBe('₹3,05,500');
    expect(formatCurrency(1234.56)).toBe('₹1,235');
  });

  it('groups plain numbers the same way', () => {
    expect(formatNumber(1234567)).toBe('12,34,567');
    expect(formatNumber(4.75, 1)).toBe('4.8');
  });

  it('renders compact forms', () => {
    expect(formatLakh(250000)).toBe('₹2.5 L');
    expect(formatThousand(18500)).toBe('₹18.5 K');
  });

  // Tool payloads are loosely typed; ₹NaN in a quotation is worse than a blank.
  it.each([null, undefined, '', 'not a number', NaN, Infinity])(
    'falls back to an em dash for %j',
    (value) => {
      expect(formatCurrency(value as never)).toBe(EMPTY);
      expect(formatNumber(value as never)).toBe(EMPTY);
      expect(formatLakh(value as never)).toBe(EMPTY);
      expect(formatThousand(value as never)).toBe(EMPTY);
    },
  );

  it('keeps zero, which is a real amount', () => {
    expect(formatCurrency(0)).toBe('₹0');
    expect(formatNumber(0)).toBe('0');
  });
});

describe('humanizeToolName', () => {
  it('title-cases the words', () => {
    expect(humanizeToolName('generate_quotation')).toBe('Generate Quotation');
  });

  it('keeps acronyms upper-case, so CAD does not read as "Cad"', () => {
    expect(humanizeToolName('generate_cad_drawing')).toBe('Generate CAD Drawing');
    expect(humanizeToolName('calculate_roi')).toBe('Calculate ROI');
  });

  it('tolerates stray underscores', () => {
    expect(humanizeToolName('__book__site_visit_')).toBe('Book Site Visit');
  });
});

describe('stripHtml', () => {
  it('flattens markup and decodes entities', () => {
    expect(stripHtml('<p>Costs &amp; subsidies</p>')).toBe('Costs & subsidies');
  });

  it('turns block boundaries into newlines rather than running text together', () => {
    expect(stripHtml('<p>one</p><p>two</p>')).toBe('one\ntwo');
    expect(stripHtml('a<br>b')).toBe('a\nb');
  });

  it('leaves markdown alone — it is readable as source', () => {
    expect(stripHtml('Up to **₹78,000** in [subsidy](https://x.test)')).toBe(
      'Up to **₹78,000** in [subsidy](https://x.test)',
    );
  });

  it('does not execute a script, and does not carry its body to the clipboard', () => {
    // `DOMParser` builds an inert document, so nothing here runs; the script
    // element's text does not reach the flattened output either.
    expect(stripHtml('<script>alert(1)</script>hello')).toBe('hello');
  });
});

describe('formatTime', () => {
  it('renders a short local wall-clock time', () => {
    // Asserting the shape, not a fixed string: the CI timezone is not ours.
    expect(formatTime(Date.UTC(2026, 7, 1, 10, 7))).toMatch(/^\d{1,2}:\d{2}\s?(am|pm)$/i);
  });
});

describe('safeStringify', () => {
  it('formats an ordinary payload', () => {
    expect(safeStringify({ hours: 6 })).toBe('{\n  "hours": 6\n}');
  });

  it('survives a cycle', () => {
    const cyclic: Record<string, unknown> = { hours: 6 };
    cyclic.self = cyclic;
    expect(safeStringify(cyclic)).toContain('[Circular]');
  });

  it('survives a BigInt, which JSON.stringify throws on', () => {
    expect(safeStringify({ n: 10n })).toContain('"10"');
  });
});
