import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'

export function ChatPanel() {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-10 border-b flex items-center px-4">
        <span className="text-sm text-muted-foreground">Chat</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatMessages />
      </div>
      <div className="border-t p-4">
        <ChatInput />
      </div>
    </div>
  )
}
