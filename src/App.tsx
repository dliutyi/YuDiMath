import { useState, useEffect, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import FrameEditorPanel from './components/FrameEditorPanel'
import LoadingOverlay from './components/LoadingOverlay'
import Modal from './components/Modal'
import ErrorBoundary from './components/ErrorBoundary'
import { generateCode } from './utils/codeGenerator'
import { usePyScript, clearQueuedExecutionsForFrame } from './hooks/usePyScript'
import { useWorkspace } from './hooks/useWorkspace'
import { downloadWorkspace, importWorkspaceFromFile } from './utils/exportImport'
import { debounce } from './utils/debounce'
import type { ViewportState, CoordinateFrame, Vector, FunctionPlot, ParametricPlot, ImplicitPlot, WorkspaceState } from './types'
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM, ZOOM_STEP_MULTIPLIER } from './utils/constants'

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
    const newZoom = Math.min(currentZoom * ZOOM_STEP_MULTIPLIER, MAX_ZOOM)
    workspace.updateViewport({ zoom: newZoom })
  }

  const handleZoomOut = () => {
    const currentZoom = workspace.viewport.zoom
    const newZoom = Math.max(currentZoom / ZOOM_STEP_MULTIPLIER, MIN_ZOOM)
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
        // Ultra-fast execution for sliders - minimal delay for maximum responsiveness
        // 10ms debounce for live updates while preventing queue buildup
        const regeneratedCode = generateCode(updatedFrame, currentFrame.code)
        
        // Update frame immediately (without code) for responsive UI
        workspace.updateFrame(frameId, updatedFrame)
        
        // Clear any queued executions for this frame to prevent backlog
        clearQueuedExecutionsForFrame(frameId)
        
        // Use debounced execution for sliders to prevent queue buildup
        if (!debouncedCodeGenerationRef.current.has(frameId + '_slider')) {
          const debouncedFn = debounce((frameId: string, code: string) => {
            // Clear queue again right before execution to ensure we're not queuing behind old executions
            clearQueuedExecutionsForFrame(frameId)
            
            // Update frame with regenerated code
            workspace.updateFrame(frameId, { code })
            
            // Trigger auto-execution (mark as slider-triggered to bypass throttling)
            // Use requestAnimationFrame for smoother UI updates
            requestAnimationFrame(() => {
              isSliderTriggeredRef.current = true
              flushSync(() => {
                setAutoExecuteCode(code)
                setAutoExecuteFrameId(frameId)
              })
            })
          }, 10) // 10ms debounce - live updates with minimal delay
          debouncedCodeGenerationRef.current.set(frameId + '_slider', debouncedFn)
        }
        
        // Use debounced function for sliders
        const debouncedFn = debouncedCodeGenerationRef.current.get(frameId + '_slider')!
        debouncedFn(frameId, regeneratedCode)
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

  const handleParametricPlotsUpdate = (frameId: string, parametricPlots: ParametricPlot[], replace: boolean = false) => {
    const frame = workspace.frames.find(f => f.id === frameId)
    if (frame) {
      workspace.updateFrame(frameId, {
        parametricPlots: replace ? parametricPlots : [...(frame.parametricPlots || []), ...parametricPlots],
      })
    }
  }

  const handleVectorsClear = (frameId: string) => {
    workspace.updateFrame(frameId, { vectors: [] })
  }

  const handleFunctionsClear = (frameId: string) => {
    workspace.updateFrame(frameId, { functions: [] })
  }

  const handleParametricPlotsClear = (frameId: string) => {
    workspace.updateFrame(frameId, { parametricPlots: [] })
  }

  const handleImplicitPlotsUpdate = (frameId: string, implicitPlots: ImplicitPlot[], replace: boolean = false) => {
    const frame = workspace.frames.find(f => f.id === frameId)
    if (frame) {
      workspace.updateFrame(frameId, {
        implicitPlots: replace ? implicitPlots : [...(frame.implicitPlots || []), ...implicitPlots],
      })
    }
  }

  const handleImplicitPlotsClear = (frameId: string) => {
    workspace.updateFrame(frameId, { implicitPlots: [] })
  }

  const [autoExecuteCode, setAutoExecuteCode] = useState<string | null>(null)
  const [autoExecuteFrameId, setAutoExecuteFrameId] = useState<string | null>(null)
  const isSliderTriggeredRef = useRef<boolean>(false) // Track if execution is slider-triggered
  const [autoExecutionResult, setAutoExecutionResult] = useState<{ success: boolean; error?: string } | null>(null)

  // Viewport-based caching: only recalculate when viewport changes significantly
  // Use more precise rounding to catch zoom changes better
  const viewportCacheKeyRef = useRef<string>('')
  const lastExecutionTimeRef = useRef<number>(0)
  const THROTTLE_MS = 50 // Reduced throttle for more responsive zoom
  
  // Auto-execute code when autoExecuteCode changes (works regardless of active tab)
  useEffect(() => {
    // Create cache key from BOTH main viewport AND frame viewport (if executing for a frame)
    // This ensures plots recalculate when frame is zoomed
    const mainViewportKey = `${workspace.viewport.zoom.toFixed(4)}_${workspace.viewport.x.toFixed(1)}_${workspace.viewport.y.toFixed(1)}`
    
    // Get frame viewport if executing for a frame
    let frameViewportKey = ''
    if (autoExecuteFrameId) {
      const frame = workspace.frames.find(f => f.id === autoExecuteFrameId)
      if (frame) {
        frameViewportKey = `_frame_${frame.viewport.zoom.toFixed(4)}_${frame.viewport.x.toFixed(1)}_${frame.viewport.y.toFixed(1)}`
      }
    }
    
    const viewportKey = mainViewportKey + frameViewportKey
    const now = Date.now()
    
    // Always recalculate on zoom changes (zoom is critical for plot quality)
    // Check both main zoom and frame zoom
    const oldKey = viewportCacheKeyRef.current
    
    // Extract zoom values for comparison
    const oldMainZoom = oldKey !== '' ? oldKey.split('_')[0] : ''
    const newMainZoom = viewportKey.split('_')[0]
    const mainZoomChanged = oldMainZoom !== '' && oldMainZoom !== newMainZoom
    
    // Check frame zoom if frame viewport key exists
    let frameZoomChanged = false
    if (frameViewportKey) {
      const oldFrameZoom = oldKey.includes('_frame_') ? oldKey.split('_frame_')[1]?.split('_')[0] : ''
      const newFrameZoom = frameViewportKey.split('_frame_')[1]?.split('_')[0]
      frameZoomChanged = oldFrameZoom !== '' && oldFrameZoom !== newFrameZoom
    }
    
    const zoomChanged = mainZoomChanged || frameZoomChanged
    
    // Skip only if viewport hasn't changed AND we executed recently (but never skip zoom changes)
    // Also skip if this is the first execution (oldKey is empty)
    // BUT: Always execute if this is slider-triggered (bypass throttling for smooth slider experience)
    const isSliderTriggered = isSliderTriggeredRef.current
    if (oldKey === '') {
      // First execution - always run
    } else if (isSliderTriggered) {
      // Slider-triggered - always execute immediately for smooth experience
      isSliderTriggeredRef.current = false // Reset flag
    } else if (!zoomChanged && viewportKey === viewportCacheKeyRef.current && (now - lastExecutionTimeRef.current) < THROTTLE_MS) {
      return // Skip execution - viewport hasn't changed enough
    }
    
    
    // Wait for execution to finish if it's currently running
    if (autoExecuteCode && autoExecuteFrameId && isReady) {
      if (isExecuting) {
        // Don't execute yet - skip this update
        return
      }
      
      
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

      // Calculate pixels per unit for screen-resolution-aware sampling
      // pixelsPerUnit = zoom (since zoom determines how many units fit in the canvas)
      // For a typical canvas width of ~1920px and zoom of 50, we get ~38 pixels per unit
      // But zoom directly represents the scale, so pixelsPerUnit ≈ zoom
      // We'll use a more accurate calculation: estimate canvas size and calculate from viewport
      const estimatedCanvasWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
      const estimatedCanvasHeight = typeof window !== 'undefined' ? window.innerHeight : 1080
      // Calculate pixels per unit accurately based on viewport zoom
      // CRITICAL: Main viewport zoom directly affects pixels per unit
      // Higher zoom = see less world space = more pixels per unit
      // pixelsPerUnit = zoom * (canvasWidth / 1000) as scaling factor
      let pixelsPerUnit = workspace.viewport.zoom * (estimatedCanvasWidth / 1000)
      
      // If executing for a frame, multiply by frame zoom (frame zoom is additional scaling)
      // Frame zoom is independent and multiplies the effective pixels per unit
      if (frameIdToExecute) {
        const frame = workspace.frames.find(f => f.id === frameIdToExecute)
        if (frame) {
          // Frame zoom multiplies the effective pixels per unit
          // Higher frame zoom = more detail = more pixels per unit in frame coordinates
          pixelsPerUnit = pixelsPerUnit * frame.viewport.zoom
        }
      }
      
      // Ensure we always recalculate when zoom changes significantly
      // This is critical for high-frequency functions
      
      const isSliderTriggered = isSliderTriggeredRef.current
      isSliderTriggeredRef.current = false // Reset flag
      const newParametricPlots: ParametricPlot[] = []
      const newImplicitPlots: ImplicitPlot[] = []
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
        },
        // onParametricPlotCreated callback
        (plot) => {
          newParametricPlots.push(plot as ParametricPlot)
        },
        // onImplicitPlotCreated callback
        (plot) => {
          newImplicitPlots.push(plot as ImplicitPlot)
        },
        estimatedCanvasWidth,
        estimatedCanvasHeight,
        pixelsPerUnit,
        isSliderTriggered
      ).then((result) => {
        // Update cache and execution time
        viewportCacheKeyRef.current = viewportKey
        lastExecutionTimeRef.current = Date.now()
        
        
        if (result.success) {
          // On success, set success result (this will clear any previous errors)
          setAutoExecutionResult({ success: true })
          // Clear old plots before adding new ones
          flushSync(() => {
            handleVectorsClear(frameIdToExecute)
            handleFunctionsClear(frameIdToExecute)
            handleParametricPlotsClear(frameIdToExecute)
            handleImplicitPlotsClear(frameIdToExecute)
          })
          // Then atomically replace with new ones
          // This keeps old ones visible until new ones are ready, eliminating blinking
          flushSync(() => {
            handleVectorsUpdate(frameIdToExecute, newVectors, true)
            handleFunctionsUpdate(frameIdToExecute, newFunctions, true)
            handleParametricPlotsUpdate(frameIdToExecute, newParametricPlots, true)
            handleImplicitPlotsUpdate(frameIdToExecute, newImplicitPlots, true)
          })
        } else {
          // On error, set error result (this will be displayed)
          const errorMessage = result.error?.message || 
                              (typeof result.error === 'string' ? result.error : result.error?.toString()) || 
                              'Unknown error occurred'
          const errorResult = {
            success: false as const,
            error: errorMessage,
          }
          setAutoExecutionResult(errorResult)
          
          // On error, clear vectors/functions/parametric plots to show that execution failed
          flushSync(() => {
            handleVectorsClear(frameIdToExecute)
            handleFunctionsClear(frameIdToExecute)
            handleParametricPlotsClear(frameIdToExecute)
            handleImplicitPlotsClear(frameIdToExecute)
          })
        }
        // Clear auto-execute trigger after execution
        setAutoExecuteCode(null)
        setAutoExecuteFrameId(null)
      }).catch((error) => {
        const errorMessage = error?.message || error?.toString() || 'Execution failed'
        setAutoExecutionResult({
          success: false,
          error: errorMessage,
        })
        // On error, clear vectors/functions/parametric plots
        flushSync(() => {
          handleVectorsClear(frameIdToExecute)
          handleFunctionsClear(frameIdToExecute)
          handleParametricPlotsClear(frameIdToExecute)
        })
        // Clear auto-execute trigger even on error
        setAutoExecuteCode(null)
        setAutoExecuteFrameId(null)
      })
    } else {
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExecuteCode, autoExecuteFrameId, isReady, isExecuting, workspace.viewport, workspace.frames])

  const handleCodeRun = (_frameId: string, _code: string) => {
    // Code execution is handled by CodePanel, this is just a callback
    // Future: Could add logging or other side effects here
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
    // BUT allow canvas zoom to work (canvas handles its own wheel events)
    const handleWheel = (e: WheelEvent) => {
      // Check if the event is on the canvas - if so, let it through for canvas zoom
      const target = e.target as HTMLElement
      if (target?.tagName === 'CANVAS' || target?.closest('[data-canvas-container]')) {
        // This is a canvas wheel event - let the canvas handler deal with it
        return
      }
      
      // For non-canvas areas, prevent browser zoom with Ctrl/Cmd + wheel
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
      <div className={`absolute top-4 right-4 z-10 ${workspace.selectedFrame ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <FrameEditorPanel
          selectedFrame={workspace.selectedFrame}
          onFrameUpdate={handleFrameUpdate}
          onFrameViewportChange={handleFrameViewportChange}
          onCodeChange={handleCodeChange}
          onCodeRun={handleCodeRun}
          onVectorsUpdate={handleVectorsUpdate}
          onFunctionsUpdate={handleFunctionsUpdate}
          onParametricPlotsUpdate={handleParametricPlotsUpdate}
          onImplicitPlotsUpdate={handleImplicitPlotsUpdate}
          onVectorsClear={handleVectorsClear}
          onFunctionsClear={handleFunctionsClear}
          onParametricPlotsClear={handleParametricPlotsClear}
          onImplicitPlotsClear={handleImplicitPlotsClear}
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

