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
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)

  const handleGridStepChange = (gridStep: number) => {
    setViewport((prev) => ({ ...prev, gridStep }))
  }

  const handleFrameCreated = (frame: CoordinateFrame, parentFrameId: string | null) => {
    console.log('[App] Frame created:', frame)
    console.log('[App] Parent frame ID:', parentFrameId)
    setFrames((prev) => {
      // Add the new frame
      const newFrames = [...prev, frame]
      
      // If there's a parent frame, update its childFrameIds
      if (parentFrameId) {
        const parentIndex = newFrames.findIndex(f => f.id === parentFrameId)
        if (parentIndex !== -1) {
          newFrames[parentIndex] = {
            ...newFrames[parentIndex],
            childFrameIds: [...newFrames[parentIndex].childFrameIds, frame.id]
          }
          console.log('[App] Updated parent frame childFrameIds:', newFrames[parentIndex].childFrameIds)
        }
      }
      
      console.log('[App] Current frames count:', prev.length, 'New frames count:', newFrames.length)
      console.log('[App] All frames:', JSON.stringify(newFrames, null, 2))
      return newFrames
    })
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
          selectedFrameId={selectedFrameId}
          onFrameSelected={setSelectedFrameId}
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

