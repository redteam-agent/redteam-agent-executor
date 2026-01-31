import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useAgentStore } from '@/stores/agentStore';
import type { TerminalLine } from '@/types';
import '@xterm/xterm/css/xterm.css';

function writeLine(terminal: Terminal, line: TerminalLine) {
  switch (line.type) {
    case 'command':
      terminal.writeln(`\x1b[32m$\x1b[0m ${line.content}`);
      break;
    case 'output':
      terminal.writeln(line.content);
      break;
    case 'error':
      terminal.writeln(`\x1b[31m${line.content}\x1b[0m`);
      break;
    case 'status':
      if (line.content.includes('SUCCESS')) {
        terminal.writeln(`\x1b[32m${line.content}\x1b[0m`);
      } else if (line.content.includes('FAILED') || line.content.includes('ERROR')) {
        terminal.writeln(`\x1b[31m${line.content}\x1b[0m`);
      } else {
        terminal.writeln(`\x1b[33m${line.content}\x1b[0m`);
      }
      break;
  }
}

export function TerminalOutput() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastLineCountRef = useRef(0);
  const terminalLines = useAgentStore((s) => s.terminalLines);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#eee',
        cursor: '#eee',
        cursorAccent: '#1a1a2e',
        selectionBackground: '#404060',
        black: '#1a1a2e',
        red: '#ff6b6b',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#eee',
      },
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: false,
      disableStdin: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    // Write welcome message
    terminal.writeln('\x1b[36m=== RedTeam Agent Terminal ===\x1b[0m');
    terminal.writeln('');

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, []);

  // Write new lines as they arrive
  useEffect(() => {
    if (!terminalRef.current) return;

    const newLines = terminalLines.slice(lastLineCountRef.current);
    for (const line of newLines) {
      writeLine(terminalRef.current, line);
    }
    lastLineCountRef.current = terminalLines.length;
  }, [terminalLines]);

  return <div ref={containerRef} className="h-full w-full" />;
}
