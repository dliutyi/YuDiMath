import { useState } from 'react'
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
  autoExecuteCode?: string | null
  onFrameDelete?: (frameId: string) => void
}

type TabType = 'properties' | 'code'

export default function FrameEditorPanel({
  selectedFrame,
  onFrameUpdate,
  onFrameViewportChange,
  onCodeChange,
  onCodeRun,
  onVectorsUpdate,
  onFunctionsUpdate,
  onVectorsClear,
  onFunctionsClear,
  autoExecuteCode,
  onFrameDelete,
}: FrameEditorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('properties')

  if (!selectedFrame) {
    return null
  }

  const panelWidth = activeTab === 'properties' ? 'w-80' : 'w-[500px]'
  const panelHeight = activeTab === 'code' ? 'h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)]' : 'h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)]'

  return (
    <div className={`${panelWidth} ${panelHeight} bg-panel-bg border border-border rounded-lg shadow-lg flex flex-col transition-all duration-300`}>
      {/* Tab Navigation */}
      <div className="flex border-b border-border flex-shrink-0">
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'properties'
              ? 'text-primary border-b-2 border-primary bg-bg-primary/50'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/30'
          }`}
        >
          Frame Properties
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'code'
              ? 'text-primary border-b-2 border-primary bg-bg-primary/50'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/30'
          }`}
        >
          Code Editor
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'properties' ? (
          <PropertiesPanel
            selectedFrame={selectedFrame}
            onFrameUpdate={onFrameUpdate}
            onFrameViewportChange={onFrameViewportChange}
            onCodeRun={onCodeRun}
            onFrameDelete={onFrameDelete}
          />
        ) : (
          <CodePanel
            selectedFrame={selectedFrame}
            onCodeChange={onCodeChange}
            onCodeRun={onCodeRun}
            onVectorsUpdate={onVectorsUpdate}
            onFunctionsUpdate={onFunctionsUpdate}
            onVectorsClear={onVectorsClear}
            onFunctionsClear={onFunctionsClear}
            autoExecuteCode={autoExecuteCode}
          />
        )}
      </div>
    </div>
  )
}

