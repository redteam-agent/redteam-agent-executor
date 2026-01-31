import { Group, Panel, Separator } from 'react-resizable-panels'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { TerminalPanel } from '@/components/terminal/TerminalPanel'

const STORAGE_KEY = 'panel-sizes'

function saveSizes(sizes: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes))
}

function loadSizes(): Record<string, number> | undefined {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return undefined
    }
  }
  return undefined
}

export function SplitPane() {
  const savedSizes = loadSizes()

  return (
    <Group
      orientation="horizontal"
      onLayoutChanged={saveSizes}
      defaultLayout={savedSizes}
    >
      <Panel
        id="chat"
        defaultSize="50%"
        minSize="30%"
      >
        <ChatPanel />
      </Panel>
      <Separator className="w-1 bg-border hover:bg-primary transition-colors" />
      <Panel
        id="terminal"
        defaultSize="50%"
        minSize="30%"
      >
        <TerminalPanel />
      </Panel>
    </Group>
  )
}
