import { usePyScript } from '../hooks/usePyScript'
import { useState, useEffect } from 'react'

export default function LoadingOverlay() {
  const { isReady } = usePyScript()
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)

  // Simulate smooth progress while loading
  useEffect(() => {
    let animationFrameId: number | null = null
    let lastUpdate = Date.now()
    
    const animate = () => {
      const now = Date.now()
      const deltaTime = (now - lastUpdate) / 1000 // seconds
      lastUpdate = now
      
      if (isReady) {
        // Smoothly animate to 100% when ready
        setProgress((prev) => {
          if (prev >= 100) {
            // Fade out after reaching 100%
            setTimeout(() => setFadeOut(true), 300)
            return 100
          }
          
          const targetProgress = 100
          const distanceToTarget = targetProgress - prev
          // Ease out: slow down as we approach 100%
          const speed = Math.min(30 * deltaTime, distanceToTarget * 0.15)
          
          return Math.min(prev + speed, 100)
        })
      } else {
        // Smooth, gradual progress increase (up to 85%)
        const targetProgress = 85
        
        setProgress((prev) => {
          if (prev >= targetProgress) {
            return prev
          }
          
          // Smooth acceleration: start slow, speed up in middle, slow down near target
          const distanceToTarget = targetProgress - prev
          const speed = Math.min(12 * deltaTime, distanceToTarget * 0.08) // Max 12% per second, but slow down as we approach target
          
          return Math.min(prev + speed, targetProgress)
        })
      }
      
      animationFrameId = requestAnimationFrame(animate)
    }
    
    animationFrameId = requestAnimationFrame(animate)
    
    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isReady])

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
        <div className="w-80 h-2 bg-bg-secondary rounded-full overflow-hidden mx-auto mb-2" style={{ minWidth: '320px', maxWidth: '320px' }}>
          <div 
            className="h-full bg-primary rounded-full transition-all duration-300 ease-out relative"
            style={{ width: `${progress}%`, minWidth: '0%', maxWidth: '100%' }}
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
            : progress < 90
            ? 'Almost ready...'
            : 'Finalizing setup...'}
        </p>
      </div>
    </div>
  )
}

