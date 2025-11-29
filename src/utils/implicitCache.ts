/**
 * Cache for implicit plot contour points
 * Stores pre-computed contour points to avoid recalculation
 */

interface CachedContourPoints {
  points: Array<[number, number]>
  timestamp: number
}

// In-memory cache for implicit plot points
// Key: cacheKey from ImplicitPlot, Value: cached contour points
const implicitPlotCache = new Map<string, CachedContourPoints>()

// Cache expiration time (1 hour)
const CACHE_EXPIRY_MS = 60 * 60 * 1000

/**
 * Get cached contour points for an implicit plot
 * @param cacheKey Cache key from ImplicitPlot
 * @returns Cached points if available and not expired, null otherwise
 */
export function getCachedImplicitPoints(cacheKey: string | undefined): Array<[number, number]> | null {
  if (!cacheKey) {
    return null
  }

  const cached = implicitPlotCache.get(cacheKey)
  if (!cached) {
    return null
  }

  // Check if cache is expired
  const now = Date.now()
  if (now - cached.timestamp > CACHE_EXPIRY_MS) {
    implicitPlotCache.delete(cacheKey)
    return null
  }

  return cached.points
}

/**
 * Cache contour points for an implicit plot
 * @param cacheKey Cache key from ImplicitPlot
 * @param points Contour points to cache
 */
export function cacheImplicitPoints(cacheKey: string | undefined, points: Array<[number, number]>): void {
  if (!cacheKey) {
    return
  }

  implicitPlotCache.set(cacheKey, {
    points: [...points], // Create a copy to avoid mutations
    timestamp: Date.now(),
  })
}

/**
 * Clear expired cache entries
 */
export function clearExpiredImplicitCache(): void {
  const now = Date.now()
  for (const [key, cached] of implicitPlotCache.entries()) {
    if (now - cached.timestamp > CACHE_EXPIRY_MS) {
      implicitPlotCache.delete(key)
    }
  }
}

/**
 * Clear all cached implicit plot points
 */
export function clearImplicitCache(): void {
  implicitPlotCache.clear()
}

/**
 * Get cache statistics
 */
export function getImplicitCacheStats(): { size: number; keys: string[] } {
  return {
    size: implicitPlotCache.size,
    keys: Array.from(implicitPlotCache.keys()),
  }
}

