import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CodePanel from '../../src/components/CodePanel'
import type { CoordinateFrame } from '../../src/types'
import * as usePyScriptModule from '../../src/hooks/usePyScript'

// Mock usePyScript hook
vi.mock('../../src/hooks/usePyScript')

describe('CodePanel', () => {
  let mockOnCodeChange: ReturnType<typeof vi.fn>
  let mockOnCodeRun: ReturnType<typeof vi.fn>
  let testFrame: CoordinateFrame

  beforeEach(() => {
    mockOnCodeChange = vi.fn()
    mockOnCodeRun = vi.fn()
    
    testFrame = {
      id: 'test-frame-1',
      origin: [0, 0],
      baseI: [1, 0],
      baseJ: [0, 1],
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      viewport: { x: 0, y: 0, zoom: 1, gridStep: 1 },
      mode: '2d',
      vectors: [],
      functions: [],
      code: 'print("Hello")',
      parentFrameId: null,
      childFrameIds: [],
    }

    // Mock usePyScript to return ready state by default
    vi.spyOn(usePyScriptModule, 'usePyScript').mockReturnValue({
      isReady: true,
      executeCode: vi.fn().mockResolvedValue({ success: true, result: undefined, functionCalls: [] }),
      isExecuting: false,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('displays nothing when no frame is selected', () => {
    const { container } = render(
      <CodePanel
        selectedFrame={null}
        onCodeChange={mockOnCodeChange}
        onCodeRun={mockOnCodeRun}
      />
    )

    // CodePanel returns null when no frame is selected
    expect(container.firstChild).toBeNull()
  })

  it('displays selected frame code', () => {
    render(
      <CodePanel
        selectedFrame={testFrame}
        onCodeChange={mockOnCodeChange}
        onCodeRun={mockOnCodeRun}
      />
    )

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('print("Hello")')
  })

  it('displays default code when frame has no code', () => {
    const frameWithoutCode: CoordinateFrame = {
      ...testFrame,
      code: '',
    }

    render(
      <CodePanel
        selectedFrame={frameWithoutCode}
        onCodeChange={mockOnCodeChange}
        onCodeRun={mockOnCodeRun}
      />
    )

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toContain('import numpy as np')
    expect(textarea.value).toContain('from scipy import linalg')
  })

  it('updates code on frame selection change', () => {
    const { rerender } = render(
      <CodePanel
        selectedFrame={testFrame}
        onCodeChange={mockOnCodeChange}
        onCodeRun={mockOnCodeRun}
      />
    )

    const newFrame: CoordinateFrame = {
      ...testFrame,
      id: 'test-frame-2',
      code: 'print("New code")',
    }

    rerender(
      <CodePanel
        selectedFrame={newFrame}
        onCodeChange={mockOnCodeChange}
        onCodeRun={mockOnCodeRun}
      />
    )

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('print("New code")')
  })

  it('calls onCodeChange when code is edited', async () => {
    render(
      <CodePanel
        selectedFrame={testFrame}
        onCodeChange={mockOnCodeChange}
        onCodeRun={mockOnCodeRun}
      />
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'new code' } })

    await waitFor(() => {
      expect(mockOnCodeChange).toHaveBeenCalledWith('test-frame-1', 'new code')
    })
  })

  it('shows loading message when PyScript is not ready', () => {
    vi.spyOn(usePyScriptModule, 'usePyScript').mockReturnValue({
      isReady: false,
      executeCode: vi.fn(),
      isExecuting: false,
    })

    render(
      <CodePanel
        selectedFrame={testFrame}
        onCodeChange={mockOnCodeChange}
        onCodeRun={mockOnCodeRun}
      />
    )

    expect(screen.getByText(/Pyodide is loading/)).toBeInTheDocument()
    const runButton = screen.getByRole('button', { name: /run/i })
    expect(runButton).toBeDisabled()
  })

  it('executes code when Run button is clicked', async () => {
    const mockExecuteCode = vi.fn().mockResolvedValue({ 
      success: true, 
      result: undefined,
      functionCalls: []
    })
    vi.spyOn(usePyScriptModule, 'usePyScript').mockReturnValue({
      isReady: true,
      executeCode: mockExecuteCode,
      isExecuting: false,
    })

    render(
      <CodePanel
        selectedFrame={testFrame}
        onCodeChange={mockOnCodeChange}
        onCodeRun={mockOnCodeRun}
      />
    )

    const runButton = screen.getByRole('button', { name: /run/i })
    fireEvent.click(runButton)

    await waitFor(() => {
      expect(mockExecuteCode).toHaveBeenCalled()
      const call = mockExecuteCode.mock.calls[0]
      expect(call[0]).toBe('print("Hello")')
      expect(call[1]).toBe('test-frame-1')
      expect(typeof call[2]).toBe('function') // onVectorCreated
      expect(typeof call[3]).toBe('function') // onFunctionCreated
    })

    await waitFor(() => {
      expect(screen.getByText(/Code executed successfully/i)).toBeInTheDocument()
    })

    expect(mockOnCodeRun).toHaveBeenCalledWith('test-frame-1', 'print("Hello")')
  })

  it('displays error message when code execution fails', async () => {
    const mockExecuteCode = vi.fn().mockResolvedValue({
      success: false,
      error: { message: 'Syntax error', type: 'SyntaxError' },
      functionCalls: [],
    })
    vi.spyOn(usePyScriptModule, 'usePyScript').mockReturnValue({
      isReady: true,
      executeCode: mockExecuteCode,
      isExecuting: false,
    })

    render(
      <CodePanel
        selectedFrame={testFrame}
        onCodeChange={mockOnCodeChange}
        onCodeRun={mockOnCodeRun}
      />
    )

    const runButton = screen.getByRole('button', { name: /run/i })
    fireEvent.click(runButton)

    await waitFor(() => {
      expect(screen.getByText(/Execution Error/i)).toBeInTheDocument()
      expect(screen.getByText('Syntax error')).toBeInTheDocument()
    })

    expect(mockOnCodeRun).not.toHaveBeenCalled()
  })

  it('disables Run button while executing', () => {
    vi.spyOn(usePyScriptModule, 'usePyScript').mockReturnValue({
      isReady: true,
      executeCode: vi.fn().mockResolvedValue({ success: true, result: undefined, functionCalls: [] }),
      isExecuting: true,
    })

    render(
      <CodePanel
        selectedFrame={testFrame}
        onCodeChange={mockOnCodeChange}
        onCodeRun={mockOnCodeRun}
      />
    )

    const runButton = screen.getByRole('button', { name: /running/i })
    expect(runButton).toBeDisabled()
  })
})

