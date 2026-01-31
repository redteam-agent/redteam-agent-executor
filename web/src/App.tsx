import { Header } from '@/components/layout/Header'
import { SplitPane } from '@/components/layout/SplitPane'
import './App.css'

function App() {
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 overflow-hidden">
        <SplitPane />
      </main>
    </div>
  )
}

export default App
