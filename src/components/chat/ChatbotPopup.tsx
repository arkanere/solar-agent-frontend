import { useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatBox, type ChatBoxProps } from '@/components/chat/ChatBox';

/**
 * The chat as a launcher plus a modal, for a page whose main content is not the
 * conversation.
 *
 * It takes the chat handlers rather than calling `useChat` itself, so a host
 * showing the chat in more than one place drives both from a single hook. Two
 * instances would each hold their own `AbortController` and their own speech
 * player: Stop in one would not reach a turn started by the other, and a reply
 * could be read aloud twice.
 *
 * The transcript itself lives in the store, so closing and reopening resumes
 * exactly where the customer left off even though this subtree unmounts.
 */
export type ChatbotPopupProps = Omit<ChatBoxProps, 'onClose'>;

export function ChatbotPopup(props: ChatbotPopupProps) {
  const [open, setOpen] = useState(false);
  /**
   * Whether the customer has closed the chat themselves. Nothing opens the
   * popup on its own today, but a dismissal is the one signal that has to
   * survive if anything ever does — being reopened by a page you have just
   * closed is the behaviour people install blockers for.
   */
  const dismissed = useRef(false);

  const change = (next: boolean) => {
    if (!next) dismissed.current = true;
    setOpen(next);
  };

  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg"
      >
        <MessageCircle />
        Ask about solar
      </Button>

      <Dialog open={open} onOpenChange={change}>
        {/* Radix brings the focus trap, Escape handling and the scroll lock.
            The padding and small max-width the shadcn default carries are
            dropped: this is a whole chat, not a confirmation box, and on a
            phone it takes the entire screen. */}
        <DialogContent
          showCloseButton={false}
          className="h-dvh max-h-dvh w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 sm:h-[85vh] sm:max-w-4xl sm:rounded-xl"
        >
          <DialogTitle className="sr-only">Solar Vipani Assistant</DialogTitle>
          <DialogDescription className="sr-only">
            Ask about solar costs, subsidies and system sizing.
          </DialogDescription>

          <ChatBox {...props} onClose={() => change(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
