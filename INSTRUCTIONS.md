# Linear Algebra & Calculus Web Application - Development Checklist

## Overview
A modern, interactive web application for visualizing linear algebra and calculus concepts using an infinite Cartesian coordinate system. Users can create multiple coordinate system "frames" (rectangles) that act as viewports with their own coordinate grid based on base vectors. Each frame can visualize arbitrary numbers of functions and vectors defined in Python code using predefined functions like `draw()` and `plot()`.

## Key Concepts

### Frame/Viewport System
- Each frame is a **viewport** - a rectangular region that is snapped to the background coordinate system (or parent frame's coordinate system for nested frames)
- Each frame has its own **width and height** (defined by the rectangle bounds drawn by the user)
- Each frame has its own **independent coordinate grid** based on its base vectors (i and j)
  - The frame's grid lines follow the directions of the base vectors
  - The frame's grid spacing is based on the base vector magnitudes
  - The frame's origin is positioned at a specific point in the parent coordinate system (background or parent frame)
- The frame's coordinate system is transformed relative to its parent coordinate system
  - Objects drawn in frame coordinates are transformed to parent coordinates for display
  - For nested frames, transformations are composed (child frame coordinates → parent frame coordinates → background coordinates)
- **Nested Frame Support (Russian Doll Pattern)**:
  - Frames can be nested recursively - a frame can contain child frames within it
  - Each nested frame has its own base vectors, functions, vectors, and can contain further nested frames
  - Nested frames are positioned and transformed relative to their parent frame's coordinate system
  - The nesting depth is unlimited - frames can be nested as deeply as needed
  - When a nested frame is selected, its corresponding Python code appears in the code panel
  - Each frame maintains its own independent state (base vectors, functions, vectors, nested frames)
- Multiple frames can exist simultaneously at the same nesting level, each with completely independent coordinate systems
- When a frame is selected, its corresponding Python code appears in the code panel

### Coordinate Modes
- **2D Mode**: Primary focus for initial development (x, y coordinates)
- **3D Mode**: Future extension (x, y, z coordinates) - architecture should support this but implementation deferred

### Predefined Python Functions
- **`draw(vector, color?)`**: Draw a vector in the frame
  - Parameters: vector (numpy array), optional color (string)
  - Example: `draw(np.array([2, 3]), color='#00ff00')`
- **`plot(formula, x_min, x_max, color?)`**: Plot a function in the frame
  - Parameters: formula (string or callable), x_min (number), x_max (number), optional color (string)
  - Example: `plot('2*x + 1', -5, 5, color='#ff00ff')`
  - Formula can be a string expression (e.g., `'2*x + 1'`, `'np.sin(x)'`) or a callable
  - x_min and x_max define the range for function evaluation
- **Extensibility**: The system must be designed to easily add more predefined functions. Use a function registry pattern that allows developers to register new functions without modifying core code.

### Development Workflow
**IMPORTANT**: Each step must be completed in full before moving to the next step. The workflow is iterative and evolutionary.

For each step:
1. ✅ **Implement** the feature/functionality completely
2. ✅ **Write unit tests** - All tests must be in the `tests/` folder (dedicated folder next to `src/`). All tests must pass before proceeding
3. ✅ **Run tests** - Execute `npm test -- --run` and ensure 100% pass rate
4. ✅ **Restart Docker** - Restart the Docker container and verify it works:
   - Build/restart: `docker-compose -f docker/docker-compose.yml build` and `docker-compose -f docker/docker-compose.yml up -d`
   - Verify with curl: `curl http://localhost:3000` should return HTML without errors
   - Check logs: `docker-compose -f docker/docker-compose.yml logs` should show no errors
5. ✅ **Verify in browser** - Manually test the feature in the browser at http://localhost:3000
6. ✅ **Create git commit** - **ONLY after the step is fully complete and verified**. Use descriptive commit message following conventional commits
7. ✅ **Mark step complete** - Check off the step in this checklist before proceeding

**Do not proceed to the next step until the current step is fully complete and verified.**

**IMPORTANT - Commit Timing Rules:**
- ✅ **Commit ONLY when a step is fully completed** (all tests pass, feature works, verified in browser)
- ✅ **Commit ONLY when a bug is fixed AND the developer explicitly confirms** "the bug is fixed and it is time to create a commit"
- ❌ **DO NOT commit during debugging** - wait until the issue is resolved and confirmed
- ❌ **DO NOT commit intermediate changes** - only commit when work is complete and verified
- ❌ **DO NOT commit automatically** - always wait for explicit confirmation from the developer

**IMPORTANT - Code Modularity and File Size Rules:**
- ✅ **PRIORITY: Prefer many small, focused files over few large all-in-one files**
- ✅ **Target file size: 200-400 lines** (ideal range)
- ✅ **Maximum file size: ~500 lines** (hard limit - must refactor if exceeded)
- ✅ **Single Responsibility Principle**: Each file should have one clear purpose
- ✅ **When a file exceeds 300 lines, consider refactoring**:
  - Extract utility functions to separate files (`src/utils/`)
  - Split large components into smaller sub-components
  - Move complex logic to custom hooks (`src/hooks/`)
  - Separate types/interfaces into dedicated files (`src/types/`)
  - Extract constants and configuration to separate files
- ✅ **Modularity over convenience**: Always prefer creating new small files over adding to existing large files
- ✅ **Break down large files proactively**: Don't wait until files become unmanageable

**IMPORTANT - Code Reuse Rules:**
- ✅ **ALWAYS check `src/utils/` first** before implementing new functionality
- ✅ **Search for existing functions** that might already solve the problem
- ✅ **Extend or amend existing functions** rather than creating duplicates
- ✅ **If a function is close but not quite right**, consider:
  - Adding optional parameters to make it more flexible
  - Creating a wrapper function that uses the existing one
  - Refactoring the existing function to be more general
- ✅ **Only create new utility functions** when no existing solution can be adapted
- ✅ **Document why a new function was created** if similar functionality exists
- ❌ **DO NOT duplicate functionality** that already exists in utils
- ❌ **DO NOT create new functions** without first checking if similar ones exist

**IMPORTANT - Debugging Rules:**
- ✅ **Use debug logs when a problem persists after two attempts**
  - If a fix doesn't work after two attempts, add strategic debug logging
  - Log key variables, function inputs/outputs, and state changes
  - Use descriptive log messages that identify the context (function name, component, etc.)
  - Log before and after critical operations to track state transitions
  - Use `console.log`, `console.debug`, or `console.error` as appropriate
  - Consider using conditional logging based on environment (e.g., `if (process.env.NODE_ENV === 'development')`)
- ✅ **Remove debug logs before committing**
  - All debug logs must be removed before final commits
  - Debug logs are temporary tools for investigation, not permanent code
  - Use the Code Review Checklist to verify no debug code remains
- ✅ **Debugging best practices**:
  - Start with understanding the expected behavior vs. actual behavior
  - Check browser console for errors and warnings
  - Use React DevTools for component state inspection
  - Use browser DevTools for network requests and performance
  - Add breakpoints in critical code paths if needed
  - Document findings and root cause analysis

---

## Phase 1: Project Setup and Foundation

### [x] Step 1.1: Initialize Project Structure
**Task**: Set up the basic project structure with React, TypeScript, Vite, and Tailwind CSS.

**Implementation**:
- Initialize Vite + React + TypeScript project
- Install and configure Tailwind CSS
- Set up project directory structure:
  ```
  yudimath/
  ├── public/
  │   └── index.html
├── src/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   ├── styles/
│   └── main.tsx
├── tests/
│   ├── unit/
│   ├── utils/
│   └── setup.ts
  ├── docker/
  │   ├── Dockerfile
  │   └── docker-compose.yml
  ├── package.json
  ├── tailwind.config.js
  ├── tsconfig.json
  ├── vitest.config.ts
  └── README.md
  ```

**Tests**:
- Test that Vite dev server starts
- Test that React renders a basic component
- Test that Tailwind CSS is configured correctly

**Commit**: `feat: initialize project structure with React, TypeScript, Vite, and Tailwind`

---

### [x] Step 1.2: Configure Testing Framework
**Task**: Set up Vitest for unit testing with React Testing Library.

**Implementation**:
- Install Vitest, @testing-library/react, @testing-library/jest-dom
- Configure vitest.config.ts
- Create test setup file
- Add test scripts to package.json

**Tests**:
- Test that Vitest runs successfully
- Test that a sample component test passes
- Test that React Testing Library is configured correctly

**Commit**: `feat: configure Vitest and React Testing Library for unit testing`

---

### [x] Step 1.3: Set Up Docker Environment
**Task**: Create Docker configuration for development and production.

**Implementation**:
- Create Dockerfile with multi-stage build
- Create docker-compose.yml for development
- Configure nginx for production serving
- Add .dockerignore file
- Ensure hot-reload works in development mode

**Tests**:
- Test that Docker image builds successfully
- Test that container starts and serves the app
- Test that hot-reload works in development mode

**Commit**: `feat: add Docker configuration for development and production`

---

### [x] Step 1.4: Define TypeScript Types and Interfaces
**Task**: Create comprehensive TypeScript type definitions for the application.

**Implementation**:
- Create `src/types/index.ts` with:
  - `ViewportState`: viewport position, zoom, grid step
  - `CoordinateFrame`: frame properties (id, origin, base vectors, bounds, mode)
  - `Vector`: vector definition
  - `FunctionPlot`: function plot definition
  - `WorkspaceState`: complete workspace state
  - `CoordinateMode`: '2d' | '3d' enum

**Tests**:
- Test that all types compile correctly
- Test type checking with sample data
- Test that interfaces match expected structure

**Commit**: `feat: define TypeScript types and interfaces for application state`

---

### [x] Step 1.5: Set Up Dark Theme Color Palette
**Task**: Configure Tailwind with dark theme color palette and create base styles.

**Implementation**:
- Update tailwind.config.js with custom colors:
  - Background: `#0f172a` (slate-900)
  - Grid Lines: `#334155` (slate-700)
  - Axes: `#64748b` (slate-500)
  - Primary: `#3b82f6` (blue-500)
  - Secondary: `#8b5cf6` (purple-500)
  - Success: `#10b981` (emerald-500)
  - Warning: `#f59e0b` (amber-500)
  - Error: `#ef4444` (red-500)
  - Text Primary: `#f1f5f9` (slate-100)
  - Text Secondary: `#cbd5e1` (slate-300)
  - Panel Background: `#1e293b` (slate-800)
- Create base CSS with dark theme defaults

**Tests**:
- Test that Tailwind classes apply correct colors
- Test that dark theme is applied globally
- Visual test: verify color palette matches specification

**Commit**: `feat: configure dark theme color palette with Tailwind CSS`

---

## Phase 2: Core Coordinate System

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

## Phase 3: Frame/Viewport System

**Note on Nested Frames**: The frame system supports recursive nesting (Russian doll pattern). Frames can be drawn inside other frames, creating a hierarchy where each nested frame has its own coordinate system relative to its parent. This nesting can continue to any depth. When implementing frame features, ensure they work correctly for both top-level frames (relative to background) and nested frames (relative to parent frame).

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

## Phase 4: Python Code Integration

### [x] Step 4.1: Set Up PyScript Integration
**Task**: Configure PyScript in the HTML and set up Python execution environment.

**Implementation**:
- Add PyScript to `public/index.html`
- Configure PyScript to load NumPy and SciPy
- Create Python execution context
- Set up error handling for Python execution
- Create `src/hooks/usePyScript.ts` for Python execution

**Tests**:
- Test that PyScript loads correctly
- Test that NumPy is available
- Test that SciPy is available
- Test Python code execution
- Test error handling for invalid Python code

**Commit**: `feat: set up PyScript integration with NumPy and SciPy`

---

### [x] Step 4.2: Create Code Panel Component
**Task**: Build the right-side code panel with editor and run button.

**Implementation**:
- Create `src/components/CodePanel.tsx`
- Display Python code for selected frame
- Make code editable (use textarea or code editor)
- Add "Run" button
- Show code for selected frame only
- Add syntax highlighting (optional: use simple highlighting)

**Tests**:
- Test code panel displays selected frame code
- Test code panel updates on frame selection
- Test code editing updates state
- Test run button is present and functional
- Test code panel shows default code when no frame selected

**Commit**: `feat: create code panel component with editor and run button`

---

### [x] Step 4.3: Create Predefined Functions System
**Task**: Implement extensible system for predefined Python functions (draw, plot).

**Implementation**:
- Create `src/utils/pythonFunctions.ts` with function registry pattern
- Implement `draw(vector, color?)` function:
  - Accepts numpy array as vector
  - Optional color parameter (string, hex format)
  - Stores vector data for visualization
- Implement `plot(formula, x_min, x_max, color?)` function:
  - Accepts formula as string (e.g., `'2*x + 1'`, `'np.sin(x)'`) or callable
  - x_min and x_max define the evaluation range
  - Optional color parameter (string, hex format)
  - Evaluates formula over the range and stores for visualization
- Create extensible function registration system:
  - Function registry that maps function names to implementations
  - Easy API for developers to add new predefined functions
  - Example: `registerFunction('newFunction', implementation)`
- Inject registered functions into Python execution context
- Store function calls and their parameters for visualization
- Support arbitrary number of function calls per frame

**Tests**:
- Test draw function registration and execution
- Test plot function registration and execution
- Test plot with string formula evaluation
- Test plot with callable formula
- Test function call storage and retrieval
- Test function parameter validation
- Test extensibility: add a new function and verify it works
- Test multiple function calls in single execution
- Test function execution in Python context

**Commit**: `feat: create extensible predefined functions system (draw, plot)`

---

### [x] Step 4.4: Implement Python Code Generator
**Task**: Generate Python code from frame state with default template.

**Implementation**:
- Create `src/utils/codeGenerator.ts`
- Generate default code template:
  ```python
  import numpy as np
  from scipy import linalg
  
  # Coordinate frame definition
  origin = np.array([x, y])  # Snapped to background grid
  base_i = np.array([1, 0])  # Normalized i vector
  base_j = np.array([0, 1])  # Normalized j vector
  
  # Base vectors matrix
  basis_matrix = np.column_stack([base_i, base_j])
  
  # Predefined functions available:
  # - draw(vector, color?) - Draw a vector
  # - plot(formula, x_min, x_max, color?) - Plot a function
  # Example usage:
  # draw(np.array([2, 3]), color='#00ff00')
  # plot('2*x + 1', -5, 5, color='#ff00ff')
  ```
- Update code when frame properties change (origin, base vectors)
- Include comments about available predefined functions
- Preserve user-added code (draw/plot calls) when regenerating

**Tests**:
- Test default code generation
- Test code updates on origin change
- Test code updates on base vector change
- Test code includes correct imports
- Test code format is correct

**Commit**: `feat: implement Python code generator with default template`

---

### [x] Step 4.5: Implement Python Code Execution
**Task**: Execute Python code and update frame visualization.

**Implementation**:
- Execute Python code when Run button is clicked
- Capture function calls (draw, plot) from execution
- Update frame visualization with results
- Handle execution errors gracefully
- Display error messages to user

**Tests**:
- Test Python code execution
- Test draw function calls are captured
- Test plot function calls are captured
- Test error handling for invalid code
- Test visualization updates after execution
- Test multiple function calls in one execution

**Commit**: `feat: implement Python code execution with visualization updates`

---

### [x] Step 4.6: Add Parameter Sliders to Frame Properties
**Task**: Add sliders in Frame Properties panel that create corresponding variables in Python code.

**Implementation**:
- Add slider controls to `PropertiesPanel` component
- Sliders should be dynamically addable/removable
- Each slider creates a variable in Python code with naming convention: `t1`, `t2`, `t3`, etc.
- Store slider values in frame state (add `parameters?: Record<string, number>` to `CoordinateFrame` interface)
- When slider value changes:
  - Update frame state
  - Regenerate Python code to include updated variable value
  - Preserve user-added code (draw/plot calls) when regenerating
- Sliders should have:
  - Label showing variable name (e.g., "t1")
  - Value input/display
  - Min/max range (configurable, default: -10 to 10)
  - Step size (configurable, default: 0.1)
- Generated code should include:
  ```python
  t1 = <value>  # Parameter slider value
  t2 = <value>  # Parameter slider value
  # etc.
  ```
- Code generation should preserve parameter variables when regenerating (similar to how base vectors are preserved)

**Tests**:
- Test slider addition creates variable in code
- Test slider value change updates code
- Test multiple sliders (t1, t2, t3) work correctly
- Test slider removal removes variable from code
- Test code regeneration preserves parameter values
- Test parameter values are preserved when frame properties change
- Test slider min/max/step configuration

**Commit**: `feat: add parameter sliders to frame properties with Python code integration`

---

## Phase 5: Vector and Function Visualization

### [x] Step 5.1: Implement Vector Rendering in Frames
**Task**: Render vectors in frames based on draw() function calls.

**Implementation**:
- Parse draw() function calls from Python execution
- Transform vectors to frame coordinate system
- Render vectors as arrows in the frame
- Apply vector colors
- Handle vectors that extend outside frame bounds

**Tests**:
- Test vector rendering in frame
- Test vector transformation to frame coordinates
- Test vector color application
- Test multiple vectors rendering
- Test vectors outside bounds handling

**Commit**: `feat: implement vector rendering in frames from draw() calls`

---

### [x] Step 5.2: Implement Function Plotting in Frames
**Task**: Render function plots in frames based on plot() function calls.

**Implementation**:
- Parse plot() function calls from Python execution
- Evaluate function formula over x range
- Transform function points to frame coordinate system
- Render function as continuous line/curve
- Apply function colors
- Handle functions that extend outside frame bounds

**Tests**:
- Test function formula evaluation
- Test function rendering in frame
- Test function transformation to frame coordinates
- Test multiple functions rendering
- Test functions with different ranges
- Test functions outside bounds handling

**Commit**: `feat: implement function plotting in frames from plot() calls`

---

### [ ] Step 5.3: Add Vector Builder UI (SKIPPED FOR NOW)
**Task**: Create UI for manually adding vectors to frames.

**Implementation**:
- Create `src/components/VectorBuilder.tsx`
- Add form for vector input (start/end points or components)
- Add "Add Vector" button
- Update frame code with draw() call
- Re-execute code to show vector

**Tests**:
- Test vector builder form inputs
- Test vector addition updates code
- Test vector addition triggers code execution
- Test vector validation
- Test vector appears in visualization

**Commit**: `feat: add vector builder UI for manual vector creation`

---

### [ ] Step 5.4: Add Function Plotter UI (SKIPPED FOR NOW)
**Task**: Create UI for manually adding function plots to frames.

**Implementation**:
- Create `src/components/FunctionPlotter.tsx`
- Add form for function input (formula, x_min, x_max)
- Add "Plot Function" button
- Update frame code with plot() call
- Re-execute code to show function

**Tests**:
- Test function plotter form inputs
- Test function addition updates code
- Test function addition triggers code execution
- Test function formula validation
- Test function appears in visualization

**Commit**: `feat: add function plotter UI for manual function creation`

---

## Phase 6: Workspace Management

### [x] Step 6.1: Implement Workspace State Management
**Task**: Create comprehensive state management for workspace (frames, viewport, etc.).

**Implementation**:
- Create `src/hooks/useWorkspace.ts`
- Manage viewport state
- Manage frames array
- Manage selected frame
- Provide functions for adding/removing/updating frames
- Persist state in localStorage (optional)

**Tests**:
- Test workspace state initialization
- Test frame addition
- Test frame removal
- Test frame update
- Test viewport state management
- Test selected frame management

**Commit**: `feat: implement comprehensive workspace state management`

---

### [x] Step 6.2: Implement Workspace Export
**Task**: Export workspace state to JSON file.

**Implementation**:
- Create `src/utils/exportImport.ts`
- Serialize workspace state to JSON
- Include viewport, frames, and all frame data
- Create downloadable JSON file
- Add "Export Workspace" button to toolbar

**Tests**:
- Test workspace serialization to JSON
- Test JSON structure is correct
- Test export includes all frame data
- Test export file is downloadable
- Test export with multiple frames

**Commit**: `feat: implement workspace export to JSON file`

---

### [x] Step 6.3: Implement Workspace Import
**Task**: Import workspace state from JSON file.

**Implementation**:
- Add file input for JSON selection
- Parse and validate JSON structure
- Restore workspace state from JSON
- Handle import errors gracefully
- Add "Import Workspace" button to toolbar
- Option to merge or replace existing workspace

**Tests**:
- Test JSON file parsing
- Test JSON structure validation
- Test workspace restoration from JSON
- Test import error handling
- Test import with invalid JSON
- Test merge vs replace options

**Commit**: `feat: implement workspace import from JSON file`

---

## Phase 7: UI Polish and Toolbar

### [x] Step 7.1: Create Toolbar Component
**Task**: Build top toolbar with controls (grid step, zoom, export/import, clear).

**Implementation**:
- Create `src/components/Toolbar.tsx`
- Add grid step selector
- Add zoom controls (zoom in/out/reset)
- Add export workspace button
- Add import workspace button
- Add clear workspace button
- Style with dark theme

**Tests**:
- Test toolbar renders all controls
- Test grid step selector works
- Test zoom controls work
- Test export button triggers export
- Test import button triggers import
- Test clear button clears workspace

**Commit**: `feat: create toolbar component with all controls`

---

### [x] Step 7.2: Implement Frame Deletion
**Task**: Allow users to delete selected frames.

**Implementation**:
- Add delete handler for selected frame
- Support Delete key press
- Add delete button in properties panel
- Remove frame from workspace
- Clear selection if deleted frame was selected

**Tests**:
- Test frame deletion removes frame
- Test Delete key deletes selected frame
- Test delete button works
- Test selection cleared after deletion
- Test multiple frames deletion

**Commit**: `feat: implement frame deletion with keyboard and UI support`

---

### [x] Step 7.3: Add Modern UI Styling
**Task**: Apply modern design elements (rounded corners, shadows, transitions, icons).

**Implementation**:
- Add rounded corners to panels (`rounded-lg`, `rounded-xl`)
- Add subtle shadows (`shadow-lg`)
- Add smooth transitions for interactions
- Install and use icon library (Heroicons)
- Improve typography and spacing
- Add hover effects

**Tests**:
- Visual test: verify modern styling applied
- Test transitions work smoothly
- Test icons display correctly
- Test hover effects work
- Test responsive design (if applicable)

**Commit**: `feat: add modern UI styling with animations and icons`

---

### [x] Step 7.4: Add Loading and Error States
**Task**: Implement loading indicators and error message display.

**Implementation**:
- Show loading indicator during Python execution
- Display error messages for Python execution errors
- Show error messages for invalid inputs
- Add error boundaries for React errors
- Style error messages with dark theme

**Tests**:
- Test loading indicator shows during execution
- Test error messages display for Python errors
- Test error messages for invalid inputs
- Test error boundaries catch React errors
- Test error styling matches theme

**Commit**: `feat: add loading and error states with user feedback`

---

## Phase 8: Testing and Optimization

### [x] Step 8.1: Comprehensive Unit Test Coverage
**Task**: Ensure all utility functions and components have unit tests.

**Implementation**:
- Review all utility functions and add missing tests
- Review all components and add missing tests
- Aim for >80% code coverage
- Test edge cases and error conditions
- Test coordinate transformations thoroughly

**Tests**:
- Run test coverage report
- Verify all critical paths are tested
- Verify edge cases are covered
- All tests must pass

**Completed**:
- Added comprehensive tests for Modal.tsx (17 tests)
- Added comprehensive tests for LoadingOverlay.tsx (9 tests)
- Added comprehensive tests for FrameEditorPanel.tsx (15 tests)
- Overall test coverage improved significantly
- All 300+ tests pass

**Commit**: `test: add comprehensive unit test coverage`

---

### [x] Step 8.2: Performance Optimization
**Task**: Optimize rendering and state management for performance.

**Implementation**:
- Use React.memo for expensive components
- Implement canvas rendering optimizations
- Debounce code generation updates
- Optimize coordinate transformations
- Use useCallback and useMemo appropriately

**Tests**:
- Test rendering performance with many frames
- Test canvas performance with complex scenes
- Test code generation performance
- Verify no unnecessary re-renders

**Completed**:
- Applied React.memo to Canvas and PropertiesPanel components
- Implemented useCallback for draw function and event handlers
- Used useMemo for expensive computations (topLevelFrames filtering)
- Implemented requestAnimationFrame for canvas rendering
- Removed debounce from sliders for immediate, smooth response
- Optimized code editor scroll synchronization

**Commit**: `perf: optimize rendering and state management`

---

### [SKIPPED FOR NOW] Step 8.3: Add 2D Mode Architecture Support for 3D
**Task**: Prepare architecture for 3D mode while keeping 2D as default.

**Implementation**:
- Add CoordinateMode type ('2d' | '3d')
- Add mode property to frames (default '2d')
- Update type definitions to support 3D (use arrays that can be 2D or 3D)
- Add mode selector to UI (disabled for now, shows "2D Mode")
- Ensure code generation supports mode

**Tests**:
- Test mode property is '2d' by default
- Test type definitions support both modes
- Test code generation works with mode
- Test architecture doesn't break 2D functionality

**Status**: Skipped for now - focusing on perfecting 2D mode first

**Commit**: `feat: add architecture support for 3D mode (2D remains default)`

---

## Phase 9: Project Refactoring and Code Cleanup

**Note**: This phase focuses on improving code maintainability, modularity, and flexibility for future extensions. Files have grown large and need to be broken down into smaller, focused modules.

### [ ] Step 9.1: Analyze and Document Current File Sizes
**Task**: Identify files that exceed size limits and need refactoring.

**Implementation**:
- Run analysis to identify files exceeding 500 lines (hard limit)
- Identify files exceeding 300 lines (soft limit - consider refactoring)
- Document dependencies and relationships between large files
- Create refactoring plan prioritizing most critical files
- Focus on: `src/utils/frameDrawing.ts`, `src/utils/pythonFunctions.ts`, `src/App.tsx`, `src/components/CoordinateFrame.tsx`

**Tests**:
- Verify file size analysis is accurate
- Verify refactoring plan covers all large files
- Verify dependencies are correctly identified

**Commit**: `refactor: analyze file sizes and create refactoring plan`

---

### [ ] Step 9.2: Refactor Frame Drawing Utilities
**Task**: Break down `src/utils/frameDrawing.ts` into smaller, focused modules.

**Implementation**:
- Extract grid drawing logic to `src/utils/gridDrawing.ts`
- Extract axes drawing logic to `src/utils/axesDrawing.ts`
- Extract function plotting logic to `src/utils/functionDrawing.ts`
- Extract vector drawing logic to `src/utils/vectorDrawing.ts`
- Extract discontinuity detection to `src/utils/discontinuityDetection.ts`
- Keep only coordination logic in `frameDrawing.ts`
- Ensure all extracted modules follow single responsibility principle
- Each module should be <300 lines

**Tests**:
- Verify all existing tests still pass
- Add tests for extracted modules
- Verify no functionality is lost
- Verify modules are properly imported and used

**Commit**: `refactor: break down frameDrawing.ts into focused modules`

---

### [ ] Step 9.3: Refactor Python Functions System
**Task**: Break down `src/utils/pythonFunctions.ts` into smaller, focused modules.

**Implementation**:
- Extract function registry to `src/utils/pythonFunctionRegistry.ts`
- Extract plot implementation to `src/utils/pythonPlot.ts`
- Extract draw implementation to `src/utils/pythonDraw.ts`
- Extract point caching logic to `src/utils/pointCache.ts`
- Extract progressive rendering logic to `src/utils/progressiveRendering.ts`
- Keep only core setup and context management in `pythonFunctions.ts`
- Each module should be <300 lines

**Tests**:
- Verify all existing tests still pass
- Add tests for extracted modules
- Verify function registration still works
- Verify plot and draw functions still work correctly

**Commit**: `refactor: break down pythonFunctions.ts into focused modules`

---

### [ ] Step 9.4: Refactor Main App Component
**Task**: Break down `src/App.tsx` into smaller, focused components.

**Implementation**:
- Extract viewport management to `src/hooks/useViewport.ts` (if not already separate)
- Extract frame management logic to `src/hooks/useFrameManagement.ts`
- Extract canvas rendering coordination to `src/components/CanvasRenderer.tsx`
- Extract UI layout to `src/components/AppLayout.tsx`
- Keep only high-level coordination in `App.tsx`
- Each component/hook should be <300 lines

**Tests**:
- Verify all existing tests still pass
- Add tests for extracted hooks and components
- Verify app functionality is unchanged
- Verify component composition works correctly

**Commit**: `refactor: break down App.tsx into focused components and hooks`

---

### [ ] Step 9.5: Refactor Coordinate Frame Component
**Task**: Break down `src/components/CoordinateFrame.tsx` into smaller sub-components.

**Implementation**:
- Extract frame grid rendering to `src/components/FrameGrid.tsx`
- Extract frame axes rendering to `src/components/FrameAxes.tsx`
- Extract base vector visualization to `src/components/BaseVectors.tsx`
- Extract nested frame rendering to `src/components/NestedFrames.tsx`
- Keep only frame coordination and selection logic in `CoordinateFrame.tsx`
- Each component should be <300 lines

**Tests**:
- Verify all existing tests still pass
- Add tests for extracted components
- Verify frame rendering is unchanged
- Verify nested frames still work correctly

**Commit**: `refactor: break down CoordinateFrame.tsx into focused sub-components`

---

### [ ] Step 9.6: Extract Common Utilities and Types
**Task**: Consolidate and organize utility functions and types for better reusability.

**Implementation**:
- Review all utility functions in `src/utils/` for duplication
- Consolidate similar functions into shared utilities
- Extract common types to `src/types/common.ts`
- Extract common constants to `src/constants/index.ts`
- Ensure all utilities follow single responsibility principle
- Document utility functions with JSDoc

**Tests**:
- Verify all existing tests still pass
- Verify no functionality is lost
- Verify utilities are properly exported
- Verify types are correctly used throughout codebase

**Commit**: `refactor: consolidate and organize common utilities and types`

---

### [ ] Step 9.7: Improve Code Organization and Naming
**Task**: Ensure consistent naming conventions and logical file organization.

**Implementation**:
- Review all file names for consistency
- Ensure component files use PascalCase
- Ensure utility files use camelCase
- Ensure type files are clearly named
- Organize imports consistently (external, internal, types)
- Remove unused imports and code
- Ensure consistent code formatting

**Tests**:
- Verify code compiles without errors
- Verify no unused imports remain
- Verify naming conventions are consistent
- Run linter and fix all issues

**Commit**: `refactor: improve code organization and naming conventions`

---

## Phase 10: Parametric Function Plotting

**Note**: This phase adds support for parametric functions where x and y are both functions of a parameter t (e.g., x = sin(t), y = cos(t) creates a circle).

### [ ] Step 10.1: Design Parametric Plot Function API
**Task**: Design the API for parametric plot function in Python.

**Implementation**:
- Design function signature: `plot_parametric(x_func, y_func, t_min, t_max, color?)`
  - `x_func`: function of t (string expression or callable) - e.g., `'sin(t)'` or `lambda t: np.sin(t)`
  - `y_func`: function of t (string expression or callable) - e.g., `'cos(t)'` or `lambda t: np.cos(t)`
  - `t_min`: minimum parameter value
  - `t_max`: maximum parameter value
  - `color`: optional color string
- Design adaptive sampling strategy for parametric curves
- Consider how to handle discontinuities in parametric curves
- Document expected behavior and examples

**Tests**:
- Verify API design is clear and intuitive
- Verify examples work conceptually
- Verify adaptive sampling strategy is sound

**Commit**: `feat: design parametric plot function API`

---

### [x] Step 10.2: Implement Parametric Plot Function Registration
**Task**: Register `plot_parametric` function in the Python function registry.

**Implementation**:
- Add `plotParametricImplementation` to `src/utils/pythonFunctions.ts` (or extracted module)
- Register function as `'plot_parametric'` in function registry
- Validate parameters (x_func, y_func, t_min, t_max, color)
- Support both string expressions and callable functions for x_func and y_func
- Store parametric plot data in frame state
- Add `ParametricPlot` type to `src/types/index.ts`:
  ```typescript
  interface ParametricPlot {
    id: string
    xFunc: string  // or callable marker
    yFunc: string  // or callable marker
    tMin: number
    tMax: number
    color?: string
    points?: PointStorage  // evaluated points
    isProgressive?: boolean
    cacheKey?: string
  }
  ```

**Tests**:
- Test function registration
- Test parameter validation
- Test string expression handling
- Test callable function handling
- Test function call storage

**Commit**: `feat: implement parametric plot function registration`

---

### [ ] Step 10.3: Implement Parametric Function Evaluation
**Task**: Evaluate parametric functions over t range and generate points.

**Implementation**:
- Create `evaluateParametricFunction` utility
- Evaluate x_func(t) and y_func(t) over t range
- Use adaptive sampling similar to regular plot function
- Handle discontinuities in parametric curves (when x or y becomes infinite/NaN)
- Generate points array: `[[x1, y1], [x2, y2], ...]`
- Support progressive rendering for parametric plots
- Implement point caching for parametric functions

**Tests**:
- Test parametric evaluation with simple functions (circle: x=sin(t), y=cos(t))
- Test parametric evaluation with complex functions
- Test adaptive sampling works correctly
- Test discontinuity detection
- Test progressive rendering
- Test point caching

**Commit**: `feat: implement parametric function evaluation with adaptive sampling`

---

### [ ] Step 10.4: Implement Parametric Plot Rendering
**Task**: Render parametric plots in frames.

**Implementation**:
- Add parametric plot rendering to frame drawing logic
- Transform parametric points to frame coordinate system
- Draw parametric curve as continuous line/curve
- Handle parametric curves that extend outside frame bounds
- Apply parametric plot colors
- Support multiple parametric plots per frame
- Handle discontinuities in parametric curves (break curve at discontinuities)

**Tests**:
- Test parametric plot rendering (circle, ellipse, etc.)
- Test parametric plot transformation to frame coordinates
- Test multiple parametric plots rendering
- Test parametric plots with different t ranges
- Test parametric plots outside bounds handling
- Test discontinuity handling in parametric curves

**Commit**: `feat: implement parametric plot rendering in frames`

---

### [ ] Step 10.5: Add Parametric Plot Examples and Documentation
**Task**: Add examples and update documentation for parametric plots.

**Implementation**:
- Add example parametric plots to default code templates:
  - Circle: `plot_parametric('cos(t)', 'sin(t)', 0, 2*np.pi)`
  - Ellipse: `plot_parametric('2*cos(t)', 'sin(t)', 0, 2*np.pi)`
  - Spiral: `plot_parametric('t*cos(t)', 't*sin(t)', 0, 4*np.pi)`
  - Lissajous curve: `plot_parametric('sin(3*t)', 'cos(2*t)', 0, 2*np.pi)`
- Update code generator to include parametric plot examples
- Document parametric plot function in code comments
- Add parametric plot examples to README (when created)

**Tests**:
- Test example parametric plots render correctly
- Test code generation includes examples
- Verify examples are mathematically correct

**Commit**: `docs: add parametric plot examples and documentation`

---

## Phase 11: Implicit Function Plotting

**Note**: This phase adds support for implicit functions where f(x, y) = 0 (e.g., x² + y² = 16 creates a circle, x² + y² - 16 = 0).

### [ ] Step 11.1: Design Implicit Plot Function API
**Task**: Design the API for implicit plot function in Python.

**Implementation**:
- Design function signature: `plot_implicit(equation, x_min, x_max, y_min, y_max, color?)`
  - `equation`: function of x and y (string expression or callable) - e.g., `'x**2 + y**2 - 16'` or `lambda x, y: x**2 + y**2 - 16`
  - `x_min`, `x_max`: x range for search
  - `y_min`, `y_max`: y range for search
  - `color`: optional color string
- Design contour finding algorithm (marching squares or similar)
- Consider performance implications of 2D search
- Document expected behavior and examples

**Tests**:
- Verify API design is clear and intuitive
- Verify examples work conceptually
- Verify contour finding strategy is sound

**Commit**: `feat: design implicit plot function API`

---

### [ ] Step 11.2: Implement Implicit Plot Function Registration
**Task**: Register `plot_implicit` function in the Python function registry.

**Implementation**:
- Add `plotImplicitImplementation` to `src/utils/pythonFunctions.ts` (or extracted module)
- Register function as `'plot_implicit'` in function registry
- Validate parameters (equation, x_min, x_max, y_min, y_max, color)
- Support both string expressions and callable functions for equation
- Store implicit plot data in frame state
- Add `ImplicitPlot` type to `src/types/index.ts`:
  ```typescript
  interface ImplicitPlot {
    id: string
    equation: string  // or callable marker
    xMin: number
    xMax: number
    yMin: number
    yMax: number
    color?: string
    points?: PointStorage  // contour points
    isProgressive?: boolean
    cacheKey?: string
  }
  ```

**Tests**:
- Test function registration
- Test parameter validation
- Test string expression handling
- Test callable function handling
- Test function call storage

**Commit**: `feat: implement implicit plot function registration`

---

### [ ] Step 11.3: Implement Contour Finding Algorithm
**Task**: Implement algorithm to find contour points where f(x, y) = 0.

**Implementation**:
- Create `findContourPoints` utility function
- Implement marching squares algorithm (or similar contour finding method)
- Evaluate equation over 2D grid in specified range
- Find points where equation crosses zero (sign changes)
- Generate contour points array
- Optimize for performance (adaptive grid resolution, early termination)
- Handle multiple disconnected contours
- Support progressive rendering for implicit plots

**Tests**:
- Test contour finding for circle (x² + y² - 16 = 0)
- Test contour finding for ellipse
- Test contour finding for multiple disconnected curves
- Test contour finding for complex equations
- Test performance with various grid resolutions
- Test progressive rendering

**Commit**: `feat: implement contour finding algorithm for implicit functions`

---

### [ ] Step 11.4: Implement Implicit Plot Rendering
**Task**: Render implicit plots in frames.

**Implementation**:
- Add implicit plot rendering to frame drawing logic
- Transform implicit contour points to frame coordinate system
- Draw implicit curves as continuous lines
- Handle implicit curves that extend outside frame bounds
- Apply implicit plot colors
- Support multiple implicit plots per frame
- Handle multiple disconnected contours correctly

**Tests**:
- Test implicit plot rendering (circle, ellipse, etc.)
- Test implicit plot transformation to frame coordinates
- Test multiple implicit plots rendering
- Test implicit plots with different ranges
- Test implicit plots outside bounds handling
- Test multiple disconnected contours rendering

**Commit**: `feat: implement implicit plot rendering in frames`

---

### [ ] Step 11.5: Optimize Implicit Plot Performance
**Task**: Optimize implicit plot evaluation and rendering for performance.

**Implementation**:
- Implement adaptive grid resolution (finer near contours, coarser elsewhere)
- Cache equation evaluations where possible
- Optimize contour finding algorithm
- Use progressive rendering for large implicit plots
- Consider Web Workers for heavy computation (optional)
- Add performance monitoring for implicit plots

**Tests**:
- Test performance with simple implicit equations
- Test performance with complex implicit equations
- Test adaptive grid resolution works correctly
- Test progressive rendering improves perceived performance
- Verify no visual quality degradation from optimizations

**Commit**: `perf: optimize implicit plot evaluation and rendering`

---

### [ ] Step 11.6: Add Implicit Plot Examples and Documentation
**Task**: Add examples and update documentation for implicit plots.

**Implementation**:
- Add example implicit plots to default code templates:
  - Circle: `plot_implicit('x**2 + y**2 - 16', -10, 10, -10, 10)`
  - Ellipse: `plot_implicit('x**2/4 + y**2 - 1', -5, 5, -5, 5)`
  - Hyperbola: `plot_implicit('x**2 - y**2 - 1', -5, 5, -5, 5)`
  - Rose curve: `plot_implicit('x**2 + y**2 - 4*x*y', -5, 5, -5, 5)`
- Update code generator to include implicit plot examples
- Document implicit plot function in code comments
- Add implicit plot examples to README (when created)

**Tests**:
- Test example implicit plots render correctly
- Test code generation includes examples
- Verify examples are mathematically correct

**Commit**: `docs: add implicit plot examples and documentation`

---

## Phase 12: Determinant Visualization (Matrix Area Fill)

**Note**: This phase adds a function to visualize the geometric interpretation of a 2x2 matrix determinant by filling the parallelogram/rectangle formed by two vectors. The filled area represents the absolute value of the determinant.

### [ ] Step 12.1: Design Determinant Fill Function API
**Task**: Design the API for filling the parallelogram formed by two vectors.

**Implementation**:
- Design function signature: `fill_determinant(vector1, vector2, color?)`
  - `vector1`: first column vector (numpy array) - e.g., `np.array([2, 0])`
  - `vector2`: second column vector (numpy array) - e.g., `np.array([0, 3])`
  - `color`: optional color string (default: semi-transparent blue)
- The parallelogram is formed by:
  - Origin (0, 0) in frame coordinates
  - `vector1` endpoint
  - `vector1 + vector2` endpoint
  - `vector2` endpoint
- The filled area represents the absolute value of det([vector1 | vector2])
- Document expected behavior and geometric interpretation
- Consider adding opacity/transparency for better visualization

**Tests**:
- Verify API design is clear and intuitive
- Verify geometric interpretation is correct
- Verify examples work conceptually

**Commit**: `feat: design determinant fill function API`

---

### [ ] Step 12.2: Implement Determinant Fill Function Registration
**Task**: Register `fill_determinant` function in the Python function registry.

**Implementation**:
- Add `fillDeterminantImplementation` to `src/utils/pythonFunctions.ts` (or extracted module)
- Register function as `'fill_determinant'` in function registry
- Validate parameters (vector1, vector2, color)
- Ensure vectors are 2D arrays
- Store determinant fill data in frame state
- Add `DeterminantFill` type to `src/types/index.ts`:
  ```typescript
  interface DeterminantFill {
    id: string
    vector1: [number, number]  // first column vector
    vector2: [number, number]  // second column vector
    color?: string
    determinant?: number  // calculated determinant value
  }
  ```

**Tests**:
- Test function registration
- Test parameter validation
- Test vector validation (must be 2D)
- Test function call storage
- Test determinant calculation

**Commit**: `feat: implement determinant fill function registration`

---

### [ ] Step 12.3: Calculate Parallelogram Vertices
**Task**: Calculate the four vertices of the parallelogram formed by two vectors.

**Implementation**:
- Create `calculateParallelogramVertices` utility function
- Calculate vertices:
  - `v0 = [0, 0]` (origin)
  - `v1 = vector1`
  - `v2 = vector1 + vector2`
  - `v3 = vector2`
- Transform vertices to frame coordinate system
- Calculate determinant: `det = vector1[0] * vector2[1] - vector1[1] * vector2[0]`
- Store determinant value for display/annotation (optional)

**Tests**:
- Test vertex calculation with perpendicular vectors (rectangle)
- Test vertex calculation with non-perpendicular vectors (parallelogram)
- Test vertex calculation with negative components
- Test determinant calculation accuracy
- Test coordinate transformation

**Commit**: `feat: implement parallelogram vertex calculation`

---

### [ ] Step 12.4: Implement Determinant Fill Rendering
**Task**: Render filled parallelogram in frames.

**Implementation**:
- Add determinant fill rendering to frame drawing logic
- Use canvas `fillRect` or `fill` with polygon path
- Fill parallelogram with specified color (or default)
- Apply transparency/opacity for better visualization (overlap visibility)
- Render parallelogram outline (optional, for clarity)
- Support multiple determinant fills per frame
- Handle determinant fills that extend outside frame bounds
- Consider rendering order (fills behind vectors/plots)

**Tests**:
- Test determinant fill rendering (rectangle case)
- Test determinant fill rendering (parallelogram case)
- Test determinant fill with different colors
- Test multiple determinant fills rendering
- Test determinant fill transformation to frame coordinates
- Test determinant fill outside bounds handling
- Test rendering order (fills don't obscure vectors)

**Commit**: `feat: implement determinant fill rendering in frames`

---

### [ ] Step 12.5: Add Determinant Visualization Features
**Task**: Add optional features to enhance determinant visualization.

**Implementation**:
- Add optional outline/stroke to parallelogram (configurable)
- Add optional determinant value label/annotation
- Add optional grid overlay showing unit squares
- Consider adding animation for determinant changes (when vectors change)
- Add visual feedback for positive vs negative determinant (optional: different colors or patterns)
- Ensure fills are semi-transparent so overlapping areas are visible

**Tests**:
- Test outline rendering (if implemented)
- Test determinant value display (if implemented)
- Test grid overlay (if implemented)
- Test visual feedback for determinant sign (if implemented)
- Test transparency allows seeing overlapping fills

**Commit**: `feat: add enhanced determinant visualization features`

---

### [ ] Step 12.6: Add Determinant Fill Examples and Documentation
**Task**: Add examples and update documentation for determinant fills.

**Implementation**:
- Add example determinant fills to default code templates:
  - Unit square: `fill_determinant(np.array([1, 0]), np.array([0, 1]))`
  - Rectangle: `fill_determinant(np.array([3, 0]), np.array([0, 2]))`
  - Parallelogram: `fill_determinant(np.array([2, 1]), np.array([1, 2]))`
  - Negative determinant: `fill_determinant(np.array([1, 0]), np.array([0, -1]))`
- Update code generator to include determinant fill examples
- Document determinant fill function in code comments
- Explain geometric interpretation (area = |det|)
- Add determinant fill examples to README (when created)

**Tests**:
- Test example determinant fills render correctly
- Test code generation includes examples
- Verify examples are mathematically correct
- Verify geometric interpretation is clear

**Commit**: `docs: add determinant fill examples and documentation`

---

## Phase 13: Documentation and Finalization (Deferred)

**Note**: Phase 9 documentation tasks are deferred. This phase will be completed after core functionality is fully implemented and tested.

### [ ] Step 12.1: Create README Documentation
**Task**: Write comprehensive README with setup and usage instructions.

**Status**: Deferred until after core features are complete

---

### [ ] Step 12.2: Code Documentation
**Task**: Add JSDoc comments to all functions and components.

**Status**: Deferred until after refactoring is complete

---

## Verification Checklist

Before considering the project complete, verify:

- [ ] All steps are completed and checked off
- [ ] All unit tests pass
- [ ] Application runs in Docker without errors
- [ ] Dark theme is applied consistently
- [ ] Infinite coordinate system works with pan/zoom
- [ ] Frames can be drawn and selected
- [ ] Frame coordinate grids render correctly
- [ ] Base vectors can be edited
- [ ] Python code panel displays and updates correctly
- [ ] Python code execution works
- [ ] draw() function renders vectors
- [ ] plot() function renders functions
- [ ] plot_parametric() function renders parametric curves
- [ ] plot_implicit() function renders implicit equations
- [ ] fill_determinant() function fills parallelogram formed by two vectors
- [ ] Workspace export/import works
- [ ] All UI controls function correctly
- [ ] Application is responsive and performant
- [ ] Code is modular and maintainable (files <500 lines)
- [ ] Code is well-documented
- [ ] README is complete

---

## Notes

- **Extensibility**: The predefined functions system should allow easy addition of new functions. Consider a plugin-like architecture.
- **Performance**: Use canvas efficiently - only redraw when necessary, use requestAnimationFrame for smooth animations.
- **Error Handling**: Always handle errors gracefully and provide user feedback.
- **Accessibility**: Consider keyboard navigation and screen reader support for future enhancements.
- **3D Mode**: Architecture supports 3D, but implementation is deferred. Focus on perfecting 2D mode first.
- **Code Modularity**: Maintain files under 500 lines (hard limit) and ideally under 300 lines. Break down large files proactively to ensure maintainability and flexibility for future extensions.
- **Plotting Capabilities**: The application supports multiple plotting types:
  - **Explicit functions**: `plot(formula, x_min, x_max)` - y = f(x)
  - **Parametric curves**: `plot_parametric(x_func, y_func, t_min, t_max)` - x = f(t), y = g(t)
  - **Implicit equations**: `plot_implicit(equation, x_min, x_max, y_min, y_max)` - f(x, y) = 0
- **Matrix Visualization**: The application supports geometric matrix interpretations:
  - **Determinant visualization**: `fill_determinant(vector1, vector2, color?)` - fills parallelogram formed by two vectors, area = |det([vector1 | vector2])|
- **Competitive Goal**: This application aims to match and exceed Desmos functionality, providing a powerful, flexible mathematical visualization tool.

---

## Extending These Instructions

**This is a living document.** As the project progresses:

- ✅ **After completing a step**: Mark it as complete with `[x]` and update any relevant notes
- ✅ **When adding new features**: Add new steps following the same format and workflow
- ✅ **When discovering issues**: Add notes or additional test requirements to existing steps
- ✅ **When requirements change**: Update the relevant sections and steps accordingly

**Format for new steps:**
- Use the same structure: `### [ ] Step X.Y: Title`
- Include: **Task**, **Implementation**, **Tests**, **Commit** message
- Place steps in logical evolutionary order
- Ensure each step is logically complete and testable

**Developer can:**
- Request additional tasks to be added to this checklist
- Modify existing steps if requirements change
- Add new phases as the project evolves
- Extend the predefined functions system with new functions
