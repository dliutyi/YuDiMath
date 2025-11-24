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
import { debounce } from './utils/debounce'
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

  // Debounced code generation only for rapid changes (e.g., typing in inputs)
  // For sliders, execute immediately for smooth, live feel
  const debouncedCodeGenerationRef = useRef<Map<string, ReturnType<typeof debounce>>>(new Map())

  const handleFrameUpdate = useCallback((frameId: string, updates: Partial<CoordinateFrame>) => {
    // Find the current frame to get its code
    const currentFrame = workspace.frames.find(f => f.id === frameId)
    if (!currentFrame) return
    
    const updatedFrame = {
      ...currentFrame,
      ...updates,
    }
    
    // If origin, base vectors, or parameters changed, regenerate code while preserving user code
    if (updates.origin || updates.baseI || updates.baseJ || updates.parameters) {
      // For sliders (parameters, baseI, baseJ), execute immediately for smooth feel
      // For text inputs (origin), use debounce to avoid excessive execution while typing
      const isSliderChange = updates.parameters !== undefined || updates.baseI !== undefined || updates.baseJ !== undefined
      
      if (isSliderChange) {
        // Immediate execution for sliders - smooth and live
        const regeneratedCode = generateCode(updatedFrame, currentFrame.code)
        const finalFrame = { ...updatedFrame, code: regeneratedCode }
        
        // Update frame with regenerated code
        workspace.updateFrame(frameId, finalFrame)
        
        // Trigger auto-execution immediately
        flushSync(() => {
          setAutoExecuteCode(regeneratedCode)
          setAutoExecuteFrameId(frameId)
        })
        
        console.log('[App] Immediate execution for slider change, frame:', frameId)
      } else {
        // Debounced execution for text inputs (origin) - avoid execution on every keystroke
        if (!debouncedCodeGenerationRef.current.has(frameId)) {
          const debouncedFn = debounce((frameId: string, frame: CoordinateFrame, existingCode: string) => {
            const regeneratedCode = generateCode(frame, existingCode)
            const finalFrame = { ...frame, code: regeneratedCode }
            
            // Update the frame with regenerated code
            workspace.updateFrame(frameId, finalFrame)
            
            // Trigger auto-execution after state update
            flushSync(() => {
              setAutoExecuteCode(regeneratedCode)
              setAutoExecuteFrameId(frameId)
            })
            
            console.log('[App] Executing code after debounced generation for frame:', frameId)
          }, 300) // 300ms debounce for text inputs
          debouncedCodeGenerationRef.current.set(frameId, debouncedFn)
        }
        
        // Use debounced function for text inputs
        const debouncedFn = debouncedCodeGenerationRef.current.get(frameId)!
        debouncedFn(frameId, updatedFrame, currentFrame.code)
        
        // Update frame immediately (without code) for responsive UI
        workspace.updateFrame(frameId, updatedFrame)
        
        console.log('[App] Triggering debounced code generation for text input, frame:', frameId)
      }
    } else {
      // For non-code-related updates, update immediately
      workspace.updateFrame(frameId, updatedFrame)
    }
  }, [workspace])

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
    console.log('[App] Auto-execution effect triggered:', {
      autoExecuteCode: !!autoExecuteCode,
      autoExecuteCodeLength: autoExecuteCode?.length,
      autoExecuteFrameId,
      isReady,
      isExecuting,
      shouldExecute: !!(autoExecuteCode && autoExecuteFrameId && isReady && !isExecuting)
    })
    
    // Wait for execution to finish if it's currently running
    if (autoExecuteCode && autoExecuteFrameId && isReady) {
      if (isExecuting) {
        console.log('[App] Execution in progress, waiting...')
        // Don't execute yet - wait for current execution to finish
        return
      }
      
      console.log('[App] Starting auto-execution for frame:', autoExecuteFrameId, 'Code length:', autoExecuteCode.length)
      
      // Store the code and frameId to execute (in case they change during execution)
      const codeToExecute = autoExecuteCode
      const frameIdToExecute = autoExecuteFrameId
      
      // Don't clear previous execution result here - let it persist until we know the new result
      // This ensures errors remain visible until we have a new result
      
      // Collect vectors and functions created during execution
      // Don't clear first - keep old ones visible for smooth transition
      const newVectors: Vector[] = []
      const newFunctions: FunctionPlot[] = []

      // Generate unique IDs for vectors and functions
      const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      console.log('[App] Calling executeCode...')
      executeCode(
        codeToExecute,
        frameIdToExecute,
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
        console.log('[App] Auto-execution result received:', {
          success: result.success,
          error: result.error,
          errorMessage: result.error?.message,
          errorType: result.error?.type,
          errorString: result.error?.toString(),
        })
        
        if (result.success) {
          console.log('[App] Setting SUCCESS result')
          // On success, set success result (this will clear any previous errors)
          setAutoExecutionResult({ success: true })
          // Atomically replace old vectors/functions with new ones
          // This keeps old ones visible until new ones are ready, eliminating blinking
          flushSync(() => {
            handleVectorsUpdate(frameIdToExecute, newVectors, true)
            handleFunctionsUpdate(frameIdToExecute, newFunctions, true)
          })
        } else {
          // On error, set error result (this will be displayed)
          const errorMessage = result.error?.message || 
                              (typeof result.error === 'string' ? result.error : result.error?.toString()) || 
                              'Unknown error occurred'
          console.error('[App] Setting ERROR result:', errorMessage)
          console.error('[App] Full error object:', result.error)
          
          const errorResult = {
            success: false as const,
            error: errorMessage,
          }
          console.log('[App] Error result object before setState:', errorResult)
          console.log('[App] Calling setAutoExecutionResult with:', JSON.stringify(errorResult))
          setAutoExecutionResult(errorResult)
          
          // Verify it was set
          setTimeout(() => {
            console.log('[App] After setAutoExecutionResult - checking state...')
          }, 0)
          
          // On error, clear vectors/functions to show that execution failed
          flushSync(() => {
            handleVectorsClear(frameIdToExecute)
            handleFunctionsClear(frameIdToExecute)
          })
        }
        // Clear auto-execute trigger after execution
        console.log('[App] Clearing auto-execute triggers after execution')
        setAutoExecuteCode(null)
        setAutoExecuteFrameId(null)
      }).catch((error) => {
        console.error('[App] Auto-execution exception caught:', error)
        const errorMessage = error?.message || error?.toString() || 'Execution failed'
        console.error('[App] Setting ERROR result from catch:', errorMessage)
        setAutoExecutionResult({
          success: false,
          error: errorMessage,
        })
        // On error, clear vectors/functions
        flushSync(() => {
          handleVectorsClear(frameIdToExecute)
          handleFunctionsClear(frameIdToExecute)
        })
        // Clear auto-execute trigger even on error
        console.log('[App] Clearing auto-execute triggers after error')
        setAutoExecuteCode(null)
        setAutoExecuteFrameId(null)
      })
    } else {
      console.log('[App] Auto-execution skipped - conditions not met:', {
        hasCode: !!autoExecuteCode,
        hasFrameId: !!autoExecuteFrameId,
        isReady,
        isExecuting,
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
    // Don't clear external execution result here - let CodePanel handle it
    // Manual execution results are stored in localExecutionResult in CodePanel
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

  // Handle Delete key press and prevent browser zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser zoom shortcuts (Ctrl/Cmd + Plus/Minus/0)
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

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

    // Prevent browser zoom with Ctrl/Cmd + wheel
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Monitor and reset browser zoom level
    const resetZoom = () => {
      // Force reset zoom using CSS zoom property (works in Chrome/Edge)
      const html = document.documentElement
      const body = document.body
      
      // Reset zoom property - this is the most reliable way
      html.style.zoom = '1'
      body.style.zoom = '1'
      
      // Also reset transform as fallback
      html.style.transform = 'scale(1)'
      html.style.transformOrigin = 'top left'
      body.style.transform = 'scale(1)'
    }

    // Check zoom level periodically and on resize
    const zoomCheckInterval = setInterval(resetZoom, 50)
    window.addEventListener('resize', resetZoom)
    window.addEventListener('focus', resetZoom)
    
    // Use Visual Viewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resetZoom)
      window.visualViewport.addEventListener('scroll', resetZoom)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    
    return () => {
      clearInterval(zoomCheckInterval)
      window.removeEventListener('resize', resetZoom)
      window.removeEventListener('focus', resetZoom)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', resetZoom)
        window.visualViewport.removeEventListener('scroll', resetZoom)
      }
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('wheel', handleWheel, { capture: true })
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

