import { useState, useEffect, memo } from 'react'
import PropertiesPanel from './PropertiesPanel'
import CodePanel from './CodePanel'
import type { CoordinateFrame, ViewportState, Vector, FunctionPlot } from '../types'

interface FrameEditorPanelProps {
  selectedFrame: CoordinateFrame | null
  onFrameUpdate: (frameId: string, updates: Partial<CoordinateFrame>) => void
  onFrameViewportChange?: (frameId: string, viewport: ViewportState) => void
  onCodeChange: (frameId: string, code: string) => void
  onCodeRun?: (frameId: string, code: string) => void
  onVectorsUpdate?: (frameId: string, vectors: Vector[], replace?: boolean) => void
  onFunctionsUpdate?: (frameId: string, functions: FunctionPlot[], replace?: boolean) => void
  onVectorsClear?: (frameId: string) => void
  onFunctionsClear?: (frameId: string) => void
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
  onVectorsClear,
  onFunctionsClear,
  externalExecutionResult,
  onFrameDelete,
}: FrameEditorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('properties')
  const [hasExecutionError, setHasExecutionError] = useState(false)
  
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

  const panelWidth = activeTab === 'properties' ? 'w-80' : 'w-[500px]'
  const panelHeight = activeTab === 'code' ? 'h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)]' : 'h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)]'

  // Animation classes based on selection state
  // When not visible, ensure it doesn't block mouse events and doesn't take up space
  const panelClasses = selectedFrame
    ? 'opacity-100 translate-x-0 pointer-events-auto'
    : 'opacity-0 translate-x-full pointer-events-none'

  if (!selectedFrame) {
    return (
      <div className={`${panelWidth} ${panelHeight} bg-panel-bg border border-border rounded-lg shadow-lg flex flex-col transition-all duration-300 ease-out ${panelClasses}`} style={{ visibility: 'hidden' }}>
      </div>
    )
  }

  return (
    <div className={`${panelWidth} ${panelHeight} bg-panel-bg border border-border rounded-lg shadow-lg flex flex-col transition-all duration-300 ease-out ${panelClasses}`} style={{ visibility: selectedFrame ? 'visible' : 'hidden' }}>
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
          Code Editor
          {hasError && (
            <span className="ml-2 px-1.5 py-0.5 text-xs font-normal rounded bg-error text-white">
              (1)
            </span>
          )}
        </button>
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
            onVectorsClear={onVectorsClear}
            onFunctionsClear={onFunctionsClear}
            externalExecutionResult={externalExecutionResult}
            onExecutionErrorChange={setHasExecutionError}
          />
        </div>
      </div>
    </div>
  )
}

export default memo(FrameEditorPanel)

