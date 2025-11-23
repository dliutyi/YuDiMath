import { useEffect, useState, useCallback } from 'react'

interface PyScriptError {
  message: string
  type: string
  traceback?: string
}

interface UsePyScriptReturn {
  isReady: boolean
  executeCode: (code: string) => Promise<{ success: boolean; error?: PyScriptError; result?: any }>
  isExecuting: boolean
}

// Global Pyodide instance - shared across all hook instances
let globalPyodideInstance: any = null
let globalLoadingPromise: Promise<any> | null = null
let globalIsReady = false

// Export reset function for testing
export function resetPyodideState() {
  globalPyodideInstance = null
  globalLoadingPromise = null
  globalIsReady = false
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
          
          console.log('[usePyScript] Packages installed, Pyodide ready!')
          
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
   * Execute Python code and return the result
   */
  const executeCode = useCallback(
    async (code: string): Promise<{ success: boolean; error?: PyScriptError; result?: any }> => {
      if (!isReady) {
        return {
          success: false,
          error: {
            message: 'PyScript is not ready yet',
            type: 'NotReadyError',
          },
        }
      }

      setIsExecuting(true)

      try {
        // Use the global Pyodide instance
        const pyodide = globalPyodideInstance

        if (!pyodide) {
          throw new Error('Pyodide is not ready yet. Please wait for it to finish loading.')
        }

        // Execute the code
        console.log('[usePyScript] Executing Python code...')
        const result = await pyodide.runPythonAsync(code)
        console.log('[usePyScript] Code executed successfully')

        setIsExecuting(false)
        return {
          success: true,
          result,
        }
      } catch (error: any) {
        setIsExecuting(false)
        
        const pyScriptError: PyScriptError = {
          message: error.message || 'Unknown error occurred',
          type: error.name || 'ExecutionError',
          traceback: error.traceback || error.stack,
        }

        return {
          success: false,
          error: pyScriptError,
        }
      }
    },
    [isReady]
  )

  return {
    isReady,
    executeCode,
    isExecuting,
  }
}

