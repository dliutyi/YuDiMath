# Phase 2: Core Coordinate System

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

---

### [x] Step 2.1: Create Coordinate Transformation Utilities
**Task**: Implement utility functions for coordinate transformations between world and screen coordinates.

**Implementation**:
- Create `src/utils/coordinates.ts` with:
  - `worldToScreen(x, y, viewport)`: Convert world coordinates to screen
  - `screenToWorld(x, y, viewport)`: Convert screen coordinates to world
  - `snapToGrid(value, gridStep)`: Snap value to nearest grid point
  - `calculateViewportMatrix(viewport)`: Calculate transformation matrix

**Tests**:
- Test worldToScreen with various viewport states
- Test screenToWorld with various viewport states
- Test snapToGrid with different grid steps
- Test coordinate transformation accuracy
- Test edge cases (negative coordinates, zero zoom, etc.)

**Commit**: `feat: implement coordinate transformation utilities`

---

### [x] Step 2.2: Create Infinite Canvas Component
**Task**: Build the main canvas component with infinite coordinate system rendering.

**Implementation**:
- Create `src/components/Canvas.tsx`
- Implement HTML5 Canvas rendering
- Draw infinite grid with configurable step
- Draw x and y axes
- Handle canvas resize
- Implement viewport transformation

**Tests**:
- Test that canvas renders correctly
- Test that grid lines are drawn
- Test that axes are drawn
- Test canvas resize handling
- Test viewport transformation rendering

**Commit**: `feat: create infinite canvas component with grid and axes`

---

### [x] Step 2.3: Implement Pan and Zoom Functionality
**Task**: Add mouse/touch controls for panning and zooming the canvas.

**Implementation**:
- Add mouse drag handler for panning
- Add mouse wheel handler for zooming (prevent browser zoom interference)
- Add touch gesture support (optional)
- Update viewport state on interactions
- Implement zoom constraints (min/max zoom levels)
- Add x and y value labels on both axes
- Implement smart label spacing (skip labels when zoomed out to prevent overlap)
- Fix zoom-in to prevent browser page zoom interference

**Tests**:
- Test panning updates viewport position
- Test zooming updates viewport zoom level
- Test zoom constraints are enforced
- Test panning with different zoom levels
- Test that viewport state updates correctly
- Test axis labels are displayed correctly
- Test label spacing adapts to zoom level

**Commit**: `feat: implement pan and zoom functionality for canvas`

---

### [x] Step 2.4: Add Grid Step Configuration
**Task**: Implement configurable grid step size with UI control.

**Implementation**:
- Add grid step state to viewport
- Create grid step slider in bottom right corner of the screen
- Update grid rendering based on step
- Slider should support range (e.g., 0.1 to 20) with smooth transitions
- Display current grid step value near the slider

**Tests**:
- Test grid step state management
- Test grid rendering with different steps
- Test grid step slider updates state
- Test slider value display
- Test grid snapping with different steps

**Commit**: `feat: add configurable grid step with UI controls`

---

**Status**: ✅ **COMPLETE** - All steps completed

