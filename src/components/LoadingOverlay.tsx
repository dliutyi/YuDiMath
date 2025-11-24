import { usePyScript } from '../hooks/usePyScript'
import { useState, useEffect } from 'react'

export default function LoadingOverlay() {
  const { isReady } = usePyScript()
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)

  // Simulate progress while loading
  useEffect(() => {
    if (isReady) {
      setProgress(100)
      // Fade out after a brief delay
      setTimeout(() => setFadeOut(true), 300)
      return
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        // Gradually increase progress, but don't go to 100% until ready
        if (prev < 90) {
          return Math.min(prev + Math.random() * 5, 90)
        }
        return prev
      })
    }, 500)

    return () => clearInterval(interval)
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
        <h2 className="text-5xl font-extrabold mb-3 bg-gradient-to-r from-primary via-blue-400 to-purple-500 bg-clip-text text-transparent tracking-tight drop-shadow-lg">
          YuDiMath
        </h2>
        <p className="text-xl font-semibold text-text-primary mb-8 tracking-wide">
          <span className="bg-gradient-to-r from-primary/90 to-blue-400/90 bg-clip-text text-transparent">
            Initializing Python runtime...
          </span>
        </p>
        
        {/* Progress bar */}
        <div className="w-80 h-2.5 bg-bg-secondary/50 rounded-full overflow-hidden mx-auto mb-3 shadow-inner border border-border/30" style={{ minWidth: '320px', maxWidth: '320px' }}>
          <div 
            className="h-full bg-gradient-to-r from-primary via-blue-500 to-primary rounded-full transition-all duration-300 ease-out shadow-lg relative"
            style={{ width: `${progress}%`, minWidth: '0%', maxWidth: '100%' }}
          >
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          </div>
        </div>
        
        {/* Progress percentage */}
        <p className="text-lg font-bold mb-5 bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent tracking-wide">
          {Math.round(progress)}%
        </p>
        
        {/* Helpful message */}
        <p className="text-sm font-semibold text-text-primary/90 max-w-md mx-auto tracking-wide">
          <span className="inline-block bg-gradient-to-r from-primary/80 via-blue-400/80 to-purple-500/80 bg-clip-text text-transparent">
            {progress < 30 
              ? 'Downloading Python runtime...' 
              : progress < 70 
              ? 'Installing NumPy and SciPy...' 
              : progress < 90
              ? 'Almost ready...'
              : 'Finalizing setup...'}
          </span>
        </p>
      </div>
    </div>
  )
}

