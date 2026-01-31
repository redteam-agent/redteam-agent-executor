import { Copy, Download, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentStore } from '@/stores/agentStore';
import { useToast } from '@/hooks/use-toast';

export function TerminalHeader() {
  const terminalLines = useAgentStore((s) => s.terminalLines);
  const { toast } = useToast();

  const copyAll = async () => {
    const text = terminalLines.map((line) => line.content).join('\n');
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Terminal output copied to clipboard',
    });
  };

  const downloadLog = () => {
    const text = terminalLines.map((line) => line.content).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redteam-agent-${new Date().toISOString()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-10 border-b border-white/10 flex items-center justify-between px-4 bg-[#1a1a2e]">
      <div className="flex items-center gap-2 text-white/60">
        <Terminal className="h-4 w-4" />
        <span className="text-sm">Terminal Output</span>
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={copyAll}
          className="h-7 px-2 text-white/60 hover:text-white hover:bg-white/10"
          disabled={terminalLines.length === 0}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={downloadLog}
          className="h-7 px-2 text-white/60 hover:text-white hover:bg-white/10"
          disabled={terminalLines.length === 0}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
