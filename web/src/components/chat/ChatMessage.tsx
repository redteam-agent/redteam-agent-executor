import ReactMarkdown from 'react-markdown'
import { Avatar } from './Avatar'
import { ReasoningDisplay } from './ReasoningDisplay'
import type { ChatMessage as ChatMessageType } from '@/types'

interface ChatMessageProps {
  message: ChatMessageType
  stepNumber?: number
}

export function ChatMessage({ message, stepNumber }: ChatMessageProps) {
  return (
    <div className="flex gap-3">
      <Avatar role={message.role} />
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.reasoning && stepNumber && (
          <ReasoningDisplay stepNumber={stepNumber} reasoning={message.reasoning} />
        )}
      </div>
    </div>
  )
}
