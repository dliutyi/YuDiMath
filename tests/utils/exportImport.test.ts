import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  exportWorkspace,
  downloadWorkspace,
  validateWorkspaceState,
  parseWorkspace,
  importWorkspaceFromFile,
} from '../../src/utils/exportImport'
import type { WorkspaceState, CoordinateFrame } from '../../src/types'

describe('exportImport', () => {
  const createMockFrame = (id: string, parentFrameId: string | null = null): CoordinateFrame => ({
    id,
    origin: [0, 0],
    baseI: [1, 0],
    baseJ: [0, 1],
    bounds: {
      minU: 0,
      maxU: 100,
      minV: 0,
      maxV: 100,
    },
    viewport: { x: 0, y: 0, zoom: 1.0, gridStep: 1 },
    mode: '2d',
    vectors: [],
    functions: [],
    code: '',
    parentFrameId,
    childFrameIds: [],
  })

  const createMockWorkspace = (): WorkspaceState => ({
    viewport: { x: 0, y: 0, zoom: 50.0, gridStep: 1 },
    frames: [createMockFrame('frame1')],
    selectedFrameId: 'frame1',
  })

  describe('exportWorkspace', () => {
    it('should serialize workspace to JSON string', () => {
      const workspace = createMockWorkspace()
      const json = exportWorkspace(workspace)

      expect(json).toBeTruthy()
      expect(typeof json).toBe('string')

      const parsed = JSON.parse(json)
      expect(parsed.viewport).toEqual(workspace.viewport)
      expect(parsed.frames).toHaveLength(1)
      expect(parsed.selectedFrameId).toBe('frame1')
    })

    it('should include all frame data in export', () => {
      const frame = createMockFrame('frame1')
      frame.vectors = [{ id: 'vec1', start: [0, 0], end: [1, 1], color: '#ff0000' }]
      frame.functions = [{ id: 'func1', expression: 'x', xMin: -5, xMax: 5, color: '#00ff00', points: [] }]
      frame.parameters = { t1: 5.0, t2: -3.5 }

      const workspace: WorkspaceState = {
        viewport: { x: 10, y: 20, zoom: 2.0, gridStep: 0.5 },
        frames: [frame],
        selectedFrameId: 'frame1',
      }

      const json = exportWorkspace(workspace)
      const parsed = JSON.parse(json)

      expect(parsed.frames[0].vectors).toHaveLength(1)
      expect(parsed.frames[0].functions).toHaveLength(1)
      expect(parsed.frames[0].parameters).toEqual({ t1: 5.0, t2: -3.5 })
    })
  })

  describe('downloadWorkspace', () => {
    beforeEach(() => {
      // Mock URL.createObjectURL and URL.revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
      global.URL.revokeObjectURL = vi.fn()

      // Mock document.createElement and appendChild/removeChild
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      }
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any)
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any)
    })

    it('should create and download a JSON file', () => {
      const workspace = createMockWorkspace()
      downloadWorkspace(workspace)

      expect(document.createElement).toHaveBeenCalledWith('a')
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    it('should use custom filename when provided', () => {
      const workspace = createMockWorkspace()
      downloadWorkspace(workspace, 'custom-workspace.json')

      const mockLink = document.createElement('a') as any
      expect(mockLink.download).toBe('custom-workspace.json')
    })
  })

  describe('validateWorkspaceState', () => {
    it('should validate a correct workspace state', () => {
      const workspace = createMockWorkspace()
      expect(validateWorkspaceState(workspace)).toBe(true)
    })

    it('should reject invalid workspace state', () => {
      expect(validateWorkspaceState(null)).toBe(false)
      expect(validateWorkspaceState(undefined)).toBe(false)
      expect(validateWorkspaceState({})).toBe(false)
    })

    it('should reject workspace with invalid viewport', () => {
      const workspace = createMockWorkspace()
      workspace.viewport = {} as any
      expect(validateWorkspaceState(workspace)).toBe(false)
    })

    it('should reject workspace with invalid frames array', () => {
      const workspace = createMockWorkspace()
      workspace.frames = 'not an array' as any
      expect(validateWorkspaceState(workspace)).toBe(false)
    })

    it('should reject workspace with invalid frame', () => {
      const workspace = createMockWorkspace()
      workspace.frames = [{} as any]
      expect(validateWorkspaceState(workspace)).toBe(false)
    })

    it('should reject workspace with invalid selectedFrameId', () => {
      const workspace = createMockWorkspace()
      workspace.selectedFrameId = 123 as any
      expect(validateWorkspaceState(workspace)).toBe(false)
    })
  })

  describe('parseWorkspace', () => {
    it('should parse valid JSON workspace', () => {
      const workspace = createMockWorkspace()
      const json = JSON.stringify(workspace)
      const parsed = parseWorkspace(json)

      expect(parsed).not.toBeNull()
      expect(parsed?.viewport).toEqual(workspace.viewport)
      expect(parsed?.frames).toHaveLength(1)
    })

    it('should return null for invalid JSON', () => {
      const parsed = parseWorkspace('invalid json')
      expect(parsed).toBeNull()
    })

    it('should return null for JSON with invalid structure', () => {
      const parsed = parseWorkspace('{"invalid": "structure"}')
      expect(parsed).toBeNull()
    })
  })

  describe('importWorkspaceFromFile', () => {
    it('should read and parse a valid workspace file', async () => {
      const workspace = createMockWorkspace()
      const json = JSON.stringify(workspace)
      const blob = new Blob([json], { type: 'application/json' })
      const file = new File([blob], 'workspace.json', { type: 'application/json' })

      const imported = await importWorkspaceFromFile(file)

      expect(imported).not.toBeNull()
      expect(imported?.viewport).toEqual(workspace.viewport)
      expect(imported?.frames).toHaveLength(1)
    })

    it('should return null for invalid file content', async () => {
      const blob = new Blob(['invalid json'], { type: 'application/json' })
      const file = new File([blob], 'workspace.json', { type: 'application/json' })

      const imported = await importWorkspaceFromFile(file)

      expect(imported).toBeNull()
    })

    it('should handle file read errors', async () => {
      // Create a mock file that will fail to read
      const file = {
        name: 'test.json',
        type: 'application/json',
        size: 100,
      } as File

      // Mock FileReader to simulate error
      const originalFileReader = global.FileReader
      global.FileReader = class {
        onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
        result: string | ArrayBuffer | null = null

        readAsText() {
          // Simulate error
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new ProgressEvent('error') as any)
            }
          }, 0)
        }
      } as any

      const imported = await importWorkspaceFromFile(file)

      expect(imported).toBeNull()

      // Restore original FileReader
      global.FileReader = originalFileReader
    })
  })
})

