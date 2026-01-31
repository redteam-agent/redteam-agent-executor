import { Shield } from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';
import { StageProgress } from '@/components/agent/StageProgress';

export function Header() {
  const session = useAgentStore((s) => s.session);

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-red-500" />
          <span className="font-semibold text-lg">RedTeam Agent</span>
        </div>
        {session && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{session.github_org}</span>
            <span className="mx-1">/</span>
            <span>{session.github_repo}</span>
          </div>
        )}
      </div>
      <StageProgress />
    </header>
  );
}
