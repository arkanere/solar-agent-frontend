import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatBox } from '@/components/chat/ChatBox';
import { useChat } from '@/hooks/useChat';

// Demo host page. Phase 8 adds the popup mount alongside this one.
export default function App() {
  // Theming keys off a `.dark` class on <html>, matching the Svelte app. A full
  // toggle with persistence and system-preference following lands in Phase 10.
  const [dark, setDark] = useState(false);
  const { send, stop, retry, regenerate, reset, voice } = useChat();

  const toggleTheme = () => {
    setDark((current) => {
      document.documentElement.classList.toggle('dark', !current);
      return !current;
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-background p-4 text-foreground sm:p-8">
      <div className="flex w-full max-w-4xl items-center justify-between">
        <h1 className="text-lg font-semibold">Solar Vipani</h1>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-pressed={dark}>
          {dark ? <Sun /> : <Moon />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      <div className="h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border shadow-sm">
        <ChatBox
          onSend={send}
          onStop={stop}
          onRetry={retry}
          onRegenerate={regenerate}
          onReset={reset}
          voice={voice}
        />
      </div>
    </main>
  );
}
