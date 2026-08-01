import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolResultDisplay } from '@/components/chat/widgets/ToolResultDisplay';
import { useChatStore } from '@/store/chatStore';

beforeEach(() => {
  localStorage.clear();
  useChatStore.getState().reset();
});

describe('ToolResultDisplay — dispatch', () => {
  it.each([
    ['generate_quotation', { quotation_number: 'SQ-1' }, 'Quotation'],
    ['calculate_roi', { payback_period_years: 4.8 }, 'Return on investment'],
    ['book_site_visit', { booking_id: 'SV-1' }, 'Site visit booked'],
    ['calculate_system_size', { recommended_system_size_kw: 4.7 }, 'Recommended system'],
    ['check_subsidies', { location: 'Kerala' }, 'Subsidies and incentives'],
    ['generate_cad_drawing', { drawing_id: 'CAD-1' }, 'Preliminary panel layout'],
    ['search_knowledge_base', { context: 'Tier-1 panels.' }, 'From our knowledge base'],
    [
      'offer_lead_form',
      { title: 'Get Your Solar Consultation' },
      'Get Your Solar Consultation',
    ],
  ])('renders the %s widget', (name, result, heading) => {
    render(<ToolResultDisplay name={name} result={result} />);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('falls back to the generic widget for an unknown tool', () => {
    render(<ToolResultDisplay name="estimate_battery_backup" result={{ hours: 6 }} />);
    expect(
      screen.getByRole('heading', { name: 'Estimate Battery Backup' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/"hours": 6/)).toBeInTheDocument();
  });

  it.each(['collect_customer_info', 'scrape_website'])(
    'renders nothing at all for %s',
    (name) => {
      const { container } = render(
        <ToolResultDisplay name={name} result={{ name: 'Asha' }} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('renders nothing when the result is null', () => {
    const { container } = render(
      <ToolResultDisplay name="generate_quotation" result={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('widgets under a thin payload', () => {
  it('renders em dashes rather than NaN or undefined', () => {
    render(<ToolResultDisplay name="generate_quotation" result={{}} />);
    // Nothing crashed, and no field rendered as a JS value leaking through.
    expect(screen.getByRole('heading', { name: 'Quotation' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|undefined|\[object/);
  });

  it('clamps a roof utilisation above 100%', () => {
    render(
      <ToolResultDisplay
        name="generate_cad_drawing"
        result={{ utilization: { percent: '118.4' } }}
      />,
    );
    const bar = screen.getByRole('progressbar', { name: 'Roof area used' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('never puts the CAD drawing into the page', () => {
    const { container } = render(
      <ToolResultDisplay
        name="generate_cad_drawing"
        result={{
          drawing_id: 'CAD-1',
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
          preview_url: 'data:image/svg+xml;base64,PHN2Zy8+',
        }}
      />,
    );

    expect(container.querySelector('svg script')).toBeNull();
    expect(container.querySelector('img, object, embed, iframe')).toBeNull();
    expect(container.innerHTML).not.toContain('data:image/svg+xml');
    // It is offered as a file instead.
    expect(screen.getByRole('button', { name: /svg/i })).toBeInTheDocument();
  });

  it('renders knowledge-base content as text, never as markup', () => {
    const { container } = render(
      <ToolResultDisplay
        name="search_knowledge_base"
        result={{ context: '<b>Bold claim</b> from a scraped page' }}
      />,
    );
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<b>Bold claim</b>');
  });
});

describe('LeadFormCard', () => {
  const renderForm = (prefill = {}) =>
    render(
      <ToolResultDisplay
        name="offer_lead_form"
        result={{ title: 'Get Your Solar Consultation', prefill }}
      />,
    );

  it('prefills from the tool first, then the lead profile', () => {
    useChatStore.getState().setLeadProfile({
      name: 'Profile Name',
      email: 'asha@example.com',
      pincode: '682001',
    });
    renderForm({ name: 'Tool Name', phone: '9876543210' });

    expect(screen.getByLabelText('Name')).toHaveValue('Tool Name');
    expect(screen.getByLabelText('Phone')).toHaveValue('9876543210');
    expect(screen.getByLabelText('Email')).toHaveValue('asha@example.com');
    expect(screen.getByLabelText('PIN code')).toHaveValue('682001');
  });

  it('blocks submission and reports every invalid field', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderForm();

    await user.click(screen.getByRole('button', { name: /request a consultation/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Please enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your phone number.')).toBeInTheDocument();
    expect(screen.getByText('Please choose a consultation type.')).toBeInTheDocument();
  });

  it('confirms with the reference id the server actually returned', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, id: 'MOCK-0007' }), {
          status: 200,
        }),
      ),
    );

    renderForm({
      name: 'Asha Menon',
      phone: '9876543210',
      email: 'asha@example.com',
      pinCode: '682001',
      type: 'Residential - Independent Home',
      comment: 'Looking for 5kW.',
    });
    await user.click(screen.getByRole('button', { name: /request a consultation/i }));

    expect(await screen.findByText('MOCK-0007')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Request received' })).toBeInTheDocument();
    // And the conversation now knows the details, so the agent stops asking.
    expect(useChatStore.getState().leadProfile.phone).toBe('9876543210');
  });

  it('shows a failure and no confirmation when the server refuses', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, error: 'Lead system is down.' }), {
          status: 500,
        }),
      ),
    );

    renderForm({
      name: 'Asha Menon',
      phone: '9876543210',
      email: 'asha@example.com',
      pinCode: '682001',
      type: 'Residential - Independent Home',
      comment: 'Looking for 5kW.',
    });
    await user.click(screen.getByRole('button', { name: /request a consultation/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Lead system is down.');
    // The one thing that must never happen: a confirmation for a lead nobody has.
    expect(screen.queryByText('Request received')).not.toBeInTheDocument();
    expect(useChatStore.getState().leadProfile.phone).toBeNull();
  });
});
