import { useState, useCallback } from 'react'

export interface ModalState {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: 'default' | 'danger'
  secondaryText?: string
  onSecondary?: () => void
}

const DEFAULT_MODAL_STATE: ModalState = {
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
}

/**
 * Hook for managing modal state
 */
export function useModal() {
  const [modalState, setModalState] = useState<ModalState>(DEFAULT_MODAL_STATE)

  const openModal = useCallback((state: Partial<ModalState> & { title: string; message: string; onConfirm: () => void }) => {
    setModalState({
      ...DEFAULT_MODAL_STATE,
      ...state,
      isOpen: true,
    })
  }, [])

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }))
  }, [])

  return {
    modalState,
    openModal,
    closeModal,
    setModalState,
  }
}

