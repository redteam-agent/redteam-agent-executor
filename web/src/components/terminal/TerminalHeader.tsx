import { Copy, Download } from 'lucide-react'
import { useAgentStore } from '@/stores/agentStore'
import { Button } from '@/components/ui/button'

export function TerminalHeader() {
  const terminalLines = useAgentStore((s) => s.terminalLines)

  const getTerminalText = () => {
    return terminalLines
      .map((line) => {
        const prefix = line.type === 'command' ? '$ ' : ''
        return prefix + line.content
      })
      .join('\n')
  }

  const copyAll = async () => {
    const text = getTerminalText()
    await navigator.clipboard.writeText(text)
  }

  const downloadLog = () => {
    const text = getTerminalText()
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `terminal-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-10 border-b border-white/10 flex items-center justify-between px-4">
      <span className="text-sm text-white/60">Terminal Output</span>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={copyAll}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={downloadLog}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
