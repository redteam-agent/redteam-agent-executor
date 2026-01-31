import { TerminalHeader } from './TerminalHeader';
import { TerminalOutput } from './TerminalOutput';

export function TerminalPanel() {
  return (
    <div className="h-full flex flex-col bg-[#1a1a2e]">
      <TerminalHeader />
      <div className="flex-1 overflow-hidden">
        <TerminalOutput />
      </div>
    </div>
  );
}
