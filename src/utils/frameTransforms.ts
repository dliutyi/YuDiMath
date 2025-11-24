import type { CoordinateFrame, ViewportState, Point2D } from '../types'

/**
 * Transform a point from frame coordinates to screen coordinates
 * Accounts for frame's viewport pan and zoom
 * @param point Point in frame coordinates [u, v]
 * @param frame The coordinate frame
 * @param parentViewport Parent viewport state
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Point in screen coordinates [x, y]
 */
export function frameToScreen(
  point: Point2D,
  frame: CoordinateFrame,
  parentViewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  const [u, v] = point
  const { viewport: frameViewport } = frame
  
  // Apply frame viewport pan and zoom
  // Frame viewport pan (framePanX, framePanY) shifts what's visible in frame coordinates
  // Frame viewport zoom scales the visible area (higher zoom = see less space, more detail)
  // 
  // To transform frame coordinate (u, v) to screen:
  // 1. Account for frame pan: (u - framePanX, v - framePanY)
  // 2. Transform to parent coordinates using base vectors scaled by frame zoom
  //    - Higher zoom means base vectors appear larger (more pixels per unit)
  //    - So we scale base vectors by frame zoom
  // 3. Transform to screen coordinates using parent viewport
  
  const [originX, originY] = frame.origin
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Apply frame pan
  const frameU = u - frameViewport.x
  const frameV = v - frameViewport.y
  
  // Apply frame zoom to scale the frame coordinate space
  // Frame zoom is independent of parent zoom - it only affects the frame's internal coordinate system
  // Higher zoom = see less space = more detail (1 unit in frame coordinates takes more pixels)
  const scaledU = frameU * frameViewport.zoom
  const scaledV = frameV * frameViewport.zoom
  
  // Transform to parent coordinates using base vectors
  // Base vectors define the coordinate system, so we use them as-is
  const parentX = originX + scaledU * iX + scaledV * jX
  const parentY = originY + scaledU * iY + scaledV * jY
  
  // Transform to screen coordinates using parent viewport
  // Parent zoom only affects frame position on screen, not frame content (which is already scaled by frame zoom)
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2
  const screenX = centerX + (parentX - parentViewport.x) * parentViewport.zoom
  const screenY = centerY - (parentY - parentViewport.y) * parentViewport.zoom
  
  return [screenX, screenY]
}

/**
 * Transform a point from screen coordinates to frame coordinates
 * Inverse of frameToScreen
 * @param screenPoint Point in screen coordinates [x, y]
 * @param frame The coordinate frame
 * @param parentViewport Parent viewport state
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Point in frame coordinates [u, v]
 */
export function screenToFrame(
  screenPoint: Point2D,
  frame: CoordinateFrame,
  parentViewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  const [screenX, screenY] = screenPoint
  const { viewport: frameViewport } = frame
  
  // Transform from screen to parent world coordinates using root viewport
  // This accounts for the root canvas pan/zoom
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2
  const parentX = parentViewport.x + (screenX - centerX) / parentViewport.zoom
  const parentY = parentViewport.y - (screenY - centerY) / parentViewport.zoom
  
  // Transform from parent world coordinates to frame coordinates
  // frameToScreen does: 
  //   1. frameU = u - frameViewport.x (apply pan)
  //   2. scaledU = frameU * frameViewport.zoom (apply zoom)
  //   3. parent = origin + scaledU * baseI + scaledV * baseJ (transform to parent)
  // So to invert:
  //   1. Solve for scaledU, scaledV from parent = origin + scaledU * baseI + scaledV * baseJ
  //   2. frameU = scaledU / frameViewport.zoom (undo zoom)
  //   3. u = frameU + frameViewport.x (undo pan to get raw frame coords)
  
  const [originX, originY] = frame.origin
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Relative to frame origin
  const relX = parentX - originX
  const relY = parentY - originY
  
  // Solve for scaledU and scaledV using the inverse transformation
  // We have: relX = scaledU * iX + scaledV * jX
  //          relY = scaledU * iY + scaledV * jY
  // This is a 2x2 system: [iX jX] [scaledU] = [relX]
  //                      [iY jY] [scaledV]   [relY]
  
  const determinant = iX * jY - iY * jX
  if (Math.abs(determinant) < 1e-10) {
    // Base vectors are parallel or zero, can't invert
    return [0, 0]
  }
  
  const scaledU = (relX * jY - relY * jX) / determinant
  const scaledV = (relY * iX - relX * iY) / determinant
  
  // Undo frame zoom: frameU = scaledU / zoom
  const frameU = scaledU / frameViewport.zoom
  const frameV = scaledV / frameViewport.zoom
  
  // Undo frame pan: u = frameU + viewport.x
  // This gives us the raw frame coordinates (inverse of frameToScreen)
  const u = frameU + frameViewport.x
  const v = frameV + frameViewport.y
  
  return [u, v]
}

/**
 * Transform a point from frame coordinates to parent (world) coordinates
 * Applies frame viewport pan/zoom before transforming
 * This is used when rendering - frame coordinates account for viewport
 */
export function frameToParent(point: Point2D, frame: CoordinateFrame): Point2D {
  const [u, v] = point
  const { viewport: frameViewport } = frame
  const [originX, originY] = frame.origin
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Apply frame viewport pan/zoom, then transform using base vectors
  // This matches the inverse of frameToScreen
  const frameU = u - frameViewport.x
  const frameV = v - frameViewport.y
  const scaledU = frameU * frameViewport.zoom
  const scaledV = frameV * frameViewport.zoom
  const parentX = originX + scaledU * iX + scaledV * jX
  const parentY = originY + scaledU * iY + scaledV * jY
  
  return [parentX, parentY]
}

/**
 * Transform a point from frame coordinates to parent (world) coordinates
 * WITHOUT applying frame viewport pan/zoom
 * This is used when creating new frames - we want raw coordinate transformation
 */
export function frameCoordsToParentWorld(point: Point2D, frame: CoordinateFrame): Point2D {
  const [u, v] = point
  const [originX, originY] = frame.origin
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Direct transformation without viewport pan/zoom
  // This is used when storing bounds for newly created frames
  const parentX = originX + u * iX + v * jX
  const parentY = originY + u * iY + v * jY
  
  return [parentX, parentY]
}

/**
 * Transform a point from parent (world) coordinates to frame coordinates
 * Inverse of frameToParent (without viewport pan/zoom)
 * This is used for converting world coordinates to frame coordinates for rendering
 */
export function parentToFrame(point: Point2D, frame: CoordinateFrame): Point2D {
  const [px, py] = point
  const [originX, originY] = frame.origin
  const dx = px - originX
  const dy = py - originY
  const [iX, iY] = frame.baseI
  const [jX, jY] = frame.baseJ
  
  // Solve for u, v in: parent = origin + u * baseI + v * baseJ
  // This is: dx = u * iX + v * jX, dy = u * iY + v * jY
  // Solve using Cramer's rule
  const determinant = iX * jY - iY * jX
  if (Math.abs(determinant) < 1e-10) {
    // Base vectors are parallel or zero, can't invert
    return [0, 0]
  }
  
  const u = (dx * jY - dy * jX) / determinant
  const v = (dy * iX - dx * iY) / determinant
  
  return [u, v]
}

/**
 * Transform a point from a nested frame's coordinate system to screen coordinates
 * Recursively transforms through all parent frames
 */
export function nestedFrameToScreen(
  point: Point2D,
  frame: CoordinateFrame,
  allFrames: CoordinateFrame[],
  rootViewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  // If this frame has a parent, transform through the parent first
  if (frame.parentFrameId) {
    const parentFrame = allFrames.find(f => f.id === frame.parentFrameId)
    if (parentFrame) {
      // Transform point from this frame's coordinate system to parent's coordinate system
      // Step 1: Convert from this frame's coordinates to parent's world coordinates
      // frameToParent applies this frame's viewport pan/zoom, then transforms using base vectors
      const parentWorldPoint = frameToParent(point, frame)
      
      // Step 2: Convert from parent's world coordinates to parent's frame coordinates
      // parentToFrame does NOT apply viewport - it's just the coordinate transformation
      const parentFramePoint = parentToFrame(parentWorldPoint, parentFrame)
      
      // Step 3: Recursively transform through parent (which will apply parent's viewport)
      return nestedFrameToScreen(parentFramePoint, parentFrame, allFrames, rootViewport, canvasWidth, canvasHeight)
    }
  }
  
  // No parent (or parent not found), transform directly using this frame
  // frameToScreen applies this frame's viewport pan/zoom and transforms to screen
  return frameToScreen(point, frame, rootViewport, canvasWidth, canvasHeight)
}

/**
 * Transform a point from parent (world) coordinates to frame coordinates
 * WITHOUT applying frame viewport pan/zoom
 * This is used when creating new frames - we want raw coordinate transformation
 */
export function parentWorldToFrameCoords(point: Point2D, frame: CoordinateFrame): Point2D {
  return parentToFrame(point, frame)
}

/**
 * Transform a point from screen coordinates to nested frame coordinates
 * Recursively transforms through all parent frames, accounting for each frame's viewport
 * Inverse of nestedFrameToScreen
 * @param screenPoint Point in screen coordinates [x, y]
 * @param frame The target coordinate frame (may be nested)
 * @param allFrames All frames in the workspace
 * @param rootViewport Root viewport state
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @returns Point in frame coordinates [u, v]
 */
export function screenToNestedFrame(
  screenPoint: Point2D,
  frame: CoordinateFrame,
  allFrames: CoordinateFrame[],
  rootViewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number
): Point2D {
  // If this frame has a parent, transform through the parent first
  if (frame.parentFrameId) {
    const parentFrame = allFrames.find(f => f.id === frame.parentFrameId)
    if (parentFrame) {
      // The inverse of nestedFrameToScreen:
      // nestedFrameToScreen does:
      //   1. frame coords (with viewport) -> frameToParent -> parent world
      //   2. parent world -> parentToFrame -> parent frame coords (raw, no viewport)
      //   3. recursively call nestedFrameToScreen(parentFramePointRaw, parentFrame)
      //      which eventually calls frameToScreen(parentFramePointRaw, parentFrame, ...)
      //
      // CRITICAL ISSUE: nestedFrameToScreen passes RAW coords to frameToScreen, but frameToScreen
      // expects coords WITH viewport. This causes frameToScreen to incorrectly apply viewport
      // to raw coords. We need to account for this in the inverse.
      //
      // To invert correctly, we need to:
      //   1. Convert screen -> root world (using root viewport zoom)
      //   2. For each parent in chain (bottom to top):
      //      a. Convert world -> parent frame coords (raw) using parentToFrame
      //      b. Apply parent viewport to get the world that frameToScreen would produce
      //   3. Convert final parent world -> this frame coords (with viewport)
      
      // Step 1: Convert screen to root world (accounting for root viewport zoom)
      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2
      let currentWorld: Point2D = [
        rootViewport.x + (screenPoint[0] - centerX) / rootViewport.zoom,
        rootViewport.y - (screenPoint[1] - centerY) / rootViewport.zoom
      ]
      
      // Step 2: Build the chain of frames from root to parent
      const frameChain: CoordinateFrame[] = []
      let f: CoordinateFrame | undefined = parentFrame
      while (f) {
        frameChain.unshift(f) // Add to beginning to get root-to-parent order
        f = f.parentFrameId ? allFrames.find(fr => fr.id === f!.parentFrameId) : undefined
      }
      
      // Step 3: Convert through each frame in the chain (accounting for viewport zoom and base vectors)
      // We need to invert the transformation that nestedFrameToScreen does:
      // nestedFrameToScreen: frame coords (with viewport) -> frameToParent -> parent world -> parentToFrame -> raw coords -> recursive
      // At base case: raw coords -> frameToScreen (which treats raw as if they have viewport) -> world -> screen
      //
      // To invert, we need to:
      // 1. Start with world point
      // 2. For each parent frame (bottom to top):
      //    a. Convert world -> raw frame coords (using parentToFrame - accounts for base vector distortion)
      //    b. Apply viewport transformation to get the world that frameToScreen would produce
      //      (frameToScreen does: (rawU - viewport.x) * viewport.zoom, then transforms using base vectors)
      for (const chainFrame of frameChain) {
        // Convert world to frame coords (raw, no viewport) - this accounts for base vector distortion/rotation
        // parentToFrame uses determinant to solve for coordinates, handling non-orthogonal base vectors
        const frameCoordsRaw = parentToFrame(currentWorld, chainFrame)
        
        // Now we need to apply the viewport transformation that frameToScreen would do
        // frameToScreen receives raw coords and does:
        //   1. frameU = rawU - viewport.x (subtract pan)
        //   2. scaledU = frameU * viewport.zoom (apply zoom)
        //   3. world = origin + scaledU * baseI + scaledV * baseJ (transform using base vectors)
        const { viewport: chainViewport } = chainFrame
        const [originX, originY] = chainFrame.origin
        const [iX, iY] = chainFrame.baseI
        const [jX, jY] = chainFrame.baseJ
        
        // Apply viewport transformation: (rawU - viewport.x) * viewport.zoom
        const frameU = frameCoordsRaw[0] - chainViewport.x
        const frameV = frameCoordsRaw[1] - chainViewport.y
        const scaledU = frameU * chainViewport.zoom
        const scaledV = frameV * chainViewport.zoom
        
        // Transform to world using base vectors (accounts for rotation/distortion/skew)
        // This is the inverse of what frameToScreen does
        currentWorld = [
          originX + scaledU * iX + scaledV * jX,
          originY + scaledU * iY + scaledV * jY
        ]
      }
      
      // Step 4: Convert final parent world to this frame coords (with viewport)
      // This is the same as screenToFrame but we already have the world point
      const [originX, originY] = frame.origin
      const [iX, iY] = frame.baseI
      const [jX, jY] = frame.baseJ
      const { viewport: frameViewport } = frame
      
      // Relative to frame origin
      const relX = currentWorld[0] - originX
      const relY = currentWorld[1] - originY
      
      // Solve for scaledU and scaledV: relX = scaledU * iX + scaledV * jX, relY = scaledU * iY + scaledV * jY
      // Where scaledU = (u - viewport.x) * viewport.zoom
      // This accounts for base vector distortion (rotation/skew)
      const determinant = iX * jY - iY * jX
      if (Math.abs(determinant) < 1e-10) {
        return [0, 0]
      }
      
      const scaledU = (relX * jY - relY * jX) / determinant
      const scaledV = (relY * iX - relX * iY) / determinant
      
      // Convert scaled coordinates to frame coordinates with viewport
      // scaledU = (u - viewport.x) * viewport.zoom
      // u = scaledU / viewport.zoom + viewport.x
      const u = scaledU / frameViewport.zoom + frameViewport.x
      const v = scaledV / frameViewport.zoom + frameViewport.y
      
      return [u, v]
    }
  }
  
  // No parent (or parent not found), use screenToFrame directly
  return screenToFrame(screenPoint, frame, rootViewport, canvasWidth, canvasHeight)
}

