export function TerminalPanel() {
  return (
    <div className="h-full flex flex-col bg-[#1a1a2e]">
      <div className="h-10 border-b border-white/10 flex items-center justify-between px-4">
        <span className="text-sm text-white/60">Terminal Output</span>
        <div className="flex gap-2">
          {/* Copy/Download buttons will be added in Issue #6 */}
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-4 font-mono text-sm text-white/80">
        <p>$ Terminal output will appear here...</p>
      </div>
    </div>
  )
}
