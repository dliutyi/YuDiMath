import type { CoordinateFrame, ViewportState, Point2D } from '../types'
import {
  frameToScreen,
  nestedFrameToScreen,
} from './frameTransforms'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import domtoimage from 'dom-to-image'

/**
 * Formula cache key - combines formula, size, and color
 */
type FormulaCacheKey = string

/**
 * Formula cache entry
 */
interface FormulaCacheEntry {
  image: HTMLImageElement
  timestamp: number
  baseFontSize?: number  // The font size used to render this image (optional for backward compatibility)
}

// Base render size - we render formulas at this size and scale them when drawing
// This allows us to cache one image per formula/color combination and scale it for different zoom levels
// Larger base size = better quality when scaling up, but more memory usage
const BASE_RENDER_SIZE = 48  // Increased from 16 to 48 for better quality

/**
 * Global formula cache - stores rendered formula images
 * Key format: `${formula}|${fontSize}|${color}`
 */
const formulaCache = new Map<FormulaCacheKey, FormulaCacheEntry>()

/**
 * Cache expiration time (1 hour)
 */
const CACHE_EXPIRATION_MS = 60 * 60 * 1000

/**
 * Clean up expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now()
  for (const [key, entry] of formulaCache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRATION_MS) {
      formulaCache.delete(key)
    }
  }
}

/**
 * Render a LaTeX formula to a canvas image at a base size
 * The image can then be scaled when drawing to account for zoom
 * We render at a standard base size and scale as needed
 * 
 * @param formula LaTeX string expression
 * @param fontSize Font size in pixels (ignored - always uses BASE_RENDER_SIZE)
 * @param color Text color
 * @returns Promise resolving to an Image element
 */
async function renderFormulaToImage(
  formula: string,
  fontSize: number,
  color: string
): Promise<HTMLImageElement> {
  // Use a base font size for rendering - we'll scale the image when drawing
  // This allows us to cache one image and scale it for different zoom levels
  // fontSize parameter is ignored - we always render at BASE_RENDER_SIZE
  
  // Check cache first - cache by formula and color only, not by size
  const cacheKey: FormulaCacheKey = `${formula}|${BASE_RENDER_SIZE}|${color}`
  const cached = formulaCache.get(cacheKey)
  if (cached) {
    return cached.image
  }

  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    cleanupCache()
  }

  // Use dom-to-image to render KaTeX HTML directly to an image
  // This is more reliable than html2canvas for complex CSS layouts like KaTeX
  try {
    // Create a temporary container with KaTeX rendered HTML
    // Position it off-screen but keep it visible for dom-to-image to capture it
    // We'll use a container that's positioned off-screen but still in the document flow
    const tempDiv = document.createElement('div')
    tempDiv.style.position = 'absolute'
    tempDiv.style.left = '0'  // Start at 0,0 but we'll move it after rendering
    tempDiv.style.top = '0'
    tempDiv.style.width = 'auto'
    tempDiv.style.height = 'auto'
    tempDiv.style.fontSize = `${BASE_RENDER_SIZE}px`  // Always render at base size
    tempDiv.style.color = color
    tempDiv.style.backgroundColor = 'transparent'
    tempDiv.style.padding = '0'
    tempDiv.style.margin = '0'
    tempDiv.style.visibility = 'visible'
    tempDiv.style.opacity = '1'
    tempDiv.style.pointerEvents = 'none'
    tempDiv.style.zIndex = '-9999'  // Very low z-index to place behind everything
    tempDiv.className = 'katex'
    // Force KaTeX to respect font size and color
    tempDiv.style.setProperty('font-size', `${BASE_RENDER_SIZE}px`, 'important')
    tempDiv.style.setProperty('color', color, 'important')
    document.body.appendChild(tempDiv)
    
    // Render KaTeX to the div
    // KaTeX uses the font-size of the container element to determine its base size
    // KaTeX follows standard mathematical typesetting where:
    // - Capitals are naturally larger (part of proper math notation)
    // - Subscripts/superscripts are smaller (typically 70% of base size)
    // These ratios are built into KaTeX and follow mathematical conventions
    katex.render(formula, tempDiv, {
      throwOnError: false,
      displayMode: false,
      // KaTeX doesn't have options to adjust capital/subscript size ratios
      // These are part of proper mathematical typesetting standards
    })
    
    // Wait for fonts and rendering to complete
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Now move it off-screen after rendering is complete
    tempDiv.style.left = '-9999px'
    tempDiv.style.top = '-9999px'
    
    const katexSpan = tempDiv.querySelector('span.katex') as HTMLElement
    if (!katexSpan) {
      document.body.removeChild(tempDiv)
      throw new Error('KaTeX did not render any content')
    }
    
    // Apply color and font size to KaTeX elements - KaTeX uses its own styling
    // We need to override KaTeX's styles with !important
    const setStyleOnElements = (element: Element) => {
      const el = element as HTMLElement
      // Set color on all elements
      el.style.setProperty('color', color, 'important')
      // Set font size on all elements
      el.style.setProperty('font-size', `${BASE_RENDER_SIZE}px`, 'important')
      // Also set on any nested elements
      Array.from(element.children).forEach(child => setStyleOnElements(child))
    }
    setStyleOnElements(katexSpan)
    // Also set directly on the span
    katexSpan.style.setProperty('color', color, 'important')
    katexSpan.style.setProperty('font-size', `${BASE_RENDER_SIZE}px`, 'important')
    
    // Get dimensions - add padding to prevent cutoff
    // More padding at top, less at bottom (bottom is already good)
    const paddingTop = 10
    const paddingBottom = 5
    const paddingLeft = 5
    const paddingRight = 5
    
    // Create a wrapper div with proper padding
    // Position it off-screen but keep it visible for dom-to-image to capture
    const wrapperDiv = document.createElement('div')
    wrapperDiv.style.position = 'fixed'  // Use fixed to ensure it's positioned relative to viewport
    wrapperDiv.style.left = '-9999px'  // Position off-screen
    wrapperDiv.style.top = '-9999px'   // Position off-screen
    wrapperDiv.style.paddingTop = `${paddingTop}px`
    wrapperDiv.style.paddingBottom = `${paddingBottom}px`
    wrapperDiv.style.paddingLeft = `${paddingLeft}px`
    wrapperDiv.style.paddingRight = `${paddingRight}px`
    wrapperDiv.style.backgroundColor = 'transparent'
    // Keep visibility: visible for dom-to-image to capture, but position off-screen
    wrapperDiv.style.visibility = 'visible'
    wrapperDiv.style.opacity = '1'  // Keep opacity at 1 so dom-to-image can capture
    wrapperDiv.style.pointerEvents = 'none'  // Don't interfere with mouse events
    wrapperDiv.style.zIndex = '-1'  // Place behind everything
    wrapperDiv.style.setProperty('font-size', `${fontSize}px`, 'important')
    wrapperDiv.style.setProperty('color', color, 'important')
    
    // Clone the span and ensure styles are preserved
    const clonedSpan = katexSpan.cloneNode(true) as HTMLElement
    setStyleOnElements(clonedSpan)
    
    // KaTeX uses relative font sizes, so we need to ensure the base font-size is set correctly
    // Set font-size on the cloned span itself to ensure it's used as the base
    clonedSpan.style.setProperty('font-size', `${BASE_RENDER_SIZE}px`, 'important')
    
    wrapperDiv.appendChild(clonedSpan)
    document.body.appendChild(wrapperDiv)
    
    // Force a reflow to ensure styles are applied
    void wrapperDiv.offsetHeight
    
    // Get dimensions with padding
    const wrapperRect = wrapperDiv.getBoundingClientRect()
    const width = Math.max(1, Math.ceil(wrapperRect.width))
    const height = Math.max(1, Math.ceil(wrapperRect.height))
    
    if (width === 0 || height === 0) {
      document.body.removeChild(tempDiv)
      document.body.removeChild(wrapperDiv)
      throw new Error(`KaTeX rendered with zero dimensions: ${width}x${height}`)
    }
    
    // Use dom-to-image to convert the wrapper div to a PNG image
    // Temporarily move it back to viewport for capture, then move it off-screen again
    const originalLeft = wrapperDiv.style.left
    const originalTop = wrapperDiv.style.top
    wrapperDiv.style.left = '0'
    wrapperDiv.style.top = '0'
    
    // Force a reflow
    void wrapperDiv.offsetHeight
    
    const dataUrl = await domtoimage.toPng(wrapperDiv, {
      quality: 1.0,
      width: width,
      height: height,
    })
    
    // Move it back off-screen
    wrapperDiv.style.left = originalLeft
    wrapperDiv.style.top = originalTop
    
    // Clean up wrapper
    document.body.removeChild(wrapperDiv)
    
    // Clean up temporary element
    document.body.removeChild(tempDiv)
    
    // Create image from data URL
    const img = new Image()
    img.src = dataUrl
    
    // Wait for image to load
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for image to load'))
      }, 5000)
      
      img.onload = () => {
        clearTimeout(timeout)
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          reject(new Error(`Image loaded but has zero natural dimensions: ${img.naturalWidth}x${img.naturalHeight}`))
          return
        }
        resolve(undefined)
      }
      img.onerror = (error) => {
        clearTimeout(timeout)
        console.error('[renderFormulaToImage] Image load error:', error)
        reject(new Error('Failed to load image from dom-to-image'))
      }
    })
    
    if (img.width === 0 || img.height === 0 || img.naturalWidth === 0 || img.naturalHeight === 0) {
      throw new Error(`Image has zero dimensions: ${img.width}x${img.height} (natural: ${img.naturalWidth}x${img.naturalHeight})`)
    }
    
    // Cache the result with base font size info
            formulaCache.set(cacheKey, {
              image: img,
              timestamp: Date.now(),
              baseFontSize: BASE_RENDER_SIZE,
            })

    return img
  } catch (error) {
    console.error('[renderFormulaToImage] Error rendering formula:', formula, error)
    throw error
  }
}

/**
 * Calculate the effective font size based on zoom levels
 * Font size is adjusted by both main grid zoom and frame zoom
 * Uses square root scaling to prevent excessive growth
 * 
 * @param baseSize Base font size in pixels (default: 12)
 * @param mainZoom Main grid zoom level
 * @param frameZoom Frame zoom level
 * @returns Effective font size in pixels
 */
function calculateEffectiveFontSize(
  baseSize: number,
  mainZoom: number,
  frameZoom: number
): number {
  // Font size scales with zoom, but use a more moderate scaling
  const combinedZoom = mainZoom * frameZoom
  // Use square root scaling to make zoom effect less aggressive
  // At zoom 1: size = baseSize
  // At zoom 4: size = baseSize * 2
  // At zoom 16: size = baseSize * 4
  const zoomFactor = Math.sqrt(combinedZoom)
  const effectiveSize = baseSize * zoomFactor
  
  // Clamp to reasonable bounds (but allow user-specified sizes)
  // Minimum 4px, maximum 200px to prevent rendering issues
  return Math.max(4, Math.min(200, effectiveSize))
}

/**
 * Pre-render a formula and cache it
 * This should be called when formulas are added or zoom levels change
 * 
 * @param formula LaTeX string expression
 * @param fontSize Font size in pixels
 * @param color Text color
 */
export async function preRenderFormula(
  formula: string,
  fontSize: number,
  color: string
): Promise<void> {
  const cacheKey: FormulaCacheKey = `${formula}|${fontSize}|${color}`
  if (formulaCache.has(cacheKey)) {
    return // Already cached
  }
  
  try {
    await renderFormulaToImage(formula, fontSize, color)
  } catch (error) {
    console.warn('[preRenderFormula] Failed to pre-render formula:', formula, error)
  }
}

/**
 * Callback to trigger canvas redraw after formulas are rendered
 */
let redrawCallback: (() => void) | null = null

/**
 * Set the callback to trigger canvas redraw
 */
export function setFormulaRedrawCallback(callback: (() => void) | null): void {
  redrawCallback = callback
}

/**
 * Draw formula labels defined in a frame
 * Formulas are rendered using KaTeX and dom-to-image, positioned relative to frame coordinates
 * Font size adjusts based on both main grid zoom and frame zoom levels
 * 
 * Formulas are rendered asynchronously if not cached, and canvas is redrawn when ready.
 */
export function drawFrameFormulas(
  ctx: CanvasRenderingContext2D,
  frame: CoordinateFrame,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  allFrames: CoordinateFrame[] = []
): void {
  if (!frame.formulas || frame.formulas.length === 0) {
    return
  }

  // Transform function for converting frame coordinates to screen coordinates
  const transformToScreen = frame.parentFrameId
    ? (point: Point2D): Point2D => nestedFrameToScreen(point, frame, allFrames, viewport, canvasWidth, canvasHeight)
    : (point: Point2D): Point2D => frameToScreen(point, frame, viewport, canvasWidth, canvasHeight)

  // Calculate effective zoom levels
  const mainZoom = viewport.zoom
  const frameZoom = frame.viewport.zoom

  // Draw each formula from cache, or render asynchronously
  frame.formulas.forEach((formula) => {
    try {
      // Calculate effective font size based on zoom levels
      const baseSize = formula.size || 2  // Default size is 2
      const effectiveSize = calculateEffectiveFontSize(baseSize, mainZoom, frameZoom)

      // Transform formula position to screen coordinates
      const screenPos = transformToScreen([formula.x, formula.y])
      
      // Clamp screen position to canvas bounds to prevent drawing off-screen
      const clampedX = Math.max(0, Math.min(canvasWidth, screenPos[0]))
      const clampedY = Math.max(0, Math.min(canvasHeight, screenPos[1]))
      const finalScreenPos: Point2D = [clampedX, clampedY]

      // Check cache for rendered formula - cache by formula and color only, not by size
      // We'll scale the image when drawing based on effectiveSize
      const cacheKey: FormulaCacheKey = `${formula.formula}|${BASE_RENDER_SIZE}|${formula.color || '#ffffff'}`
      const cached = formulaCache.get(cacheKey)
      
      if (cached && cached.image.complete) {
        // Draw cached image synchronously
        const img = cached.image
        
        // Verify image is valid
        if (img.width === 0 || img.height === 0 || img.naturalWidth === 0 || img.naturalHeight === 0) {
          formulaCache.delete(cacheKey)
          // Fall through to async rendering
        } else {
          // Check if image src is suspiciously short or if image appears empty
          const isSuspicious = img.src && (
            img.src.length < 100 || 
            !img.src.startsWith('data:image/') ||
            (img.src.startsWith('data:image/svg+xml') && img.src.length < 200)
          )
          
          // Also check if the image actually has content
          let hasValidContent = false
          if (img.src && img.src.startsWith('data:image/svg+xml')) {
            try {
              const decoded = decodeURIComponent(img.src.split(',')[1] || '')
              hasValidContent = decoded.includes('<svg') && decoded.includes('</svg>') && decoded.length > 100
            } catch {
              // Invalid SVG data URL
            }
          } else {
            hasValidContent = true // Assume valid for non-SVG images
          }
          
          if (isSuspicious || !hasValidContent) {
            // Clear cache and re-render
            formulaCache.delete(cacheKey)
            // Fall through to async rendering
          } else {
            // Image is valid - draw it
            ctx.save()
            // Draw the image - position is top-left corner
            // Use clamped position to ensure it's within canvas bounds
            // Enable image smoothing for better quality
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            
            // Calculate scale factor based on effective size vs cached base size
            const cachedBaseSize = cached.baseFontSize || BASE_RENDER_SIZE
            const scaleFactor = effectiveSize / cachedBaseSize
            const scaledWidth = img.naturalWidth * scaleFactor
            const scaledHeight = img.naturalHeight * scaleFactor
            
            // Draw the image scaled to the effective size
            // Position is already in screen coordinates from transformToScreen, which accounts for zoom
            ctx.drawImage(
              img,
              0, 0, img.naturalWidth, img.naturalHeight, // Source rectangle (full image)
              finalScreenPos[0], finalScreenPos[1], scaledWidth, scaledHeight // Destination rectangle (scaled)
            )
            
            ctx.restore()
            return // Successfully drawn, exit early
          }
        }
      }
      
      // Not cached or cache invalid - render asynchronously
      // Check if cached image is valid (exists, complete, and has reasonable data size)
      const isCacheValid = cached && cached.image.complete
      let isCacheDataValid = true
      if (cached && cached.image.src) {
        const minExpectedSize = Math.max(1000, (cached.image.width * cached.image.height) / 10)
        isCacheDataValid = cached.image.src.length >= minExpectedSize
      }
      
      if (!isCacheValid || !isCacheDataValid) {
        // Not cached - render asynchronously and trigger redraw when done
        renderFormulaToImage(
          formula.formula,
          BASE_RENDER_SIZE,  // Always render at base size
          formula.color || '#ffffff'
        ).then((img) => {
          // Cache the result for next time - cache by formula and color only
          const newCacheKey: FormulaCacheKey = `${formula.formula}|${BASE_RENDER_SIZE}|${formula.color || '#ffffff'}`
          formulaCache.set(newCacheKey, {
            image: img,
            timestamp: Date.now(),
            baseFontSize: BASE_RENDER_SIZE,
          })
          // Trigger canvas redraw after formula is rendered
          if (redrawCallback) {
            redrawCallback()
          }
        }).catch((error) => {
          console.error(`[drawFrameFormulas] Failed to render formula:`, formula.formula, error)
        })
      }
    } catch (error) {
      // If drawing fails, skip this formula
      console.error(`[drawFrameFormulas] Failed to draw formula:`, formula.formula, error)
    }
  })
}

