import { useRef, useCallback } from 'react'
import { downloadWorkspace, importWorkspaceFromFile } from '../utils/exportImport'
import type { WorkspaceState } from '../types'

/**
 * Hook for managing workspace import/export functionality
 */
export function useWorkspaceImportExport(
  workspace: WorkspaceState,
  onWorkspaceSet: (workspace: WorkspaceState) => void,
  onModalOpen: (state: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onCancel?: () => void
    variant?: 'default' | 'danger'
    secondaryText?: string
    onSecondary?: () => void
  }) => void
) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportWorkspace = useCallback(() => {
    const workspaceState: WorkspaceState = {
      viewport: workspace.viewport,
      frames: workspace.frames,
      selectedFrameId: workspace.selectedFrameId,
    }
    downloadWorkspace(workspaceState)
  }, [workspace])

  const handleImportWorkspace = useCallback(async (file: File) => {
    const imported = await importWorkspaceFromFile(file)
    if (!imported) {
      onModalOpen({
        title: 'Import Failed',
        message: 'Failed to import workspace. The file may be invalid or corrupted.',
        confirmText: 'OK',
        onConfirm: () => {},
        variant: 'danger',
      })
      return
    }

    // Show modal to ask user if they want to replace, merge, or cancel
    onModalOpen({
      title: 'Import Workspace',
      message: 'How would you like to import the workspace?\n\n• Replace: Replace current workspace with imported one\n• Merge: Add imported frames to current workspace\n• Cancel: Abort import',
      confirmText: 'Replace',
      secondaryText: 'Merge',
      cancelText: 'Cancel',
      onConfirm: () => {
        // Replace: set the entire workspace state
        onWorkspaceSet(imported)
      },
      onSecondary: () => {
        // Merge: add imported frames to existing ones, update viewport if needed
        const mergedFrames = [...workspace.frames, ...imported.frames]
        onWorkspaceSet({
          viewport: imported.viewport, // Use imported viewport
          frames: mergedFrames,
          selectedFrameId: imported.selectedFrameId || workspace.selectedFrameId,
        })
      },
      onCancel: () => {
        // Cancel: do nothing, just close the modal
      },
    })
  }, [workspace, onWorkspaceSet, onModalOpen])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleImportWorkspace(file)
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [handleImportWorkspace])

  return {
    fileInputRef,
    handleExportWorkspace,
    handleImportClick,
    handleFileChange,
  }
}

