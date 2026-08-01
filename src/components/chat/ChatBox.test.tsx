import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatBox } from '@/components/chat/ChatBox';
import { useChatStore } from '@/store/chatStore';
import type { ChatMessage } from '@/lib/types';

const seed = (messages: ChatMessage[]) => useChatStore.setState({ messages });

beforeEach(() => {
  localStorage.clear();
  useChatStore.getState().reset();
});

describe('ChatBox', () => {
  it('offers the starter prompts until the customer has spoken', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatBox onSend={onSend} />);

    const chip = screen.getByRole('button', { name: 'How much can I save with solar?' });
    await user.click(chip);
    expect(onSend).toHaveBeenCalledExactlyOnceWith('How much can I save with solar?');

    // The store is what hides them, so simulate the turn landing.
    act(() =>
      seed([
        ...useChatStore.getState().messages,
        { role: 'user', content: 'How much can I save with solar?', timestamp: 2 },
      ]),
    );
    expect(chip).not.toBeInTheDocument();
  });

  it('marks the history as a polite live region, busy while loading', () => {
    const { rerender } = render(<ChatBox onSend={vi.fn()} />);
    const log = screen.getByRole('log', { name: 'Conversation' });
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-atomic', 'false');
    expect(log).toHaveAttribute('aria-busy', 'false');

    useChatStore.getState().setLoading(true);
    rerender(<ChatBox onSend={vi.fn()} />);
    expect(screen.getByRole('log', { name: 'Conversation' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('shows the typing indicator only before the first delta', () => {
    useChatStore.setState({ isLoading: true, isStreaming: false });
    const { rerender } = render(<ChatBox onSend={vi.fn()} />);
    expect(screen.getByLabelText('Assistant is typing')).toBeInTheDocument();

    useChatStore.setState({ isStreaming: true });
    rerender(<ChatBox onSend={vi.fn()} />);
    expect(screen.queryByLabelText('Assistant is typing')).not.toBeInTheDocument();
  });

  it('offers Retry on a failed turn and passes its index up', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    seed([
      { role: 'user', content: 'a question', timestamp: 1 },
      {
        role: 'assistant',
        content: 'Sorry — something went wrong.',
        timestamp: 2,
        error: true,
        userMessage: 'a question',
      },
    ]);

    render(<ChatBox onSend={vi.fn()} onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('offers Regenerate on the newest reply only', () => {
    seed([
      { role: 'user', content: 'first', timestamp: 1 },
      { role: 'assistant', content: 'older reply', timestamp: 2 },
      { role: 'user', content: 'second', timestamp: 3 },
      { role: 'assistant', content: 'newest reply', timestamp: 4 },
    ]);

    render(<ChatBox onSend={vi.fn()} onRegenerate={vi.fn()} />);
    // Rewriting an older reply would strand every turn that followed it.
    expect(screen.getAllByRole('button', { name: 'Regenerate reply' })).toHaveLength(1);
  });

  it('renders no affordance for a handler the host did not supply', () => {
    seed([
      { role: 'user', content: 'a question', timestamp: 1 },
      { role: 'assistant', content: 'failed', timestamp: 2, error: true },
    ]);
    render(<ChatBox onSend={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Regenerate reply' }),
    ).not.toBeInTheDocument();
  });

  it('labels a stopped reply', () => {
    seed([{ role: 'assistant', content: 'half an answer', timestamp: 1, stopped: true }]);
    render(<ChatBox onSend={vi.fn()} />);
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('prefers the host reset handler, which can also abort a live turn', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ChatBox onSend={vi.fn()} onReset={onReset} />);

    await user.click(screen.getByRole('button', { name: /clear conversation/i }));
    expect(onReset).toHaveBeenCalled();
  });

  it('copies the conversation as plain text with citations', async () => {
    const user = userEvent.setup();
    // After `setup()`, which installs a clipboard stub of its own. It is a
    // getter-only property in jsdom, hence defineProperty rather than assignment.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    seed([
      { role: 'assistant', content: '<p>Hi there</p>', timestamp: 1 },
      { role: 'user', content: 'subsidies?', timestamp: 2 },
      {
        role: 'assistant',
        content: 'Up to **₹78,000**.',
        timestamp: 3,
        sources: [{ title: 'PM Surya Ghar', url: 'https://x.test' }],
      },
    ]);

    render(<ChatBox onSend={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Copy conversation' }));

    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('Assistant: Hi there'); // HTML flattened
    expect(text).toContain('You: subsidies?');
    expect(text).toContain('- PM Surya Ghar: https://x.test');
    expect(text).not.toContain('<p>');
  });

  it('shows the close button only when the host can close it', () => {
    const { rerender } = render(<ChatBox onSend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Close chat' })).not.toBeInTheDocument();

    rerender(<ChatBox onSend={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Close chat' })).toBeInTheDocument();
  });
});
