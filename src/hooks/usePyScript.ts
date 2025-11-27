import { useEffect, useState, useCallback } from 'react'
import {
  setupFunctionContext,
  clearFunctionContext,
  getCapturedCalls,
  injectFunctionsIntoPyodide,
  updateCanvasInfoInPyodide,
} from '../utils/pythonFunctions'
import type { Vector, FunctionPlot } from '../types'

interface PyScriptError {
  message: string
  type: string
  traceback?: string
}

interface UsePyScriptReturn {
  isReady: boolean
  executeCode: (
    code: string,
    frameId: string,
    onVectorCreated: (vector: Omit<Vector, 'id'>) => void,
    onFunctionCreated: (func: Omit<FunctionPlot, 'id'>) => void,
    canvasWidth?: number,
    canvasHeight?: number,
    pixelsPerUnit?: number,
    isSliderChange?: boolean
  ) => Promise<{ success: boolean; error?: PyScriptError; result?: any; functionCalls: Array<{ name: string; args: unknown[]; frameId: string }> }>
  isExecuting: boolean
}

// Global Pyodide instance - shared across all hook instances
let globalPyodideInstance: any = null
let globalLoadingPromise: Promise<any> | null = null
let globalIsReady = false

// Execution queue management
let lastExecutionCompletionTime: number = 0
let executionQueue: Array<{
  resolve: (value: any) => void
  reject: (error: any) => void
  code: string
  frameId: string
  onVectorCreated: (vector: Omit<Vector, 'id'>) => void
  onFunctionCreated: (func: Omit<FunctionPlot, 'id'>) => void
  canvasWidth?: number
  canvasHeight?: number
  pixelsPerUnit?: number
  isSliderChange?: boolean
}> = []
let isProcessingQueue = false
const EXECUTION_DELAY_MS = 0 // No delay - execute immediately for better responsiveness

// Function to clear queued executions for a specific frame (used for slider changes)
export function clearQueuedExecutionsForFrame(frameId: string): void {
  // Remove all queued executions for this frame
  const beforeLength = executionQueue.length
  executionQueue = executionQueue.filter(item => item.frameId !== frameId)
  const removed = beforeLength - executionQueue.length
  if (removed > 0) {
    console.log(`[usePyScript] Cleared ${removed} queued executions for frame ${frameId}`)
  }
}

// Export reset function for testing
export function resetPyodideState() {
  globalPyodideInstance = null
  globalLoadingPromise = null
  globalIsReady = false
  lastExecutionCompletionTime = 0
  executionQueue = []
  isProcessingQueue = false
}

/**
 * Hook for executing Python code using Pyodide
 * Provides Python execution context with NumPy and SciPy support
 */
export function usePyScript(): UsePyScriptReturn {
  const [isReady, setIsReady] = useState(globalIsReady)
  const [isExecuting, setIsExecuting] = useState(false)

  // Load and initialize Pyodide (only once globally)
  useEffect(() => {
    let mounted = true

    // If already ready, just update state
    if (globalIsReady && globalPyodideInstance) {
      setIsReady(true)
      return
    }

    // If already loading, wait for it
    if (globalLoadingPromise) {
      globalLoadingPromise.then(() => {
        if (mounted) {
          setIsReady(globalIsReady)
        }
      }).catch(() => {
        // Error already logged
      })
      return
    }

    const loadPyodide = async () => {
      try {
        console.log('[usePyScript] Starting Pyodide load...')
        
        // Check if loadPyodide is available
        if (typeof window !== 'undefined' && (window as any).loadPyodide) {
          console.log('[usePyScript] loadPyodide function found, initializing...')
          
          // Load Pyodide with NumPy and SciPy
          const pyodide = await (window as any).loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
          })
          
          console.log('[usePyScript] Pyodide loaded, installing packages...')
          
          // Install NumPy and SciPy
          await pyodide.loadPackage(['numpy', 'scipy'])
          
          console.log('[usePyScript] Packages installed, injecting predefined functions...')
          
          // Inject predefined functions into Python context
          injectFunctionsIntoPyodide(pyodide)
          
          console.log('[usePyScript] Pyodide ready!')
          
          // Store globally
          globalPyodideInstance = pyodide
          globalIsReady = true
          globalLoadingPromise = null
          
          // Update all hook instances
          if (mounted) {
            setIsReady(true)
          }
        } else {
          // Fallback: check if Pyodide is already loaded
          const win = window as any
          if (win.pyodide && typeof win.pyodide.runPythonAsync === 'function') {
            console.log('[usePyScript] Pyodide already loaded')
            globalPyodideInstance = win.pyodide
            globalIsReady = true
            globalLoadingPromise = null
            if (mounted) {
              setIsReady(true)
            }
          } else {
            console.warn('[usePyScript] loadPyodide not found, waiting for script to load...')
            // Wait a bit and try again (but don't create a new promise)
            setTimeout(() => {
              if (mounted && !globalIsReady && !globalLoadingPromise) {
                globalLoadingPromise = loadPyodide()
              }
            }, 1000)
          }
        }
      } catch (error: any) {
        console.error('[usePyScript] Error loading Pyodide:', error)
        globalLoadingPromise = null
        if (mounted) {
          console.error('[usePyScript] Pyodide loading failed:', error.message)
        }
      }
    }

    // Wait for window and loadPyodide to be available
    if (typeof window !== 'undefined') {
      // Check if loadPyodide is already available
      if ((window as any).loadPyodide) {
        globalLoadingPromise = loadPyodide()
      } else {
        // Wait for script to load
        const checkLoadPyodide = setInterval(() => {
          if ((window as any).loadPyodide && !globalLoadingPromise && !globalIsReady) {
            clearInterval(checkLoadPyodide)
            globalLoadingPromise = loadPyodide()
          }
        }, 100)

        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkLoadPyodide)
          if (mounted && !globalIsReady) {
            console.error('[usePyScript] loadPyodide not available after 30 seconds')
            console.error('[usePyScript] Available on window:', Object.keys(window).filter(k => k.toLowerCase().includes('py')))
          }
        }, 30000)

        return () => {
          mounted = false
          clearInterval(checkLoadPyodide)
        }
      }
    }

    return () => {
      mounted = false
    }
  }, []) // Empty dependency array - only run once

  /**
   * Process the execution queue
   */
  const processQueue = useCallback(async () => {
    if (isProcessingQueue || executionQueue.length === 0) {
      return
    }

    isProcessingQueue = true

    while (executionQueue.length > 0) {
      const item = executionQueue.shift()!
      
      // Wait for previous execution to complete + 3ms delay
      const timeSinceLastExecution = Date.now() - lastExecutionCompletionTime
      if (timeSinceLastExecution < EXECUTION_DELAY_MS) {
        const waitTime = EXECUTION_DELAY_MS - timeSinceLastExecution
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      // Execute the code
      try {
        setIsExecuting(true)

        // Use the global Pyodide instance
        const pyodide = globalPyodideInstance

        if (!pyodide) {
          throw new Error('Pyodide is not ready yet. Please wait for it to finish loading.')
        }

        // For slider changes, use minimal setup to reduce overhead
        if (item.isSliderChange) {
          // Minimal setup for sliders - just update canvas info
          updateCanvasInfoInPyodide(pyodide, true)
          // Set up minimal function context (skip some overhead)
          setupFunctionContext(
            item.frameId,
            item.onVectorCreated,
            item.onFunctionCreated,
            item.canvasWidth,
            item.canvasHeight,
            item.pixelsPerUnit
          )
        } else {
          // Full setup for non-slider executions
          setupFunctionContext(
            item.frameId,
            item.onVectorCreated,
            item.onFunctionCreated,
            item.canvasWidth,
            item.canvasHeight,
            item.pixelsPerUnit
          )
          // Update canvas info in Pyodide before execution (for screen-resolution-aware sampling)
          updateCanvasInfoInPyodide(pyodide, false)
        }

        // Execute the code
        // Skip logging for slider changes to reduce overhead
        if (!item.isSliderChange) {
          console.log('[usePyScript] Executing Python code for frame:', item.frameId)
        }
        const result = await pyodide.runPythonAsync(item.code)
        
        // Get captured function calls
        const functionCalls = getCapturedCalls()
        if (!item.isSliderChange) {
          console.log('[usePyScript] Code executed successfully')
          console.log('[usePyScript] Captured function calls:', functionCalls)
        }

        clearFunctionContext()
        
        // Update completion time
        lastExecutionCompletionTime = Date.now()
        setIsExecuting(false)

        item.resolve({
          success: true,
          result,
          functionCalls,
        })
      } catch (error: any) {
        clearFunctionContext()
        
        // Extract error message from various Pyodide error formats
        let errorMessage = 'Unknown error occurred'
        let errorType = 'ExecutionError'
        let errorTraceback: string | undefined = undefined
        
        // Try various ways to extract the error message
        if (typeof error === 'string') {
          errorMessage = error
        } else if (error && typeof error === 'object') {
          // Check for message property
          if (error.message && typeof error.message === 'string') {
            errorMessage = error.message
          }
          // Check for args (Pyodide PythonError sometimes has args array)
          else if (error.args && Array.isArray(error.args) && error.args.length > 0) {
            const firstArg = error.args[0]
            if (typeof firstArg === 'string') {
              errorMessage = firstArg
            } else if (firstArg && typeof firstArg === 'object' && firstArg.message) {
              errorMessage = firstArg.message
            }
          }
          // Check for toString method
          else if (typeof error.toString === 'function') {
            const errorStr = error.toString()
            if (errorStr && errorStr !== '[object Object]') {
              errorMessage = errorStr
            }
          }
          
          // Extract error type
          if (error.name && typeof error.name === 'string') {
            errorType = error.name
          } else if (error.type && typeof error.type === 'string') {
            errorType = error.type
          }
          
          // Extract traceback
          if (error.traceback && typeof error.traceback === 'string') {
            errorTraceback = error.traceback
          } else if (error.stack && typeof error.stack === 'string') {
            errorTraceback = error.stack
          }
          
          // If we still don't have a good message, try to parse traceback
          if (errorMessage === 'Unknown error occurred' && errorTraceback) {
            // Try to extract the last line of traceback (usually the error message)
            const tracebackLines = errorTraceback.split('\n')
            for (let i = tracebackLines.length - 1; i >= 0; i--) {
              const line = tracebackLines[i].trim()
              if (line && !line.startsWith('File') && !line.startsWith('at ') && line !== 'Traceback (most recent call last):') {
                errorMessage = line
                break
              }
            }
          }
        }
        
        const pyScriptError: PyScriptError = {
          message: errorMessage,
          type: errorType,
          traceback: errorTraceback,
        }

        // Update completion time even on error
        lastExecutionCompletionTime = Date.now()
        setIsExecuting(false)

        // Resolve with error instead of rejecting, so CodePanel can handle it properly
        item.resolve({
          success: false,
          error: pyScriptError,
          functionCalls: getCapturedCalls(), // Return any calls captured before error
        })
      }
    }

    isProcessingQueue = false
  }, [])

  /**
   * Execute Python code and return the result
   * Queues executions to ensure they don't start until previous one completes + 3ms
   */
  const executeCode = useCallback(
    async (
      code: string,
      frameId: string,
      onVectorCreated: (vector: Omit<Vector, 'id'>) => void,
      onFunctionCreated: (func: Omit<FunctionPlot, 'id'>) => void,
      canvasWidth?: number,
      canvasHeight?: number,
      pixelsPerUnit?: number,
      isSliderChange?: boolean
    ): Promise<{ success: boolean; error?: PyScriptError; result?: any; functionCalls: Array<{ name: string; args: unknown[]; frameId: string }> }> => {
      if (!isReady) {
        return {
          success: false,
          error: {
            message: 'PyScript is not ready yet',
            type: 'NotReadyError',
          },
          functionCalls: [],
        }
      }

        // Queue the execution
        return new Promise((resolve, reject) => {
          executionQueue.push({
            resolve,
            reject,
            code,
            frameId,
            onVectorCreated,
            onFunctionCreated,
            canvasWidth,
            canvasHeight,
            pixelsPerUnit,
            isSliderChange: isSliderChange || false,
          })

        // Start processing the queue if not already processing
        processQueue()
      })
    },
    [isReady, processQueue]
  )

  return {
    isReady,
    executeCode,
    isExecuting,
  }
}

