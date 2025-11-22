import { useState } from 'react'
import Canvas from './components/Canvas'
import GridStepSelector from './components/GridStepSelector'
import type { ViewportState, CoordinateFrame } from './types'

function App() {
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    zoom: 50.0, // Default: 1 unit = 50px
    gridStep: 1, // Default to 1 unit - the fundamental coordinate system step
  })

  const [frames, setFrames] = useState<CoordinateFrame[]>([])
  const [isDrawing, setIsDrawing] = useState(false)

  const handleGridStepChange = (gridStep: number) => {
    setViewport((prev) => ({ ...prev, gridStep }))
  }

  const handleFrameCreated = (frame: CoordinateFrame) => {
    setFrames((prev) => [...prev, frame])
    setIsDrawing(false)
  }

  return (
    <div className="h-screen bg-bg-primary text-text-primary flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">YuDiMath</h1>
          <p className="text-sm text-text-secondary">Linear Algebra & Calculus Visualizer</p>
        </div>
      </div>
      <div className="flex-1 relative min-h-0">
        <Canvas
          viewport={viewport}
          onViewportChange={setViewport}
          frames={frames}
          isDrawing={isDrawing}
          onDrawingModeChange={setIsDrawing}
          onFrameCreated={handleFrameCreated}
        />
        <div className="absolute bottom-4 left-4 z-10">
          <GridStepSelector
            gridStep={viewport.gridStep}
            onGridStepChange={handleGridStepChange}
          />
        </div>
        <div className="absolute top-20 left-4 z-10">
          <button
            onClick={() => setIsDrawing(!isDrawing)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isDrawing
                ? 'bg-primary text-white hover:bg-blue-600'
                : 'bg-panel-bg border border-border text-text-primary hover:bg-hover'
            }`}
          >
            {isDrawing ? 'Cancel Drawing' : 'Draw Frame'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App

