import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Scaffold verification page. Phase 8 replaces this with the real demo host.
// It exists to prove the ported design tokens resolve and that shadcn primitives
// pick up the Solar Vipani palette rather than shadcn's own neutral defaults.
export default function App() {
  // Theming keys off a `.dark` class on <html>, matching the Svelte app. A full
  // toggle with persistence and system-preference following lands in Phase 10.
  const [dark, setDark] = useState(false);

  const toggleTheme = () => {
    setDark((current) => {
      document.documentElement.classList.toggle('dark', !current);
      return !current;
    });
  };

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Solar Agent Frontend</h1>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-pressed={dark}>
            {dark ? <Sun /> : <Moon />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Design tokens</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Badge</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="scaffold-input">Input</Label>
              <Input id="scaffold-input" placeholder="Type something" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="scaffold-textarea">Textarea</Label>
              <Textarea id="scaffold-textarea" placeholder="Type something longer" />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
