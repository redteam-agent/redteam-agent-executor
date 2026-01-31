import { useAgentStore } from '@/stores/agentStore'
import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/types'

const STAGES: { key: PipelineStage; label: string; shortLabel: string }[] = [
  { key: 'processing_documents', label: 'Processing', shortLabel: 'Proc' },
  { key: 'crawling_vulnerabilities', label: 'Crawling', shortLabel: 'Crawl' },
  { key: 'scanning', label: 'Scanning', shortLabel: 'Scan' },
  { key: 'exploiting', label: 'Exploiting', shortLabel: 'Expl' },
  { key: 'remediating', label: 'Remediating', shortLabel: 'Rem' },
  { key: 'creating_pr', label: 'Creating PR', shortLabel: 'PR' },
  { key: 'completed', label: 'Complete', shortLabel: 'Done' },
]

type StageStatus = 'completed' | 'current' | 'pending' | 'failed'

function getStageStatus(index: number, currentIndex: number): StageStatus {
  if (index < currentIndex) return 'completed'
  if (index === currentIndex) return 'current'
  return 'pending'
}

interface StageIndicatorProps {
  stage: { key: PipelineStage; label: string; shortLabel: string }
  status: StageStatus
  isCurrent: boolean
}

function StageIndicator({ stage, status, isCurrent }: StageIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      <div
        className={cn(
          'w-2 h-2 rounded-full transition-all',
          status === 'completed' && 'bg-green-500',
          status === 'current' && 'bg-blue-500 animate-pulse',
          status === 'pending' && 'bg-gray-500',
          status === 'failed' && 'bg-red-500'
        )}
      />
      {isCurrent && (
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {stage.label}
        </span>
      )}
    </div>
  )
}

export function StageProgress() {
  const currentStage = useAgentStore((s) => s.currentStage)
  const stageMessage = useAgentStore((s) => s.stageMessage)

  const currentIndex = STAGES.findIndex((s) => s.key === currentStage)

  if (!currentStage) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Ready</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => (
          <StageIndicator
            key={stage.key}
            stage={stage}
            status={getStageStatus(i, currentIndex)}
            isCurrent={i === currentIndex}
          />
        ))}
      </div>
      {stageMessage && (
        <span className="text-sm text-muted-foreground ml-2 truncate max-w-[200px]">
          {stageMessage}
        </span>
      )}
    </div>
  )
}
