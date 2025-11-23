import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import Canvas from './components/Canvas'
import GridStepSelector from './components/GridStepSelector'
import FrameEditorPanel from './components/FrameEditorPanel'
import LoadingOverlay from './components/LoadingOverlay'
import Modal from './components/Modal'
import { generateCode } from './utils/codeGenerator'
import { usePyScript } from './hooks/usePyScript'
import { useWorkspace } from './hooks/useWorkspace'
import { downloadWorkspace, importWorkspaceFromFile } from './utils/exportImport'
import type { ViewportState, CoordinateFrame, Vector, FunctionPlot, WorkspaceState } from './types'

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

  // Auto-execute code when autoExecuteCode changes (works regardless of active tab)
  useEffect(() => {
    if (autoExecuteCode && autoExecuteFrameId && isReady && !isExecuting) {
      console.log('[App] Auto-executing code for frame:', autoExecuteFrameId)
      
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
          // Atomically replace old vectors/functions with new ones
          // This keeps old ones visible until new ones are ready, eliminating blinking
          flushSync(() => {
            handleVectorsUpdate(autoExecuteFrameId, newVectors, true)
            handleFunctionsUpdate(autoExecuteFrameId, newFunctions, true)
          })
        } else {
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

  return (
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
      <div className="absolute bottom-4 left-4 z-10">
        <GridStepSelector
          gridStep={workspace.viewport.gridStep}
          onGridStepChange={handleGridStepChange}
        />
      </div>
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      {/* Tools panel on middle left */}
      <div className="absolute top-1/2 left-4 -translate-y-1/2 z-10">
        <div className="bg-panel-bg/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl p-3 flex flex-col gap-3">
          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-2 pb-1 border-b border-border/50 mb-1">
            Tools
          </div>
          <button
            onClick={(e) => {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
              e.currentTarget.blur()
              handleExportWorkspace()
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
              e.currentTarget.blur()
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
              setTimeout(() => {
                e.currentTarget.classList.remove('active-touch')
              }, 150)
            }}
            className="relative px-4 py-3 rounded-lg transition-all duration-200 group touch-manipulation bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-primary/20 hover:border-primary/50 hover:shadow-md"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Export Workspace"
          >
            {/* Export/Download icon */}
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {/* Tooltip */}
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-700/50 z-20">
              Export Workspace
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900/95"></span>
            </span>
          </button>
          <button
            onClick={(e) => {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
              e.currentTarget.blur()
              handleImportClick()
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
              e.currentTarget.blur()
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
              setTimeout(() => {
                e.currentTarget.classList.remove('active-touch')
              }, 150)
            }}
            className="relative px-4 py-3 rounded-lg transition-all duration-200 group touch-manipulation bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-primary/20 hover:border-primary/50 hover:shadow-md"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Import Workspace"
          >
            {/* Import/Upload icon */}
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {/* Tooltip */}
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-700/50 z-20">
              Import Workspace
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900/95"></span>
            </span>
          </button>
          <button
            onClick={(e) => {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
              e.currentTarget.blur()
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
              e.currentTarget.blur()
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
              setTimeout(() => {
                e.currentTarget.classList.remove('active-touch')
              }, 150)
            }}
            className="relative px-4 py-3 rounded-lg transition-all duration-200 group touch-manipulation bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-red-500/20 hover:border-red-500/50 hover:shadow-md"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Clear Workspace"
          >
            {/* Clear/Trash icon */}
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
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            {/* Tooltip */}
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-700/50 z-20">
              Clear Workspace
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900/95"></span>
            </span>
          </button>
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
  )
}

export default App

