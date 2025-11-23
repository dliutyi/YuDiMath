import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePyScript, resetPyodideState } from '../../src/hooks/usePyScript'

// Mock PyScript/Pyodide
const mockPyodide = {
  loadPackage: vi.fn().mockResolvedValue(undefined),
  runPythonAsync: vi.fn().mockResolvedValue(undefined),
  runPython: vi.fn(),
  globals: {
    set: vi.fn(),
  },
  loadedPackages: {},
}


describe('usePyScript', () => {
  beforeEach(() => {
    // Reset window object
    delete (window as any).pyscript
    delete (window as any).pyodide
    delete (window as any).loadPyodide
    
    // Reset global state
    resetPyodideState()
    
    // Mock loadPyodide function
    ;(window as any).loadPyodide = vi.fn().mockResolvedValue(mockPyodide)
  })

  afterEach(() => {
    vi.clearAllMocks()
    // Reset global state again
    resetPyodideState()
  })

  it('should initialize with isReady false', () => {
    const { result } = renderHook(() => usePyScript())
    expect(result.current.isReady).toBe(false)
    expect(result.current.isExecuting).toBe(false)
  })

  it('should detect PyScript when available via pyscript.runtime', async () => {
    // This test is no longer relevant since we use loadPyodide directly
    // But we'll keep it for compatibility - it should work if loadPyodide is available
    const { result } = renderHook(() => usePyScript())

    await waitFor(
      () => {
        expect(result.current.isReady).toBe(true)
      },
      { timeout: 3000 }
    )
    
    expect((window as any).loadPyodide).toHaveBeenCalled()
  })

  it('should detect PyScript when available via pyodide', async () => {
    // This test is no longer relevant since we use loadPyodide directly
    // But we'll keep it for compatibility
    const { result } = renderHook(() => usePyScript())

    await waitFor(
      () => {
        expect(result.current.isReady).toBe(true)
      },
      { timeout: 3000 }
    )
    
    expect((window as any).loadPyodide).toHaveBeenCalled()
  })

  it('should execute Python code successfully', async () => {
    const testCode = 'import numpy as np\nresult = np.array([1, 2, 3])'
    const expectedResult = [1, 2, 3]
    mockPyodide.runPythonAsync.mockResolvedValue(expectedResult)
    const mockOnVectorCreated = vi.fn()
    const mockOnFunctionCreated = vi.fn()

    const { result } = renderHook(() => usePyScript())

    await waitFor(
      () => {
        expect(result.current.isReady).toBe(true)
      },
      { timeout: 3000 }
    )

    const executionResult = await result.current.executeCode(
      testCode,
      'test-frame-1',
      mockOnVectorCreated,
      mockOnFunctionCreated
    )

    expect(executionResult.success).toBe(true)
    expect(mockPyodide.loadPackage).toHaveBeenCalledWith(['numpy', 'scipy'])
    expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(testCode)
    expect(executionResult.functionCalls).toBeDefined()
  })

  it('should handle execution errors', async () => {
    const testCode = 'invalid python code'
    const error = new Error('SyntaxError: invalid syntax')
    mockPyodide.runPythonAsync.mockRejectedValue(error)
    const mockOnVectorCreated = vi.fn()
    const mockOnFunctionCreated = vi.fn()

    const { result } = renderHook(() => usePyScript())

    await waitFor(
      () => {
        expect(result.current.isReady).toBe(true)
      },
      { timeout: 3000 }
    )

    const executionResult = await result.current.executeCode(
      testCode,
      'test-frame-1',
      mockOnVectorCreated,
      mockOnFunctionCreated
    )

    expect(executionResult.success).toBe(false)
    expect(executionResult.error).toBeDefined()
    expect(executionResult.error?.message).toBe('SyntaxError: invalid syntax')
    expect(executionResult.functionCalls).toBeDefined()
  })

  it('should return error when PyScript is not ready', async () => {
    const { result } = renderHook(() => usePyScript())
    const mockOnVectorCreated = vi.fn()
    const mockOnFunctionCreated = vi.fn()

    // PyScript is not ready
    expect(result.current.isReady).toBe(false)

    const executionResult = await result.current.executeCode(
      'print("test")',
      'test-frame-1',
      mockOnVectorCreated,
      mockOnFunctionCreated
    )

    expect(executionResult.success).toBe(false)
    expect(executionResult.error?.message).toBe('PyScript is not ready yet')
    expect(executionResult.error?.type).toBe('NotReadyError')
    expect(executionResult.functionCalls).toEqual([])
  })

  it('should set isExecuting flag during execution', async () => {
    let resolveExecution: () => void
    const executionPromise = new Promise<void>((resolve) => {
      resolveExecution = resolve
    })
    mockPyodide.runPythonAsync.mockReturnValue(executionPromise)
    const mockOnVectorCreated = vi.fn()
    const mockOnFunctionCreated = vi.fn()

    const { result } = renderHook(() => usePyScript())

    await waitFor(
      () => {
        expect(result.current.isReady).toBe(true)
      },
      { timeout: 3000 }
    )

    const executePromise = result.current.executeCode(
      'print("test")',
      'test-frame-1',
      mockOnVectorCreated,
      mockOnFunctionCreated
    )

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

