export function Header() {
  return (
    <header className="h-14 border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-lg">RedTeam Agent</span>
        <span className="text-sm text-muted-foreground">Session: MyApp</span>
      </div>
      <div className="flex items-center gap-2">
        {/* StageProgress will be added in Issue #7 */}
      </div>
    </header>
  )
}
