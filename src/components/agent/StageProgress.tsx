import { cn } from '@/lib/utils';
import { useAgentStore } from '@/stores/agentStore';
import type { PipelineStage } from '@/types';

const STAGES: { key: PipelineStage; label: string; shortLabel: string }[] = [
  { key: 'processing_documents', label: 'Processing', shortLabel: 'Proc' },
  { key: 'crawling_vulnerabilities', label: 'Crawling', shortLabel: 'Crawl' },
  { key: 'scanning', label: 'Scanning', shortLabel: 'Scan' },
  { key: 'exploiting', label: 'Exploiting', shortLabel: 'Exploit' },
  { key: 'remediating', label: 'Remediating', shortLabel: 'Remed' },
  { key: 'creating_pr', label: 'Creating PR', shortLabel: 'PR' },
  { key: 'completed', label: 'Complete', shortLabel: 'Done' },
];

type StageStatus = 'completed' | 'current' | 'pending' | 'failed';

function getStageStatus(
  index: number,
  currentIndex: number,
  currentStage: PipelineStage | null
): StageStatus {
  if (currentStage === 'failed') {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'failed';
    return 'pending';
  }
  if (index < currentIndex) return 'completed';
  if (index === currentIndex) return 'current';
  return 'pending';
}

interface StageIndicatorProps {
  stage: { key: PipelineStage; label: string; shortLabel: string };
  status: StageStatus;
  isCurrent: boolean;
}

function StageIndicator({ stage, status, isCurrent }: StageIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      <div
        className={cn(
          'w-2 h-2 rounded-full transition-colors',
          status === 'completed' && 'bg-green-500',
          status === 'current' && 'bg-blue-500 animate-pulse',
          status === 'pending' && 'bg-muted-foreground/30',
          status === 'failed' && 'bg-red-500'
        )}
      />
      {isCurrent && (
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {stage.label}
        </span>
      )}
    </div>
  );
}

export function StageProgress() {
  const currentStage = useAgentStore((s) => s.currentStage);
  const stageMessage = useAgentStore((s) => s.stageMessage);

  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);

  if (!currentStage) {
    return (
      <div className="text-sm text-muted-foreground">
        Waiting to start...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => (
          <StageIndicator
            key={stage.key}
            stage={stage}
            status={getStageStatus(i, currentIndex, currentStage)}
            isCurrent={i === currentIndex}
          />
        ))}
      </div>
      {stageMessage && (
        <span className="text-sm text-muted-foreground ml-2 hidden md:inline truncate max-w-[200px]">
          {stageMessage}
        </span>
      )}
    </div>
  );
}
