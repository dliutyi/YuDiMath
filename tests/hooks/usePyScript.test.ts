import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePyScript } from '../../src/hooks/usePyScript'

// Mock PyScript/Pyodide
const mockPyodide = {
  loadPackage: vi.fn().mockResolvedValue(undefined),
  runPythonAsync: vi.fn().mockResolvedValue(undefined),
}

describe('usePyScript', () => {
  beforeEach(() => {
    // Reset window object
    delete (window as any).pyscript
    delete (window as any).pyodide
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with isReady false', () => {
    const { result } = renderHook(() => usePyScript())
    expect(result.current.isReady).toBe(false)
    expect(result.current.isExecuting).toBe(false)
  })

  it('should detect PyScript when available via pyscript.runtime', async () => {
    // Mock PyScript runtime
    ;(window as any).pyscript = {
      runtime: {
        globals: {
          get: vi.fn().mockReturnValue(mockPyodide),
        },
      },
    }

    const { result } = renderHook(() => usePyScript())

    await waitFor(
      () => {
        expect(result.current.isReady).toBe(true)
      },
      { timeout: 2000 }
    )
  })

  it('should detect PyScript when available via pyodide', async () => {
    // Mock Pyodide directly
    ;(window as any).pyodide = mockPyodide

    const { result } = renderHook(() => usePyScript())

    await waitFor(
      () => {
        expect(result.current.isReady).toBe(true)
      },
      { timeout: 2000 }
    )
  })

  it('should execute Python code successfully', async () => {
    const testCode = 'import numpy as np\nresult = np.array([1, 2, 3])'
    const expectedResult = [1, 2, 3]
    mockPyodide.runPythonAsync.mockResolvedValue(expectedResult)

    ;(window as any).pyodide = mockPyodide

    const { result } = renderHook(() => usePyScript())

    await waitFor(
      () => {
        expect(result.current.isReady).toBe(true)
      },
      { timeout: 2000 }
    )

    const executionResult = await result.current.executeCode(testCode)

    expect(executionResult.success).toBe(true)
    expect(executionResult.result).toEqual(expectedResult)
    expect(mockPyodide.loadPackage).toHaveBeenCalledWith(['numpy', 'scipy'])
    expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(testCode)
  })

  it('should handle execution errors', async () => {
    const testCode = 'invalid python code'
    const error = new Error('SyntaxError: invalid syntax')
    mockPyodide.runPythonAsync.mockRejectedValue(error)

    ;(window as any).pyodide = mockPyodide

    const { result } = renderHook(() => usePyScript())

    await waitFor(
      () => {
        expect(result.current.isReady).toBe(true)
      },
      { timeout: 2000 }
    )

    const executionResult = await result.current.executeCode(testCode)

    expect(executionResult.success).toBe(false)
    expect(executionResult.error).toBeDefined()
    expect(executionResult.error?.message).toBe('SyntaxError: invalid syntax')
    expect(executionResult.error?.type).toBe('Error')
  })

  it('should return error when PyScript is not ready', async () => {
    const { result } = renderHook(() => usePyScript())

    // PyScript is not ready
    expect(result.current.isReady).toBe(false)

    const executionResult = await result.current.executeCode('print("test")')

    expect(executionResult.success).toBe(false)
    expect(executionResult.error?.message).toBe('PyScript is not ready yet')
    expect(executionResult.error?.type).toBe('NotReadyError')
  })

  it('should set isExecuting flag during execution', async () => {
    let resolveExecution: () => void
    const executionPromise = new Promise<void>((resolve) => {
      resolveExecution = resolve
    })
    mockPyodide.runPythonAsync.mockReturnValue(executionPromise)

    ;(window as any).pyodide = mockPyodide

    const { result } = renderHook(() => usePyScript())

    await waitFor(
      () => {
        expect(result.current.isReady).toBe(true)
      },
      { timeout: 2000 }
    )

    const executePromise = result.current.executeCode('print("test")')

    // Wait for state update - isExecuting should become true
    await waitFor(
      () => {
        expect(result.current.isExecuting).toBe(true)
      },
      { timeout: 1000 }
    )

    // Resolve the execution
    resolveExecution!()
    await executePromise

    // Check that isExecuting is false after execution
    await waitFor(
      () => {
        expect(result.current.isExecuting).toBe(false)
      },
      { timeout: 1000 }
    )
  })
})

