# Phase 3: Frame/Viewport System

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

**Note on Nested Frames**: The frame system supports recursive nesting (Russian doll pattern). Frames can be drawn inside other frames, creating a hierarchy where each nested frame has its own coordinate system relative to its parent. This nesting can continue to any depth. When implementing frame features, ensure they work correctly for both top-level frames (relative to background) and nested frames (relative to parent frame).

---

### [x] Step 3.1: Implement Frame Drawing (Rectangle Creation)
**Task**: Allow users to draw rectangles that become coordinate frames.

**Implementation**:
- Add drawing mode state
- Implement mouse down/move/up handlers for rectangle drawing
- Snap rectangle corners to grid (background grid for top-level frames, parent frame grid for nested frames)
- Create frame data structure on rectangle completion
- Store frame bounds (x, y, width, height)
- Support drawing frames inside existing frames (nested frames)
  - When drawing inside a frame, the new frame should be a child of that frame
  - Child frame bounds are relative to parent frame's coordinate system
  - Store parent frame reference in frame data structure

**Tests**:
- Test rectangle drawing starts on mouse down
- Test rectangle updates on mouse move
- Test rectangle finalizes on mouse up
- Test grid snapping for rectangle corners
- Test frame creation with correct bounds

**Commit**: `feat: implement rectangle drawing for frame creation with grid snapping`

---

### [x] Step 3.2: Create Frame Component with Base Vectors
**Task**: Build the CoordinateFrame component that renders a frame viewport with base vectors.

**Implementation**:
- Create `src/components/CoordinateFrame.tsx`
- Render frame rectangle with border
- Render frame's own coordinate grid based on base vectors
- Render base i vector (red) and base j vector (blue)
- Transform frame coordinates to parent coordinates (background for top-level, parent frame for nested)
- Display frame origin
- Support recursive rendering of nested frames
  - Each frame component should render its child frames recursively
  - Child frames are transformed relative to their parent frame's coordinate system

**Tests**:
- Test frame component renders correctly
- Test base vectors are displayed
- Test frame grid is rendered
- Test coordinate transformation within frame
- Test frame origin is displayed correctly

**Commit**: `feat: create frame component with base vector visualization`

---

### [x] Step 3.3: Implement Frame Selection
**Task**: Allow users to select frames by clicking on them.

**Implementation**:
- Add selectedFrameId to workspace state
- Implement click handler to select frame
- Visual feedback for selected frame (highlighted border)
- Deselect on background click
- Handle multiple frame selection (optional: single selection for now)

**Tests**:
- Test frame selection on click
- Test selected frame visual feedback
- Test deselection on background click
- Test selection state management
- Test that only one frame can be selected at a time

**Commit**: `feat: implement frame selection with visual feedback`

---

### [x] Step 3.4: Implement Frame Coordinate Grid
**Task**: Each frame viewport displays its own independent coordinate grid based on base vectors.

**Implementation**:
- Calculate frame's coordinate grid lines based on base vectors (i and j)
  - Grid lines should follow the directions of base_i and base_j
  - Grid spacing should be based on the magnitudes of base vectors
  - Grid should fill the entire frame viewport (width × height)
- Transform frame grid coordinates to background coordinate system for rendering
- Render frame grid within frame bounds only
- Grid lines should be visually distinct from background grid (different color/opacity)
- Grid spacing should be based on base vector magnitudes (independent of viewport grid step)
- The frame grid represents the frame's own coordinate system, independent of the background

**Tests**:
- Test frame grid calculation based on base vectors
- Test frame grid transformation to background coordinates
- Test frame grid rendering within bounds
- Test grid lines follow base vector directions
- Test grid spacing configuration

**Commit**: `feat: implement frame-specific coordinate grid based on base vectors`

---

### [x] Step 3.5: Implement Frame as Independent Coordinate System
**Task**: Each frame is its own infinite coordinate system with independent panning, zooming, and axes.

**Implementation**:
- Each frame maintains its own viewport state (pan x/y, zoom level)
- Frame viewport is independent of background viewport
- Implement frame-level panning (click and drag within frame)
- Implement frame-level zooming (mouse wheel within frame)
- Draw frame axes (X and Y axes in frame coordinates) with labels
- Frame axes should be drawn at the frame's origin (center of viewport)
- Axis labels should show frame coordinate values (not parent coordinates)
- Frame axes should be visually distinct from frame grid
- Frame panning/zooming should only affect the frame's internal viewport, not the background
- When panning/zooming a frame, the frame's bounds in parent coordinates remain fixed
- Frame coordinate system is infinite - can pan/zoom within frame independently
- Support nested frames with independent pan/zoom that correctly account for parent viewport transformations
- Nested frame drawing correctly snaps to parent frame grid and accounts for parent viewport pan/zoom

**Tests**:
- Test frame viewport state management
- Test frame panning within frame bounds
- Test frame zooming within frame bounds
- Test frame axes rendering
- Test frame axis labels show correct frame coordinates
- Test frame panning/zooming doesn't affect background
- Test nested frame panning/zooming independence
- Test nested frame drawing with parent viewport transformations
- Test nested frame coordinate transformations through parent chain

**Commit**: `feat: implement frame as independent coordinate system with panning, zooming, and axes`

---

### [x] Step 3.6: Render Vectors as Arrows
**Task**: Draw vectors as arrows with arrowheads, not just lines.

**Implementation**:
- Create arrow drawing utility function
- Draw arrowhead at vector endpoint
- Arrowhead should point in the direction of the vector
- Arrowhead size should scale with vector magnitude (or use fixed size)
- Arrow should be drawn from origin (or specified start point) to endpoint
- Support different arrow styles (filled, outlined)
- Arrow color should match vector color (if specified)
- Arrow should be visible in frame coordinate system

**Tests**:
- Test arrow rendering with different directions
- Test arrow rendering with different magnitudes
- Test arrow color customization
- Test arrow rendering in frame coordinates
- Test arrow transformation to parent coordinates

**Commit**: `feat: render vectors as arrows with arrowheads`

---

### [x] Step 3.7: Add Frame Properties Editor
**Task**: Create UI panel for editing frame properties (origin, base vectors).

**Implementation**:
- Create `src/components/PropertiesPanel.tsx`
- Add input fields for frame origin (x, y)
- Add input fields for base i vector (x, y)
- Add input fields for base j vector (x, y)
- Add validation (ensure base vectors are not collinear)
- Update frame state on input change
- Add normalization toggle for base vectors (should be if enabled and not by default)

**Tests**:
- Test origin input updates frame origin
- Test base vector inputs update frame base vectors
- Test collinearity validation
- Test normalization toggle
- Test properties panel shows selected frame data

**Commit**: `feat: add frame properties editor with base vector controls`

---

**Status**: ✅ **COMPLETE** - All steps completed

