import { useState } from 'react'
import Canvas from './components/Canvas'
import GridStepSelector from './components/GridStepSelector'
import FrameEditorPanel from './components/FrameEditorPanel'
import LoadingOverlay from './components/LoadingOverlay'
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
    // Auto-select the newly created frame
    setSelectedFrameId(frame.id)
    setIsDrawing(false)
  }

  const handleFrameViewportChange = (frameId: string, newViewport: ViewportState) => {
    setFrames((prev) => {
      return prev.map((frame) => {
        if (frame.id === frameId) {
          return {
            ...frame,
            viewport: newViewport,
          }
        }
        return frame
      })
    })
  }

  const handleFrameUpdate = (frameId: string, updates: Partial<CoordinateFrame>) => {
    setFrames((prev) => {
      return prev.map((frame) => {
        if (frame.id === frameId) {
          return {
            ...frame,
            ...updates,
          }
        }
        return frame
      })
    })
  }

  const handleCodeChange = (frameId: string, code: string) => {
    handleFrameUpdate(frameId, { code })
  }

  const handleCodeRun = (frameId: string, _code: string) => {
    // Code execution is handled by CodePanel, this is just a callback
    // Future: Could add logging or other side effects here
    console.log('[App] Code executed for frame:', frameId)
  }

  const selectedFrame = frames.find(f => f.id === selectedFrameId) || null

  return (
    <div className="h-full bg-bg-primary text-text-primary relative overflow-hidden">
      <LoadingOverlay />
      <Canvas
        viewport={viewport}
        onViewportChange={setViewport}
        frames={frames}
        isDrawing={isDrawing}
        onDrawingModeChange={setIsDrawing}
        onFrameCreated={handleFrameCreated}
        selectedFrameId={selectedFrameId}
        onFrameSelected={setSelectedFrameId}
        onFrameViewportChange={handleFrameViewportChange}
      />
      {/* Header overlay in top-left corner */}
      <div className="absolute top-4 left-4 z-10 bg-panel-bg/90 backdrop-blur-sm border border-border rounded-lg px-4 py-2 shadow-lg">
        <h1 className="text-xl font-bold text-text-primary">YuDiMath</h1>
        <p className="text-xs text-text-secondary">Linear Algebra & Calculus Visualizer</p>
      </div>
      <div className="absolute bottom-4 left-4 z-10">
        <GridStepSelector
          gridStep={viewport.gridStep}
          onGridStepChange={handleGridStepChange}
        />
      </div>
      {/* Tools panel on middle left */}
      <div className="absolute top-1/2 left-4 -translate-y-1/2 z-10">
        <div className="bg-panel-bg/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl p-3 flex flex-col gap-3">
          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-2 pb-1 border-b border-border/50 mb-1">
            Tools
          </div>
          <button
            onClick={(e) => {
              // Immediately blur to remove focus after click
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
              e.currentTarget.blur()
              setIsDrawing(!isDrawing)
            }}
            onMouseDown={(e) => {
              e.currentTarget.classList.add('active-touch')
            }}
            onMouseUp={(e) => {
              e.currentTarget.classList.remove('active-touch')
              e.currentTarget.blur()
            }}
            onMouseLeave={(e) => {
              e.currentTarget.classList.remove('active-touch')
              e.currentTarget.blur()
            }}
            onTouchStart={(e) => {
              e.currentTarget.classList.add('active-touch')
            }}
            onTouchEnd={(e) => {
              // Force blur on touch end to remove focus
              e.currentTarget.blur()
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
              // Remove active class after a short delay to allow visual feedback
              setTimeout(() => {
                e.currentTarget.classList.remove('active-touch')
              }, 150)
            }}
            className={`relative px-4 py-3 rounded-lg transition-all duration-200 group touch-manipulation ${
              isDrawing
                ? 'bg-primary text-white shadow-lg shadow-primary/50 hover:bg-blue-600 hover:shadow-xl hover:shadow-primary/60'
                : 'bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-hover/50 hover:border-border hover:shadow-md'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Draw Frame"
          >
            {/* Draw/Frame icon - rectangle with grid */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="3" y1="9" x2="21" y2="9" />
            </svg>
            {/* Tooltip */}
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-700/50 z-20">
              Draw Frame
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900/95"></span>
            </span>
          </button>
        </div>
      </div>
      <div className="absolute top-4 right-4 z-10">
        <FrameEditorPanel
          selectedFrame={selectedFrame}
          onFrameUpdate={handleFrameUpdate}
          onFrameViewportChange={handleFrameViewportChange}
          onCodeChange={handleCodeChange}
          onCodeRun={handleCodeRun}
        />
      </div>
    </div>
  )
}

export default App

