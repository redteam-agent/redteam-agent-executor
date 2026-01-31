import './App.css'

function App() {
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <header className="h-14 border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-lg">RedTeam Agent</span>
        </div>
      </header>
      <main className="flex-1 overflow-hidden flex items-center justify-center">
        <p className="text-muted-foreground">Project initialized. Ready for development.</p>
      </main>
    </div>
  )
}

export default App
