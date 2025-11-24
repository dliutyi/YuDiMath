import { useState, useEffect, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import FrameEditorPanel from './components/FrameEditorPanel'
import LoadingOverlay from './components/LoadingOverlay'
import Modal from './components/Modal'
import ErrorBoundary from './components/ErrorBoundary'
import { generateCode } from './utils/codeGenerator'
import { usePyScript } from './hooks/usePyScript'
import { useWorkspace } from './hooks/useWorkspace'
import { downloadWorkspace, importWorkspaceFromFile } from './utils/exportImport'
import type { ViewportState, CoordinateFrame, Vector, FunctionPlot, WorkspaceState } from './types'

const MIN_ZOOM = 5.0
const MAX_ZOOM = 500.0
const DEFAULT_ZOOM = 50.0

function App() {
  const workspace = useWorkspace({ persist: true })
  const [isDrawing, setIsDrawing] = useState(false)
  const { isReady, executeCode, isExecuting } = usePyScript()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onCancel?: () => void
    variant?: 'default' | 'danger'
    secondaryText?: string
    onSecondary?: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  const handleGridStepChange = (gridStep: number) => {
    workspace.updateViewport({ gridStep })
  }

  const handleZoomIn = () => {
    const currentZoom = workspace.viewport.zoom
    const newZoom = Math.min(currentZoom * 1.2, MAX_ZOOM)
    workspace.updateViewport({ zoom: newZoom })
  }

  const handleZoomOut = () => {
    const currentZoom = workspace.viewport.zoom
    const newZoom = Math.max(currentZoom / 1.2, MIN_ZOOM)
    workspace.updateViewport({ zoom: newZoom })
  }

  const handleZoomReset = () => {
    workspace.updateViewport({ zoom: DEFAULT_ZOOM })
  }

  const handleFrameCreated = (frame: CoordinateFrame, parentFrameId: string | null) => {
    console.log('[App] Frame created:', frame)
    console.log('[App] Parent frame ID:', parentFrameId)
    workspace.addFrame(frame, parentFrameId)
    setIsDrawing(false)
  }

  const handleFrameViewportChange = (frameId: string, newViewport: ViewportState) => {
    workspace.updateFrameViewport(frameId, newViewport)
  }

  const handleFrameUpdate = (frameId: string, updates: Partial<CoordinateFrame>) => {
    let codeToExecute: string | null = null
    
    // Find the current frame to get its code
    const currentFrame = workspace.frames.find(f => f.id === frameId)
    if (!currentFrame) return
    
    const updatedFrame = {
      ...currentFrame,
      ...updates,
    }
    
    // If origin, base vectors, or parameters changed, regenerate code while preserving user code
    if (updates.origin || updates.baseI || updates.baseJ || updates.parameters) {
      updatedFrame.code = generateCode(updatedFrame, currentFrame.code)
      codeToExecute = updatedFrame.code
      
      // Trigger auto-execution for any of these changes
      console.log('[App] Triggering auto-execution for frame:', frameId, 'Reason:', {
        origin: !!updates.origin,
        baseI: !!updates.baseI,
        baseJ: !!updates.baseJ,
        parameters: !!updates.parameters
      })
    }
    
    // Update the frame
    workspace.updateFrame(frameId, updatedFrame)
    
    // Trigger auto-execution after state update
    if (codeToExecute) {
      // Use setTimeout to ensure state update completes first
      setTimeout(() => {
        setAutoExecuteCode(codeToExecute)
        setAutoExecuteFrameId(frameId)
      }, 0)
    }
  }

  const handleCodeChange = (frameId: string, code: string) => {
    handleFrameUpdate(frameId, { code })
  }

  const handleVectorsUpdate = (frameId: string, vectors: Vector[], replace: boolean = false) => {
    const frame = workspace.frames.find(f => f.id === frameId)
    if (frame) {
      workspace.updateFrame(frameId, {
        vectors: replace ? vectors : [...(frame.vectors || []), ...vectors],
      })
    }
  }

  const handleFunctionsUpdate = (frameId: string, functions: FunctionPlot[], replace: boolean = false) => {
    const frame = workspace.frames.find(f => f.id === frameId)
    if (frame) {
      workspace.updateFrame(frameId, {
        functions: replace ? functions : [...(frame.functions || []), ...functions],
      })
    }
  }

  const handleVectorsClear = (frameId: string) => {
    workspace.updateFrame(frameId, { vectors: [] })
  }

  const handleFunctionsClear = (frameId: string) => {
    workspace.updateFrame(frameId, { functions: [] })
  }

  const [autoExecuteCode, setAutoExecuteCode] = useState<string | null>(null)
  const [autoExecuteFrameId, setAutoExecuteFrameId] = useState<string | null>(null)
  const [autoExecutionResult, setAutoExecutionResult] = useState<{ success: boolean; error?: string } | null>(null)

  // Auto-execute code when autoExecuteCode changes (works regardless of active tab)
  useEffect(() => {
    if (autoExecuteCode && autoExecuteFrameId && isReady && !isExecuting) {
      console.log('[App] Auto-executing code for frame:', autoExecuteFrameId)
      // Clear previous execution result when starting new execution
      setAutoExecutionResult(null)
      
      // Collect vectors and functions created during execution
      // Don't clear first - keep old ones visible for smooth transition
      const newVectors: Vector[] = []
      const newFunctions: FunctionPlot[] = []

      // Generate unique IDs for vectors and functions
      const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      executeCode(
        autoExecuteCode,
        autoExecuteFrameId,
        // onVectorCreated callback
        (vector) => {
          newVectors.push({
            ...vector,
            id: generateId('vec'),
          })
        },
        // onFunctionCreated callback
        (func) => {
          newFunctions.push({
            ...func,
            id: generateId('func'),
          })
        }
      ).then((result) => {
        console.log('[App] Auto-execution result:', result.success)
        if (result.success) {
          setAutoExecutionResult({ success: true })
          // Atomically replace old vectors/functions with new ones
          // This keeps old ones visible until new ones are ready, eliminating blinking
          flushSync(() => {
            handleVectorsUpdate(autoExecuteFrameId, newVectors, true)
            handleFunctionsUpdate(autoExecuteFrameId, newFunctions, true)
          })
        } else {
          setAutoExecutionResult({
            success: false,
            error: result.error?.message || 'Unknown error occurred',
          })
          // On error, clear vectors/functions to show that execution failed
          flushSync(() => {
            handleVectorsClear(autoExecuteFrameId)
            handleFunctionsClear(autoExecuteFrameId)
          })
        }
        // Clear auto-execute trigger after execution
        setAutoExecuteCode(null)
        setAutoExecuteFrameId(null)
      }).catch((error) => {
        console.error('[App] Auto-execution error:', error)
        setAutoExecutionResult({
          success: false,
          error: error.message || 'Execution failed',
        })
        // On error, clear vectors/functions
        flushSync(() => {
          handleVectorsClear(autoExecuteFrameId)
          handleFunctionsClear(autoExecuteFrameId)
        })
        // Clear auto-execute trigger even on error
        setAutoExecuteCode(null)
        setAutoExecuteFrameId(null)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExecuteCode, autoExecuteFrameId, isReady, isExecuting])

  const handleCodeRun = (frameId: string, _code: string) => {
    // Code execution is handled by CodePanel, this is just a callback
    // Future: Could add logging or other side effects here
    console.log('[App] Code executed for frame:', frameId)
    // Clear auto-execute trigger after execution
    setAutoExecuteCode(null)
    setAutoExecuteFrameId(null)
  }

  const handleExportWorkspace = () => {
    const workspaceState: WorkspaceState = {
      viewport: workspace.viewport,
      frames: workspace.frames,
      selectedFrameId: workspace.selectedFrameId,
    }
    downloadWorkspace(workspaceState)
  }

  const handleImportWorkspace = async (file: File) => {
    const imported = await importWorkspaceFromFile(file)
    if (!imported) {
      setModalState({
        isOpen: true,
        title: 'Import Failed',
        message: 'Failed to import workspace. The file may be invalid or corrupted.',
        confirmText: 'OK',
        onConfirm: () => {},
        variant: 'danger',
      })
      return
    }

    // Show modal to ask user if they want to replace, merge, or cancel
    setModalState({
      isOpen: true,
      title: 'Import Workspace',
      message: 'How would you like to import the workspace?\n\n• Replace: Replace current workspace with imported one\n• Merge: Add imported frames to current workspace\n• Cancel: Abort import',
      confirmText: 'Replace',
      secondaryText: 'Merge',
      cancelText: 'Cancel',
      onConfirm: () => {
        // Replace: set the entire workspace state
        workspace.setWorkspace(imported)
      },
      onSecondary: () => {
        // Merge: add imported frames to existing ones, update viewport if needed
        const mergedFrames = [...workspace.frames, ...imported.frames]
        workspace.setWorkspace({
          viewport: imported.viewport, // Use imported viewport
          frames: mergedFrames,
          selectedFrameId: imported.selectedFrameId || workspace.selectedFrameId,
        })
      },
      onCancel: () => {
        // Cancel: do nothing, just close the modal
      },
    })
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleImportWorkspace(file)
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFrameDelete = useCallback((frameId: string) => {
    workspace.removeFrame(frameId)
  }, [workspace])

  // Handle Delete key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Delete key if no input/textarea is focused
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeElement = document.activeElement
        const isInputFocused = 
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA'
        
        if (!isInputFocused && workspace.selectedFrameId) {
          e.preventDefault()
          handleFrameDelete(workspace.selectedFrameId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [workspace.selectedFrameId, handleFrameDelete])

  return (
    <ErrorBoundary>
      <div className="h-full bg-bg-primary text-text-primary relative overflow-hidden">
        <LoadingOverlay />
        <Canvas
        viewport={workspace.viewport}
        onViewportChange={workspace.setViewport}
        frames={workspace.frames}
        isDrawing={isDrawing}
        onDrawingModeChange={setIsDrawing}
        onFrameCreated={handleFrameCreated}
        selectedFrameId={workspace.selectedFrameId}
        onFrameSelected={workspace.setSelectedFrameId}
        onFrameViewportChange={handleFrameViewportChange}
      />
      {/* Header overlay in top-left corner */}
      <div className="absolute top-4 left-4 z-10 bg-panel-bg/90 backdrop-blur-sm border border-border rounded-lg px-4 py-2 shadow-lg">
        <h1 className="text-xl font-bold text-text-primary">YuDiMath</h1>
        <p className="text-xs text-text-secondary">Linear Algebra & Calculus Visualizer</p>
      </div>
      {/* Toolbar at bottom left */}
      <Toolbar
        gridStep={workspace.viewport.gridStep}
        onGridStepChange={handleGridStepChange}
        zoom={workspace.viewport.zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onExport={handleExportWorkspace}
        onImport={handleImportClick}
        onClear={() => {
          setModalState({
            isOpen: true,
            title: 'Clear Workspace',
            message: 'Are you sure you want to clear the entire workspace? This will remove all frames and reset the viewport.',
            confirmText: 'Clear',
            cancelText: 'Cancel',
            onConfirm: () => {
              workspace.clearWorkspace()
            },
            onCancel: () => {
              // Cancel: do nothing, just close the modal
            },
            variant: 'danger',
          })
        }}
        isDrawing={isDrawing}
        onDrawingToggle={() => setIsDrawing(!isDrawing)}
      />
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <div className="absolute top-4 right-4 z-10">
        <FrameEditorPanel
          selectedFrame={workspace.selectedFrame}
          onFrameUpdate={handleFrameUpdate}
          onFrameViewportChange={handleFrameViewportChange}
          onCodeChange={handleCodeChange}
          onCodeRun={handleCodeRun}
          onVectorsUpdate={handleVectorsUpdate}
          onFunctionsUpdate={handleFunctionsUpdate}
          onVectorsClear={handleVectorsClear}
          onFunctionsClear={handleFunctionsClear}
          autoExecuteCode={autoExecuteCode}
          externalExecutionResult={autoExecutionResult}
          onFrameDelete={handleFrameDelete}
        />
      </div>
      {/* Modal */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={modalState.onConfirm}
        onCancel={modalState.onCancel}
        variant={modalState.variant}
        secondaryText={modalState.secondaryText}
        onSecondary={modalState.onSecondary}
      />
      </div>
    </ErrorBoundary>
  )
}

export default App

