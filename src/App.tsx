import { useState } from 'react'
import Canvas from './components/Canvas'
import type { ViewportState } from './types'

function App() {
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    zoom: 1.0,
    gridStep: 50, // Default to 50 units for better visibility
  })

  return (
    <div className="h-screen bg-bg-primary text-text-primary flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border flex-shrink-0">
        <h1 className="text-2xl font-bold text-text-primary">YuDiMath</h1>
        <p className="text-sm text-text-secondary">Linear Algebra & Calculus Visualizer</p>
      </div>
      <div className="flex-1 relative min-h-0">
        <Canvas viewport={viewport} onViewportChange={setViewport} />
      </div>
    </div>
  )
}

export default App

