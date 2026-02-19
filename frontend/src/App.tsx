import { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { SummaryPage } from './components/SummaryPage'
import type { AnalyticsSource } from './lib/api'

type View = 'summary' | Exclude<AnalyticsSource, 'all'>;

function App() {
  const [view, setView] = useState<View>('summary');

  return (
    <div className="min-h-screen bg-background">
      {view === 'summary' ? (
        <SummaryPage onOpenSource={source => setView(source)} />
      ) : (
        <Dashboard source={view} onBack={() => setView('summary')} />
      )}
    </div>
  )
}

export default App
