import { usePyScript } from '../hooks/usePyScript'
import { useState, useEffect, useRef } from 'react'

export default function LoadingOverlay() {
  const { isReady } = usePyScript()
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const animationFrameRef = useRef<number | null>(null)
  const fadeOutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Simulate smooth progress while loading
  useEffect(() => {
    let lastUpdate = Date.now()
    let shouldContinue = true
    
    const animate = () => {
      if (!shouldContinue) return
      
      const now = Date.now()
      const deltaTime = (now - lastUpdate) / 1000 // seconds
      lastUpdate = now
      
      if (isReady) {
        // When ready, quickly animate to 100%
        setProgress((prev) => {
          if (prev >= 100) {
            // Stop animation when we reach 100%
            shouldContinue = false
            // Trigger fade-out after a brief delay
            if (fadeOutTimeoutRef.current === null) {
              fadeOutTimeoutRef.current = setTimeout(() => {
                setFadeOut(true)
              }, 500)
            }
            return 100
          }
          
          const targetProgress = 100
          const distanceToTarget = targetProgress - prev
          // Fast animation to 100%
          const speed = Math.min(50 * deltaTime, distanceToTarget * 0.3)
          const newProgress = Math.min(prev + speed, 100)
          
          // If we just reached 100%, schedule fade-out
          if (newProgress >= 100 && fadeOutTimeoutRef.current === null) {
            shouldContinue = false
            fadeOutTimeoutRef.current = setTimeout(() => {
              setFadeOut(true)
            }, 500)
          }
          
          return newProgress
        })
      } else {
        // Smooth, gradual progress increase (up to 95%) - much faster
        const targetProgress = 95
        
        setProgress((prev) => {
          if (prev >= targetProgress) {
            return prev
          }
          
          // Much faster progress: start quick, maintain speed
          const distanceToTarget = targetProgress - prev
          const speed = Math.min(35 * deltaTime, distanceToTarget * 0.25) // Max 35% per second (was 20%)
          
          return Math.min(prev + speed, targetProgress)
        })
      }
      
      if (shouldContinue) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(animate)
    
    return () => {
      shouldContinue = false
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (fadeOutTimeoutRef.current !== null) {
        clearTimeout(fadeOutTimeoutRef.current)
        fadeOutTimeoutRef.current = null
      }
    }
  }, [isReady])

  // Also handle fade-out when isReady changes (fallback)
  useEffect(() => {
    if (isReady && progress >= 99 && fadeOutTimeoutRef.current === null) {
      fadeOutTimeoutRef.current = setTimeout(() => {
        setFadeOut(true)
      }, 500)
    }
  }, [isReady, progress])

  if (fadeOut) {
    return null
  }

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-bg-primary via-bg-primary/95 to-bg-primary/90 backdrop-blur-md transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="text-center px-8">
        {/* Logo/Icon area */}
        <div className="mb-8">
          <div className="relative w-20 h-20 mx-auto mb-4">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            {/* Inner spinning ring */}
            <div className="absolute inset-2 border-4 border-transparent border-t-primary border-r-primary/50 rounded-full animate-spin" style={{ animationDuration: '1s' }}></div>
            {/* Center dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
        
        {/* Loading text */}
        <h2 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
          YuDiMath
        </h2>
        <p className="text-lg font-medium text-text-primary mb-6">
          Initializing Python runtime...
        </p>
        
        {/* Progress bar */}
        <div className="w-full max-w-[320px] h-2 bg-bg-secondary rounded-full overflow-hidden mx-auto mb-2" style={{ width: '100%', maxWidth: '320px' }}>
          <div 
            className="h-full bg-primary rounded-full relative"
            style={{ 
              width: `${Math.min(100, Math.max(0, progress))}%`,
              transition: 'none',
              willChange: 'width'
            }}
          >
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
          </div>
        </div>
        
        {/* Progress percentage */}
        <p className="text-base font-semibold text-text-primary mb-4">
          {Math.round(progress)}%
        </p>
        
        {/* Helpful message */}
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          {progress < 30 
            ? 'Downloading Python runtime...' 
            : progress < 70 
            ? 'Installing NumPy and SciPy...' 
            : progress < 95
            ? 'Almost ready...'
            : isReady
            ? 'Ready!'
            : 'Finalizing setup...'}
        </p>
      </div>
    </div>
  )
}

