import { useAgentStore } from '@/stores/agentStore';

export function useAgentState() {
  const connectionStatus = useAgentStore((s) => s.connectionStatus);
  const session = useAgentStore((s) => s.session);
  const run = useAgentStore((s) => s.run);
  const currentStage = useAgentStore((s) => s.currentStage);
  const stageMessage = useAgentStore((s) => s.stageMessage);
  const exploitChain = useAgentStore((s) => s.exploitChain);
  const remediationChain = useAgentStore((s) => s.remediationChain);
  const exploitsSuccessful = useAgentStore((s) => s.exploitsSuccessful);
  const fixesApplied = useAgentStore((s) => s.fixesApplied);
  const prUrl = useAgentStore((s) => s.prUrl);

  const isConnected = connectionStatus === 'connected';
  const isRunning = currentStage !== null && currentStage !== 'completed' && currentStage !== 'failed';
  const isCompleted = currentStage === 'completed';
  const isFailed = currentStage === 'failed';

  return {
    connectionStatus,
    session,
    run,
    currentStage,
    stageMessage,
    exploitChain,
    remediationChain,
    exploitsSuccessful,
    fixesApplied,
    prUrl,
    isConnected,
    isRunning,
    isCompleted,
    isFailed,
  };
}
