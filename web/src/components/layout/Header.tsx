import { StageProgress } from '@/components/agent/StageProgress'
import { useAgentStore } from '@/stores/agentStore'

export function Header() {
  const session = useAgentStore((s) => s.session)

  return (
    <header className="h-14 border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-lg">RedTeam Agent</span>
        {session && (
          <span className="text-sm text-muted-foreground">
            Session: {session.github_repo}
          </span>
        )}
      </div>
      <StageProgress />
    </header>
  )
}
