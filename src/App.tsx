import { Header } from './components/layout/Header';
import { SplitPane } from './components/layout/SplitPane';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 overflow-hidden">
        <SplitPane />
      </main>
      <Toaster />
    </div>
  );
}

export default App;
