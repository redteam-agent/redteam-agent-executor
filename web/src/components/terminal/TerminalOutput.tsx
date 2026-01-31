import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useAgentStore } from '@/stores/agentStore'
import type { TerminalLine } from '@/types'
import '@xterm/xterm/css/xterm.css'

function writeLine(terminal: Terminal, line: TerminalLine) {
  switch (line.type) {
    case 'command':
      terminal.writeln(`\x1b[32m$\x1b[0m ${line.content}`)
      break
    case 'output':
      terminal.writeln(line.content)
      break
    case 'error':
      terminal.writeln(`\x1b[31m${line.content}\x1b[0m`)
      break
    case 'status':
      if (line.content.includes('SUCCESS')) {
        terminal.writeln(`\x1b[32m${line.content}\x1b[0m`)
      } else if (line.content.includes('FAILED') || line.content.includes('ERROR')) {
        terminal.writeln(`\x1b[31m${line.content}\x1b[0m`)
      } else {
        terminal.writeln(`\x1b[33m${line.content}\x1b[0m`)
      }
      break
  }
}

export function TerminalOutput() {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const lastLineCountRef = useRef(0)
  const terminalLines = useAgentStore((s) => s.terminalLines)

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#eee',
        cursor: '#eee',
        cursorAccent: '#1a1a2e',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#1a1a2e',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
      },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: false,
      disableStdin: true, // Read-only
      scrollback: 10000,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Handle resize
    const observer = new ResizeObserver(() => {
      fitAddon.fit()
    })
    observer.observe(containerRef.current)

    return () => {
      terminal.dispose()
      observer.disconnect()
    }
  }, [])

  // Write new lines as they arrive
  useEffect(() => {
    if (!terminalRef.current) return

    // Only write lines that are new since last render
    const newLines = terminalLines.slice(lastLineCountRef.current)
    newLines.forEach((line) => {
      writeLine(terminalRef.current!, line)
    })
    lastLineCountRef.current = terminalLines.length
  }, [terminalLines])

  return <div ref={containerRef} className="h-full w-full" />
}
