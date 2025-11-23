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

/**
 * Hook for executing Python code using PyScript
 * Provides Python execution context with NumPy and SciPy support
 */
export function usePyScript(): UsePyScriptReturn {
  const [isReady, setIsReady] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

  // Check if PyScript is loaded and ready
  useEffect(() => {
    const checkPyScript = () => {
      // Check if PyScript/Pyodide is available
      if (typeof window !== 'undefined') {
        // Check for PyScript runtime
        if ((window as any).pyscript?.runtime) {
          setIsReady(true)
          return true
        }
        // Check for Pyodide directly (PyScript uses Pyodide)
        if ((window as any).pyodide) {
          setIsReady(true)
          return true
        }
      }
      return false
    }

    // Check immediately
    if (checkPyScript()) {
      return
    }

    // Poll for PyScript to load
    const interval = setInterval(() => {
      if (checkPyScript()) {
        clearInterval(interval)
      }
    }, 100)

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval)
      if (!isReady) {
        console.warn('PyScript failed to load within 10 seconds')
      }
    }, 10000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [isReady])

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
        // Get Pyodide instance (PyScript uses Pyodide under the hood)
        let pyodide: any = null
        
        // Try PyScript runtime first
        if ((window as any).pyscript?.runtime) {
          pyodide = (window as any).pyscript.runtime.globals.get('pyodide')
        }
        
        // Fallback to direct Pyodide
        if (!pyodide && (window as any).pyodide) {
          pyodide = (window as any).pyodide
        }

        if (!pyodide) {
          throw new Error('PyScript/Pyodide interpreter not available')
        }

        // Ensure NumPy and SciPy are available
        await pyodide.loadPackage(['numpy', 'scipy'])

        // Execute the code
        const result = await pyodide.runPythonAsync(code)

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

