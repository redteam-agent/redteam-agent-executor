export function ChatPanel() {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-10 border-b flex items-center px-4">
        <span className="text-sm text-muted-foreground">Chat</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-muted-foreground">Chat messages will appear here...</p>
      </div>
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-md border bg-input text-foreground"
          />
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
