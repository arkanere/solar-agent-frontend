import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatBox } from '@/components/chat/ChatBox';
import { ChatbotPopup } from '@/components/chat/ChatbotPopup';
import { useChat } from '@/hooks/useChat';
import { useTheme } from '@/hooks/useTheme';

/**
 * Demo host page: the chat in both of the shapes it ships in.
 *
 * One `useChat` drives both mounts. The hook holds the in-flight request and the
 * voice resources, so a second instance would mean Stop in one place not
 * reaching a turn started in the other. The transcript itself is in the store,
 * which both read directly.
 */
export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const chat = useChat();
  const dark = theme === 'dark';

  const handlers = {
    onSend: chat.send,
    onStop: chat.stop,
    onRetry: chat.retry,
    onRegenerate: chat.regenerate,
    onReset: chat.reset,
    voice: chat.voice,
  };

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-background p-4 text-foreground sm:p-8">
      <div className="flex w-full max-w-4xl items-center justify-between">
        <h1 className="text-lg font-semibold">Solar Vipani</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-pressed={dark}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun /> : <Moon />}
        </Button>
      </div>

      <div className="h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border shadow-sm">
        <ChatBox {...handlers} />
      </div>

      {/* The same conversation in the shape it takes on a marketing page. */}
      <ChatbotPopup {...handlers} />
    </main>
  );
}
