import { useState, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatStore } from '@/stores/chatStore';

export function ChatInput() {
  const [input, setInput] = useState('');
  const addMessage = useChatStore((s) => s.addMessage);

  const handleSend = () => {
    if (!input.trim()) return;

    addMessage({
      role: 'user',
      content: input.trim(),
    });

    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        className="flex-1"
      />
      <Button onClick={handleSend} size="icon" disabled={!input.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
