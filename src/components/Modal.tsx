import { useEffect } from 'react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: 'default' | 'danger'
  // Optional third button (e.g., for Replace/Merge/Cancel)
  secondaryText?: string
  onSecondary?: () => void
}

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  secondaryText,
  onSecondary,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    onClose()
  }

  const handleSecondary = () => {
    if (onSecondary) {
      onSecondary()
    }
    onClose()
  }

  const isDanger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div
        className="relative bg-panel-bg border border-border rounded-xl shadow-2xl max-w-md w-full p-6 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2 className="text-xl font-bold text-text-primary mb-3">{title}</h2>
        
        {/* Message */}
        <p className="text-text-secondary mb-6 whitespace-pre-line">{message}</p>
        
        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          {onCancel && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg transition-all duration-200 bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-hover/50 hover:border-border hover:shadow-md"
            >
              {cancelText}
            </button>
          )}
          {onSecondary && secondaryText && (
            <button
              onClick={handleSecondary}
              className="px-4 py-2 rounded-lg transition-all duration-200 bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 hover:border-primary hover:shadow-md"
            >
              {secondaryText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
              isDanger
                ? 'bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/50'
                : 'bg-primary text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-primary/50'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

