import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { TerminalPanel } from '@/components/terminal/TerminalPanel';

export function SplitPane() {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={50} minSize={30}>
        <ChatPanel />
      </Panel>
      <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />
      <Panel defaultSize={50} minSize={30}>
        <TerminalPanel />
      </Panel>
    </PanelGroup>
  );
}
