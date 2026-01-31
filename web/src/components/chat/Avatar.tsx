import { cn } from '@/lib/utils'
import { User, Bot, Settings } from 'lucide-react'

interface AvatarProps {
  role: 'user' | 'agent' | 'system'
  className?: string
}

export function Avatar({ role, className }: AvatarProps) {
  const icons = {
    user: User,
    agent: Bot,
    system: Settings,
  }
  const colors = {
    user: 'bg-blue-600',
    agent: 'bg-green-600',
    system: 'bg-gray-600',
  }

  const Icon = icons[role]

  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        colors[role],
        className
      )}
    >
      <Icon className="w-4 h-4 text-white" />
    </div>
  )
}
