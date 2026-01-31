import { User, Bot, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { ReasoningDisplay } from './ReasoningDisplay';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

function Avatar({ role }: { role: 'user' | 'agent' | 'system' }) {
  const icons = {
    user: User,
    agent: Bot,
    system: Info,
  };
  const Icon = icons[role];
  const colors = {
    user: 'bg-blue-500',
    agent: 'bg-green-500',
    system: 'bg-yellow-500',
  };

  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        colors[role]
      )}
    >
      <Icon className="w-4 h-4 text-white" />
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className="flex gap-3">
      <Avatar role={message.role} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground mb-1 capitalize">
          {message.role}
        </div>
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.reasoning && (
          <ReasoningDisplay reasoning={message.reasoning} />
        )}
      </div>
    </div>
  );
}
