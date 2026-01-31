import { useAgentStore } from '@/stores/agentStore';

export function useTerminal() {
  const terminalLines = useAgentStore((s) => s.terminalLines);
  const addTerminalLine = useAgentStore((s) => s.addTerminalLine);
  const updateTerminalLine = useAgentStore((s) => s.updateTerminalLine);
  const clearTerminal = useAgentStore((s) => s.clearTerminal);

  const writeCommand = (content: string, stepNumber?: number) => {
    addTerminalLine({
      type: 'command',
      content,
      stepNumber,
    });
  };

  const writeOutput = (content: string, stepNumber?: number) => {
    addTerminalLine({
      type: 'output',
      content,
      stepNumber,
    });
  };

  const writeError = (content: string, stepNumber?: number) => {
    addTerminalLine({
      type: 'error',
      content,
      stepNumber,
    });
  };

  const writeStatus = (content: string) => {
    addTerminalLine({
      type: 'status',
      content,
    });
  };

  const getFullOutput = (): string => {
    return terminalLines.map((line) => line.content).join('\n');
  };

  return {
    lines: terminalLines,
    writeCommand,
    writeOutput,
    writeError,
    writeStatus,
    updateLine: updateTerminalLine,
    clear: clearTerminal,
    getFullOutput,
  };
}
