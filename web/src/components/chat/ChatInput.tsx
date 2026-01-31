import { useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ChatInput() {
  const [input, setInput] = useState('')
  const sendMessage = useChatStore((s) => s.sendMessage)
  const isLoading = useChatStore((s) => s.isLoading)

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return

    sendMessage(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={isLoading}
        className="flex-1"
      />
      <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
