import { useEffect, useRef } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { ChatMessage } from './ChatMessage'
import { ScrollArea } from '@/components/ui/scroll-area'

export function ChatMessages() {
  const messages = useChatStore((s) => s.messages)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  // Track if user has scrolled up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50
    isAtBottomRef.current = isAtBottom
  }

  // Auto-scroll to bottom when new messages arrive (if user hasn't scrolled up)
  useEffect(() => {
    if (scrollRef.current && isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Start a security assessment by sending a message...
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="space-y-4 p-4"
      >
        {messages.map((msg, index) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            stepNumber={msg.role === 'agent' ? index : undefined}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
