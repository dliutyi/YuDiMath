import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FrameEditorPanel from '../../src/components/FrameEditorPanel'
import type { CoordinateFrame } from '../../src/types'

// Mock child components
vi.mock('../../src/components/PropertiesPanel', () => ({
  default: vi.fn(({ selectedFrame, onFrameUpdate, onFrameViewportChange, onCodeRun, onFrameDelete }) => (
    <div data-testid="properties-panel">
      Properties Panel - Frame: {selectedFrame?.id}
    </div>
  )),
}))

vi.mock('../../src/components/CodePanel', () => ({
  default: vi.fn(({ selectedFrame, onCodeChange, autoExecuteCode, externalExecutionResult }) => (
    <div data-testid="code-panel">
      Code Panel - Frame: {selectedFrame?.id}
      {autoExecuteCode && <span data-testid="auto-execute-code">{autoExecuteCode}</span>}
      {externalExecutionResult && (
        <span data-testid="execution-result">
          {externalExecutionResult.success ? 'Success' : 'Error'}
        </span>
      )}
    </div>
  )),
}))

describe('FrameEditorPanel', () => {
  const mockFrame: CoordinateFrame = {
    id: 'test-frame-1',
    origin: [5, 10],
    baseI: [1, 0],
    baseJ: [0, 1],
    bounds: {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    },
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
      gridStep: 1,
    },
    mode: '2d',
    vectors: [],
    functions: [],
    code: '',
    parentFrameId: null,
    childFrameIds: [],
  }

  const mockOnFrameUpdate = vi.fn()
  const mockOnFrameViewportChange = vi.fn()
  const mockOnCodeChange = vi.fn()
  const mockOnCodeRun = vi.fn()
  const mockOnVectorsUpdate = vi.fn()
  const mockOnFunctionsUpdate = vi.fn()
  const mockOnVectorsClear = vi.fn()
  const mockOnFunctionsClear = vi.fn()
  const mockOnFrameDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when no frame is selected', () => {
    const { container } = render(
      <FrameEditorPanel
        selectedFrame={null}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
      />
    )
    
    expect(container.firstChild).toBeNull()
  })

  it('should render when frame is selected', () => {
    render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
      />
    )
    
    expect(screen.getByText('Frame Properties')).toBeInTheDocument()
    expect(screen.getByText('Code Editor')).toBeInTheDocument()
  })

  it('should default to properties tab', () => {
    render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
      />
    )
    
    expect(screen.getByTestId('properties-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('code-panel')).not.toBeInTheDocument()
  })

  it('should switch to code tab when clicked', () => {
    render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
      />
    )
    
    const codeTab = screen.getByText('Code Editor')
    fireEvent.click(codeTab)
    
    expect(screen.getByTestId('code-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('properties-panel')).not.toBeInTheDocument()
  })

  it('should switch back to properties tab when clicked', () => {
    render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
      />
    )
    
    // Switch to code tab
    fireEvent.click(screen.getByText('Code Editor'))
    expect(screen.getByTestId('code-panel')).toBeInTheDocument()
    
    // Switch back to properties tab
    fireEvent.click(screen.getByText('Frame Properties'))
    expect(screen.getByTestId('properties-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('code-panel')).not.toBeInTheDocument()
  })

  it('should apply active tab styling', () => {
    render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
      />
    )
    
    const propertiesTab = screen.getByText('Frame Properties').closest('button')
    expect(propertiesTab?.className).toContain('text-primary')
    expect(propertiesTab?.className).toContain('border-primary')
    
    const codeTab = screen.getByText('Code Editor').closest('button')
    expect(codeTab?.className).toContain('text-text-secondary')
  })

  it('should pass selectedFrame to PropertiesPanel', () => {
    render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
      />
    )
    
    expect(screen.getByText(`Properties Panel - Frame: ${mockFrame.id}`)).toBeInTheDocument()
  })

  it('should pass selectedFrame to CodePanel', () => {
    render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
      />
    )
    
    fireEvent.click(screen.getByText('Code Editor'))
    
    expect(screen.getByText(`Code Panel - Frame: ${mockFrame.id}`)).toBeInTheDocument()
  })

  it('should pass autoExecuteCode to CodePanel', () => {
    render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
        autoExecuteCode="test code"
      />
    )
    
    fireEvent.click(screen.getByText('Code Editor'))
    
    expect(screen.getByTestId('auto-execute-code')).toHaveTextContent('test code')
  })

  it('should pass externalExecutionResult to CodePanel', () => {
    const executionResult = { success: false, error: 'Test error' }
    
    render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
        externalExecutionResult={executionResult}
      />
    )
    
    fireEvent.click(screen.getByText('Code Editor'))
    
    expect(screen.getByTestId('execution-result')).toHaveTextContent('Error')
  })

  it('should have correct width for properties tab', () => {
    const { container } = render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
      />
    )
    
    const panel = container.firstChild as HTMLElement
    expect(panel.className).toContain('w-80')
  })

  it('should have correct width for code tab', () => {
    const { container } = render(
      <FrameEditorPanel
        selectedFrame={mockFrame}
        onFrameUpdate={mockOnFrameUpdate}
        onCodeChange={mockOnCodeChange}
      />
    )
    
    fireEvent.click(screen.getByText('Code Editor'))
    
    const panel = container.firstChild as HTMLElement
    expect(panel.className).toContain('w-[500px]')
  })
})

