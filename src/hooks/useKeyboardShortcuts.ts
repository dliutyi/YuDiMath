import { useEffect, useCallback } from 'react'

/**
 * Hook for managing keyboard shortcuts and preventing browser zoom
 */
export function useKeyboardShortcuts(
  selectedFrameId: string | null,
  onFrameDelete: (frameId: string) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser zoom shortcuts (Ctrl/Cmd + Plus/Minus/0)
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      // Only handle Delete key if no input/textarea is focused
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeElement = document.activeElement
        const isInputFocused = 
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA'
        
        if (!isInputFocused && selectedFrameId) {
          e.preventDefault()
          onFrameDelete(selectedFrameId)
        }
      }
    }

    // Prevent browser zoom with Ctrl/Cmd + wheel
    // BUT allow canvas zoom to work (canvas handles its own wheel events)
    const handleWheel = (e: WheelEvent) => {
      // Check if the event is on the canvas - if so, let it through for canvas zoom
      const target = e.target as HTMLElement
      if (target?.tagName === 'CANVAS' || target?.closest('[data-canvas-container]')) {
        // This is a canvas wheel event - let the canvas handler deal with it
        return
      }
      
      // For non-canvas areas, prevent browser zoom with Ctrl/Cmd + wheel
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Monitor and reset browser zoom level
    const resetZoom = useCallback(() => {
      // Force reset zoom using CSS zoom property (works in Chrome/Edge)
      const html = document.documentElement
      const body = document.body
      
      // Reset zoom property - this is the most reliable way
      html.style.zoom = '1'
      body.style.zoom = '1'
      
      // Also reset transform as fallback
      html.style.transform = 'scale(1)'
      html.style.transformOrigin = 'top left'
      body.style.transform = 'scale(1)'
    }, [])

    // Check zoom level periodically and on resize
    const zoomCheckInterval = setInterval(resetZoom, 50)
    window.addEventListener('resize', resetZoom)
    window.addEventListener('focus', resetZoom)
    
    // Use Visual Viewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resetZoom)
      window.visualViewport.addEventListener('scroll', resetZoom)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    
    return () => {
      clearInterval(zoomCheckInterval)
      window.removeEventListener('resize', resetZoom)
      window.removeEventListener('focus', resetZoom)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', resetZoom)
        window.visualViewport.removeEventListener('scroll', resetZoom)
      }
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('wheel', handleWheel, { capture: true })
    }
  }, [selectedFrameId, onFrameDelete])
}

