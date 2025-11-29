import { useState, useEffect, memo, useCallback } from 'react'
import PropertiesPanel from './PropertiesPanel'
import CodePanel from './CodePanel'
import type { CoordinateFrame, ViewportState, Vector, FunctionPlot, ParametricPlot, ImplicitPlot, DeterminantFill } from '../types'

interface FrameEditorPanelProps {
  selectedFrame: CoordinateFrame | null
  onFrameUpdate: (frameId: string, updates: Partial<CoordinateFrame>) => void
  onFrameViewportChange?: (frameId: string, viewport: ViewportState) => void
  onCodeChange: (frameId: string, code: string) => void
  onCodeRun?: (frameId: string, code: string) => void
  onVectorsUpdate?: (frameId: string, vectors: Vector[], replace?: boolean) => void
  onFunctionsUpdate?: (frameId: string, functions: FunctionPlot[], replace?: boolean) => void
  onParametricPlotsUpdate?: (frameId: string, parametricPlots: ParametricPlot[], replace?: boolean) => void
  onImplicitPlotsUpdate?: (frameId: string, implicitPlots: ImplicitPlot[], replace?: boolean) => void
  onDeterminantFillsUpdate?: (frameId: string, determinantFills: DeterminantFill[], replace?: boolean) => void
  onVectorsClear?: (frameId: string) => void
  onFunctionsClear?: (frameId: string) => void
  onParametricPlotsClear?: (frameId: string) => void
  onImplicitPlotsClear?: (frameId: string) => void
  onDeterminantFillsClear?: (frameId: string) => void
  externalExecutionResult?: { success: boolean; error?: string } | null
  onFrameDelete?: (frameId: string) => void
}

type TabType = 'properties' | 'code'

function FrameEditorPanel({
  selectedFrame,
  onFrameUpdate,
  onFrameViewportChange,
  onCodeChange,
  onCodeRun,
  onVectorsUpdate,
  onFunctionsUpdate,
  onParametricPlotsUpdate,
  onImplicitPlotsUpdate,
  onDeterminantFillsUpdate,
  onVectorsClear,
  onFunctionsClear,
  onParametricPlotsClear,
  onImplicitPlotsClear,
  onDeterminantFillsClear,
  externalExecutionResult,
  onFrameDelete,
}: FrameEditorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('properties')
  const [hasExecutionError, setHasExecutionError] = useState(false)
  const [isExtendedMode, setIsExtendedMode] = useState(false)
  
  // Reset error state when frame changes
  useEffect(() => {
    setHasExecutionError(false)
  }, [selectedFrame?.id])
  
  // Clear error state when external execution succeeds or is cleared
  useEffect(() => {
    if (!externalExecutionResult || (externalExecutionResult && externalExecutionResult.success)) {
      // Clear manual execution error when auto-execution succeeds or is cleared
      // This ensures the badge disappears when execution succeeds
      setHasExecutionError(false)
    }
  }, [externalExecutionResult])
  
  // Determine if there's an error from either manual or auto execution
  // Badge shows if:
  // - Manual execution has an error (hasExecutionError is true), OR
  // - Auto-execution has an error (externalExecutionResult exists and success is false)
  const hasError = hasExecutionError || (externalExecutionResult && !externalExecutionResult.success)

  // Reset extended mode when switching frames (optional - could be per-frame preference)
  useEffect(() => {
    setIsExtendedMode(false)
  }, [selectedFrame?.id])

  // Toggle extended mode
  const toggleExtendedMode = useCallback(() => {
    setIsExtendedMode(prev => !prev)
  }, [])

  // Keyboard shortcut: Ctrl+E (or Cmd+E on Mac) to toggle extended mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when code tab is active
      if (activeTab !== 'code' || !selectedFrame) return
      
      // Check for Ctrl+E (Windows/Linux) or Cmd+E (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        toggleExtendedMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTab, selectedFrame, toggleExtendedMode])

  // Track window width for extended mode calculation
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920)
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate panel width based on tab and extended mode
  // Always use explicit pixel values for code tab to ensure smooth transitions
  const getPanelWidth = () => {
    if (activeTab === 'properties') {
      return 320 // w-80 = 20rem = 320px
    }
    if (isExtendedMode) {
      // Use viewport width but clamp to max 900px
      const vwWidth = windowWidth * 0.7
      return Math.min(vwWidth, 900)
    }
    return 500 // w-[500px]
  }

  const panelWidthPx = getPanelWidth()
  // For code tab, always use inline style for width to ensure smooth transitions
  // For properties tab, use Tailwind class
  const panelWidthClass = activeTab === 'properties' ? 'w-80' : ''
  const panelHeight = activeTab === 'code' ? 'h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)]' : 'h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)]'

  // Animation classes based on selection state
  // When not visible, ensure it doesn't block mouse events and doesn't take up space
  const panelClasses = selectedFrame
    ? 'opacity-100 translate-x-0 pointer-events-auto'
    : 'opacity-0 translate-x-full pointer-events-none'

  // Use separate transitions: width transitions separately from opacity/transform
  // This prevents the jump when transitioning between extended and normal mode
  const widthTransitionClass = 'transition-[width] duration-300 ease-out'
  const otherTransitionClasses = 'transition-[opacity,transform] duration-300 ease-out'

  if (!selectedFrame) {
    return (
      <div 
        className={`${panelWidthClass} ${panelHeight} bg-panel-bg border border-border rounded-lg shadow-lg flex flex-col ${otherTransitionClasses} ${panelClasses}`} 
        style={{ 
          visibility: 'hidden',
          width: activeTab === 'code' ? `${panelWidthPx}px` : undefined,
        }}
      >
      </div>
    )
  }

  return (
    <div 
      className={`${panelWidthClass} ${panelHeight} bg-panel-bg border border-border rounded-lg shadow-lg flex flex-col ${widthTransitionClass} ${otherTransitionClasses} ${panelClasses}`} 
      style={{ 
        visibility: selectedFrame ? 'visible' : 'hidden',
        width: activeTab === 'code' ? `${panelWidthPx}px` : undefined,
      }}
    >
      {/* Tab Navigation */}
      <div className="flex border-b border-border flex-shrink-0">
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-75 ${
            activeTab === 'properties'
              ? 'text-primary border-b-2 border-primary bg-bg-primary/50'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/30'
          }`}
        >
          Frame Properties
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-75 relative ${
            activeTab === 'code'
              ? 'text-primary border-b-2 border-primary bg-bg-primary/50'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/30'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            Code Editor
            {hasError && (
              <span className="px-1.5 py-0.5 text-xs font-normal rounded bg-error text-white">
                (1)
              </span>
            )}
          </span>
        </button>
        {/* Extended Mode Toggle Button - only show when code tab is active */}
        {activeTab === 'code' && (
          <button
            onClick={toggleExtendedMode}
            className={`px-3 py-3 text-sm font-medium transition-colors duration-75 border-b-2 ${
              isExtendedMode
                ? 'text-primary border-primary bg-bg-primary/50'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/30 border-transparent'
            }`}
            title={isExtendedMode ? 'Exit extended mode (Ctrl+E)' : 'Enter extended mode (Ctrl+E)'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {isExtendedMode ? (
                // Compress/minimize icon (arrows pointing inward)
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              ) : (
                // Expand/maximize icon (arrows pointing outward)
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m-5.25 0H3.75m0 0v4.5m0-4.5h4.5M9 9l5.25-5.25M9 9v4.5m0-4.5h4.5m-4.5 0L3.75 3.75m11.25 11.25v4.5m0-4.5h4.5m-4.5 0L15 15m-5.25 0h4.5m0 0v4.5m0-4.5h-4.5m4.5 0L15 15" />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        <div 
          className={`absolute inset-0 transition-opacity duration-75 ${
            activeTab === 'properties' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <PropertiesPanel
            selectedFrame={selectedFrame}
            onFrameUpdate={onFrameUpdate}
            onFrameViewportChange={onFrameViewportChange}
            onCodeRun={onCodeRun}
            onFrameDelete={onFrameDelete}
          />
        </div>
        <div 
          className={`absolute inset-0 transition-opacity duration-75 ${
            activeTab === 'code' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <CodePanel
            selectedFrame={selectedFrame}
            onCodeChange={onCodeChange}
            onCodeRun={onCodeRun}
            onVectorsUpdate={onVectorsUpdate}
            onFunctionsUpdate={onFunctionsUpdate}
            onParametricPlotsUpdate={onParametricPlotsUpdate}
            onImplicitPlotsUpdate={onImplicitPlotsUpdate}
            onDeterminantFillsUpdate={onDeterminantFillsUpdate}
            onVectorsClear={onVectorsClear}
            onFunctionsClear={onFunctionsClear}
            onParametricPlotsClear={onParametricPlotsClear}
            onImplicitPlotsClear={onImplicitPlotsClear}
            onDeterminantFillsClear={onDeterminantFillsClear}
            externalExecutionResult={externalExecutionResult}
            onExecutionErrorChange={setHasExecutionError}
          />
        </div>
      </div>
    </div>
  )
}

export default memo(FrameEditorPanel)

