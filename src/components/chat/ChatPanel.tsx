import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

export function ChatPanel() {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-hidden">
        <ChatMessages />
      </div>
      <div className="border-t border-border p-4">
        <ChatInput />
      </div>
    </div>
  );
}
