import { useState, useEffect } from 'react'
import { usePyScript } from '../hooks/usePyScript'
import type { CoordinateFrame } from '../types'

interface CodePanelProps {
  selectedFrame: CoordinateFrame | null
  onCodeChange: (frameId: string, code: string) => void
  onCodeRun?: (frameId: string, code: string) => void
}

const DEFAULT_CODE = `# Python code for this frame
# Use NumPy and SciPy for calculations
import numpy as np
import scipy as sp

# Example: Draw a vector
# draw([1, 2], color='#ff0000')

# Example: Plot a function
# plot(lambda x: x**2, x_min=-5, x_max=5, color='#00ff00')
`

export default function CodePanel({
  selectedFrame,
  onCodeChange,
  onCodeRun,
}: CodePanelProps) {
  const [localCode, setLocalCode] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const [executionResult, setExecutionResult] = useState<{ success: boolean; error?: string } | null>(null)
  const { isReady, executeCode, isExecuting } = usePyScript()

  // Update local code when selected frame changes
  useEffect(() => {
    if (selectedFrame) {
      setLocalCode(selectedFrame.code || DEFAULT_CODE)
      setExecutionResult(null)
    } else {
      setLocalCode('')
      setExecutionResult(null)
    }
  }, [selectedFrame])

  // Sync local code changes back to frame
  const handleCodeChange = (newCode: string) => {
    setLocalCode(newCode)
    if (selectedFrame) {
      onCodeChange(selectedFrame.id, newCode)
    }
  }

  const handleRun = async () => {
    if (!selectedFrame || !isReady) {
      return
    }

    setIsRunning(true)
    setExecutionResult(null)

    try {
      const result = await executeCode(localCode)
      
      if (result.success) {
        setExecutionResult({ success: true })
        if (onCodeRun) {
          onCodeRun(selectedFrame.id, localCode)
        }
      } else {
        setExecutionResult({
          success: false,
          error: result.error?.message || 'Unknown error occurred',
        })
      }
    } catch (error: any) {
      setExecutionResult({
        success: false,
        error: error.message || 'Execution failed',
      })
    } finally {
      setIsRunning(false)
    }
  }

  if (!selectedFrame) {
    return (
      <div className="w-80 p-4 bg-panel-bg border border-border rounded-lg shadow-lg">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Code Editor</h2>
        <p className="text-sm text-text-secondary">Select a frame to edit its Python code</p>
      </div>
    )
  }

  return (
    <div className="w-80 p-4 bg-panel-bg border border-border rounded-lg shadow-lg flex flex-col h-full max-h-[calc(100vh-2rem)]">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Code Editor</h2>
      
      {!isReady && (
        <div className="mb-4 p-2 bg-warning/20 border border-warning/50 rounded text-sm text-warning">
          PyScript is loading...
        </div>
      )}

      {executionResult && (
        <div className={`mb-4 p-2 rounded text-sm ${
          executionResult.success
            ? 'bg-success/20 border border-success/50 text-success'
            : 'bg-error/20 border border-error/50 text-error'
        }`}>
          {executionResult.success ? (
            <span>✓ Code executed successfully</span>
          ) : (
            <div>
              <div className="font-medium">Execution Error:</div>
              <div className="text-xs mt-1">{executionResult.error}</div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Python Code
        </label>
        <textarea
          value={localCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="flex-1 w-full px-3 py-2 bg-bg-primary border border-border rounded text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder={DEFAULT_CODE}
          spellCheck={false}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleRun}
          disabled={!isReady || isRunning || isExecuting}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
            !isReady || isRunning || isExecuting
              ? 'bg-bg-secondary text-text-secondary cursor-not-allowed'
              : 'bg-primary text-white hover:bg-blue-600'
          }`}
        >
          {isRunning || isExecuting ? 'Running...' : 'Run'}
        </button>
      </div>
    </div>
  )
}

