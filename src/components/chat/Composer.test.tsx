import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from '@/components/chat/Composer';
import type { VoiceApi } from '@/hooks/useChat';

const voice = (over: Partial<VoiceApi> = {}): VoiceApi => ({
  isSupported: true,
  isRecording: false,
  permission: 'prompt',
  isTranscribing: false,
  isSpeaking: false,
  isSynthesising: false,
  error: null,
  toggleRecording: vi.fn(),
  cancelRecording: vi.fn(),
  toggleVoiceOutput: vi.fn(),
  syncPermission: vi.fn().mockResolvedValue(undefined),
  ...over,
});

describe('Composer', () => {
  it('sends on Enter and clears the field', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);

    const field = screen.getByRole('textbox', { name: 'Message' });
    await user.type(field, 'What is the subsidy?{Enter}');

    expect(onSend).toHaveBeenCalledExactlyOnceWith('What is the subsidy?');
    expect(field).toHaveValue('');
  });

  it('inserts a newline on Shift+Enter and sends nothing', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);

    const field = screen.getByRole('textbox', { name: 'Message' });
    await user.type(field, 'first line{Shift>}{Enter}{/Shift}second line');

    expect(onSend).not.toHaveBeenCalled();
    expect(field).toHaveValue('first line\nsecond line');
  });

  it('does not send an IME commit keystroke mid-word', async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const field = screen.getByRole('textbox', { name: 'Message' });

    await userEvent.type(field, 'こんにち');
    // What a candidate window's Enter looks like: composing, not confirming.
    // `isComposing` is read-only on the event, so it is defined on the instance.
    const commit = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(commit, 'isComposing', { value: true });
    field.dispatchEvent(commit);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('will not send blank or whitespace-only input', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);

    await user.type(screen.getByRole('textbox', { name: 'Message' }), '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('swaps Send for Stop while a turn is in flight', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<Composer onSend={vi.fn()} onStop={onStop} isBusy />);

    expect(
      screen.queryByRole('button', { name: 'Send message' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop generating' }));
    expect(onStop).toHaveBeenCalled();
  });

  it('hides the voice controls entirely when no voice API is given', () => {
    render(<Composer onSend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /record/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /replies aloud/i }),
    ).not.toBeInTheDocument();
  });

  it('hides the microphone where the browser cannot record', () => {
    render(<Composer onSend={vi.fn()} voice={voice({ isSupported: false })} />);
    expect(
      screen.queryByRole('button', { name: 'Record a question' }),
    ).not.toBeInTheDocument();
    // The speaker is unaffected — playback does not need a microphone.
    expect(screen.getByRole('button', { name: /replies aloud/i })).toBeInTheDocument();
  });

  it('disables the microphone once permission has been denied', () => {
    render(<Composer onSend={vi.fn()} voice={voice({ permission: 'denied' })} />);
    const mic = screen.getByRole('button', { name: 'Record a question' });
    expect(mic).toBeDisabled();
    expect(mic).toHaveAttribute('title', expect.stringContaining('blocked'));
  });

  it('offers stop and discard while recording, and says so', async () => {
    const user = userEvent.setup();
    const api = voice({ isRecording: true });
    render(<Composer onSend={vi.fn()} voice={api} />);

    expect(screen.getByText(/Recording/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop recording and send' }));
    expect(api.toggleRecording).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Discard recording' }));
    expect(api.cancelRecording).toHaveBeenCalled();
  });

  it('discards a recording on Escape', async () => {
    const user = userEvent.setup();
    const api = voice({ isRecording: true });
    render(<Composer onSend={vi.fn()} voice={api} />);

    await user.type(screen.getByRole('textbox', { name: 'Message' }), '{Escape}');
    expect(api.cancelRecording).toHaveBeenCalled();
  });

  it('shows a voice error where the customer will see it', () => {
    render(
      <Composer
        onSend={vi.fn()}
        voice={voice({ error: 'Microphone access was blocked.' })}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Microphone access was blocked.',
    );
  });
});
