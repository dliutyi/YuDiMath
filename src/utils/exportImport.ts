import type { WorkspaceState, CoordinateFrame } from '../types'

/**
 * Serializes workspace state to JSON string
 * @param workspace - The workspace state to export
 * @returns JSON string representation of the workspace
 */
export function exportWorkspace(workspace: WorkspaceState): string {
  return JSON.stringify(workspace, null, 2)
}

/**
 * Downloads workspace state as a JSON file
 * @param workspace - The workspace state to export
 * @param filename - Optional filename (default: 'yudimath-workspace.json')
 */
export function downloadWorkspace(workspace: WorkspaceState, filename: string = 'yudimath-workspace.json'): void {
  const json = exportWorkspace(workspace)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Validates that a parsed object has the structure of a WorkspaceState
 * @param obj - The object to validate
 * @returns true if the object is a valid WorkspaceState
 */
export function validateWorkspaceState(obj: any): obj is WorkspaceState {
  if (!obj || typeof obj !== 'object') {
    return false
  }

  // Validate viewport
  if (!obj.viewport || typeof obj.viewport !== 'object') {
    return false
  }
  const { viewport } = obj
  if (
    typeof viewport.x !== 'number' ||
    typeof viewport.y !== 'number' ||
    typeof viewport.zoom !== 'number' ||
    typeof viewport.gridStep !== 'number'
  ) {
    return false
  }

  // Validate frames array
  if (!Array.isArray(obj.frames)) {
    return false
  }

  // Validate each frame
  for (const frame of obj.frames) {
    if (!validateFrame(frame)) {
      return false
    }
  }

  // Validate selectedFrameId (can be null or string)
  if (obj.selectedFrameId !== null && typeof obj.selectedFrameId !== 'string') {
    return false
  }

  return true
}

/**
 * Validates that an object has the structure of a CoordinateFrame
 * @param obj - The object to validate
 * @returns true if the object is a valid CoordinateFrame
 */
function validateFrame(obj: any): obj is CoordinateFrame {
  if (!obj || typeof obj !== 'object') {
    return false
  }

  // Required fields
  if (typeof obj.id !== 'string' || !obj.id) {
    return false
  }

  if (!Array.isArray(obj.origin) || obj.origin.length !== 2 || 
      typeof obj.origin[0] !== 'number' || typeof obj.origin[1] !== 'number') {
    return false
  }

  if (!Array.isArray(obj.baseI) || obj.baseI.length !== 2 ||
      typeof obj.baseI[0] !== 'number' || typeof obj.baseI[1] !== 'number') {
    return false
  }

  if (!Array.isArray(obj.baseJ) || obj.baseJ.length !== 2 ||
      typeof obj.baseJ[0] !== 'number' || typeof obj.baseJ[1] !== 'number') {
    return false
  }

  if (!obj.bounds || typeof obj.bounds !== 'object') {
    return false
  }

  if (!obj.viewport || typeof obj.viewport !== 'object') {
    return false
  }

  if (obj.mode !== '2d' && obj.mode !== '3d') {
    return false
  }

  if (!Array.isArray(obj.vectors)) {
    return false
  }

  if (!Array.isArray(obj.functions)) {
    return false
  }

  if (typeof obj.code !== 'string') {
    return false
  }

  if (obj.parentFrameId !== null && typeof obj.parentFrameId !== 'string') {
    return false
  }

  if (!Array.isArray(obj.childFrameIds)) {
    return false
  }

  // Optional parameters field
  if (obj.parameters !== undefined && (typeof obj.parameters !== 'object' || obj.parameters === null)) {
    return false
  }

  return true
}

/**
 * Parses and validates a JSON string as a WorkspaceState
 * @param json - The JSON string to parse
 * @returns The parsed and validated WorkspaceState, or null if invalid
 */
export function parseWorkspace(json: string): WorkspaceState | null {
  try {
    const parsed = JSON.parse(json)
    if (validateWorkspaceState(parsed)) {
      return parsed
    }
    return null
  } catch (error) {
    console.error('[parseWorkspace] Failed to parse JSON:', error)
    return null
  }
}

/**
 * Reads a file and parses it as a WorkspaceState
 * @param file - The file to read
 * @returns Promise that resolves to the parsed WorkspaceState, or null if invalid
 */
export async function importWorkspaceFromFile(file: File): Promise<WorkspaceState | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        resolve(null)
        return
      }
      const workspace = parseWorkspace(text)
      resolve(workspace)
    }
    
    reader.onerror = () => {
      console.error('[importWorkspaceFromFile] Failed to read file')
      resolve(null)
    }
    
    reader.readAsText(file)
  })
}

