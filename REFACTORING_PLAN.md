# Refactoring Plan - Phase 9

## File Size Analysis

### Files Exceeding 500 Lines (Hard Limit - Must Refactor)

1. **`src/utils/pythonFunctions.ts`**: 2172 lines ❌
   - **Priority**: CRITICAL
   - **Status**: Way over limit (4x the limit!)

2. **`src/utils/frameDrawing.ts`**: 1415 lines ❌
   - **Priority**: CRITICAL
   - **Status**: Way over limit (3x the limit!)

3. **`src/components/Canvas.tsx`**: 862 lines ❌
   - **Priority**: HIGH
   - **Status**: Over limit

4. **`src/components/CodePanel.tsx`**: 622 lines ❌
   - **Priority**: HIGH
   - **Status**: Over limit

5. **`src/App.tsx`**: 609 lines ❌
   - **Priority**: HIGH
   - **Status**: Over limit

6. **`src/components/PropertiesPanel.tsx`**: 518 lines ❌
   - **Priority**: MEDIUM
   - **Status**: Just over limit

### Files Exceeding 300 Lines (Soft Limit - Consider Refactoring)

7. **`src/hooks/usePyScript.ts`**: 391 lines ⚠️
   - **Priority**: MEDIUM
   - **Status**: Over soft limit

8. **`src/utils/frameTransforms.ts`**: 374 lines ⚠️
   - **Priority**: LOW
   - **Status**: Over soft limit

9. **`src/utils/codeGenerator.ts`**: 309 lines ⚠️
   - **Priority**: LOW
   - **Status**: Just over soft limit

10. **`src/hooks/useCanvasDrawing.ts`**: 300 lines ⚠️
    - **Priority**: LOW
    - **Status**: At soft limit

---

## Refactoring Plan by File

### 1. `src/utils/pythonFunctions.ts` (2172 lines → Target: <500 lines)

**Current Responsibilities:**
- Function registry system
- Plot implementation (string and callable)
- Draw implementation
- Point caching
- Progressive rendering
- Canvas info management
- Function context setup
- Python function injection

**Extraction Plan:**
- **`src/utils/pythonFunctionRegistry.ts`** (~200 lines)
  - Function registry pattern
  - Function registration/unregistration
  - Function lookup
  
- **`src/utils/pythonPlot.ts`** (~400 lines)
  - `plotImplementation` function
  - Plot evaluation logic
  - String expression handling
  - Callable function handling
  
- **`src/utils/pythonDraw.ts`** (~150 lines)
  - `drawImplementation` function
  - Vector validation and storage
  
- **`src/utils/pointCache.ts`** (~200 lines)
  - Point caching logic
  - Cache key generation
  - Cache retrieval and storage
  - Cache clearing
  
- **`src/utils/progressiveRendering.ts`** (~300 lines)
  - Progressive rendering logic
  - Progressive point storage
  
- **`src/utils/pythonContext.ts`** (~200 lines)
  - Canvas info management
  - Function context setup
  - Python function injection
  - Context clearing

**Remaining in `pythonFunctions.ts`** (~500 lines):
- Core exports
- Type definitions
- Main coordination logic

---

### 2. `src/utils/frameDrawing.ts` (1415 lines → Target: <500 lines)

**Current Responsibilities:**
- Main frame drawing coordination
- Frame grid drawing
- Frame axes drawing
- Frame vectors drawing
- Frame functions drawing
- Smooth curve drawing
- Discontinuity detection

**Extraction Plan:**
- **`src/utils/gridDrawing.ts`** (~300 lines)
  - `drawFrameGrid` function
  - Grid line calculation
  - Grid spacing logic
  
- **`src/utils/axesDrawing.ts`** (~400 lines)
  - `drawFrameAxes` function
  - Axis line drawing
  - Axis label calculation and rendering
  
- **`src/utils/functionDrawing.ts`** (~500 lines)
  - `drawFrameFunctions` function
  - Function point rendering
  - Smooth curve drawing
  - Discontinuity detection logic
  
- **`src/utils/vectorDrawing.ts`** (~150 lines)
  - `drawFrameVectors` function
  - Vector arrow rendering
  
- **`src/utils/discontinuityDetection.ts`** (~200 lines)
  - Discontinuity detection algorithm
  - Threshold calculation
  - Point validation logic

**Remaining in `frameDrawing.ts`** (~300 lines):
- `drawCoordinateFrame` main function
- Frame bounds calculation
- Clipping logic
- Child frame recursion

---

### 3. `src/App.tsx` (609 lines → Target: <500 lines)

**Current Responsibilities:**
- Main app component
- Viewport state management
- Frame management
- Canvas rendering coordination
- UI layout

**Extraction Plan:**
- **`src/hooks/useViewport.ts`** (if not already separate)
  - Viewport state management
  - Pan/zoom handlers
  
- **`src/hooks/useFrameManagement.ts`** (~200 lines)
  - Frame CRUD operations
  - Frame selection
  - Frame hierarchy management
  
- **`src/components/AppLayout.tsx`** (~150 lines)
  - UI layout structure
  - Component composition

**Remaining in `App.tsx`** (~300 lines):
- High-level coordination
- Main component structure

---

### 4. `src/components/Canvas.tsx` (862 lines → Target: <500 lines)

**Current Responsibilities:**
- Canvas rendering
- Background grid/axes
- Frame rendering coordination
- Mouse/touch event handling
- Viewport interaction

**Extraction Plan:**
- **`src/components/BackgroundCanvas.tsx`** (~200 lines)
  - Background grid rendering
  - Background axes rendering
  
- **`src/hooks/useCanvasEvents.ts`** (~300 lines)
  - Mouse event handlers
  - Touch event handlers
  - Pan/zoom logic

**Remaining in `Canvas.tsx`** (~400 lines):
- Canvas setup
- Frame rendering coordination
- Main draw loop

---

### 5. `src/components/CodePanel.tsx` (622 lines → Target: <500 lines)

**Current Responsibilities:**
- Code editor display
- Code editing
- Run button
- Code synchronization

**Extraction Plan:**
- **`src/components/CodeEditor.tsx`** (~300 lines)
  - Code editor component
  - Syntax highlighting
  - Editor configuration
  
- **`src/components/CodeControls.tsx`** (~150 lines)
  - Run button
  - Code actions

**Remaining in `CodePanel.tsx`** (~200 lines):
- Panel layout
- Code synchronization logic

---

### 6. `src/components/PropertiesPanel.tsx` (518 lines → Target: <500 lines)

**Current Responsibilities:**
- Frame properties editing
- Base vector editing
- Parameter sliders
- Frame deletion

**Extraction Plan:**
- Already uses `ParameterSliders.tsx` component
- Consider extracting base vector editor to separate component (~150 lines)

**Remaining in `PropertiesPanel.tsx`** (~400 lines):
- Panel layout
- Property editing coordination

---

## Dependencies and Relationships

### Critical Dependencies:
- `frameDrawing.ts` depends on: `frameTransforms.ts`, `coordinates.ts`, `arrows.ts`, `frameUtils.ts`
- `pythonFunctions.ts` is mostly independent (few dependencies)
- `App.tsx` depends on: `Canvas.tsx`, `CodePanel.tsx`, `PropertiesPanel.tsx`, `Toolbar.tsx`
- `Canvas.tsx` depends on: `frameDrawing.ts`, `canvasDrawing.ts`

### Refactoring Order:
1. **Start with `pythonFunctions.ts`** - Most critical, fewest dependencies
2. **Then `frameDrawing.ts`** - High priority, but depends on transforms
3. **Then `App.tsx`** - Depends on other components
4. **Then `Canvas.tsx`** - Depends on frameDrawing
5. **Then `CodePanel.tsx`** - Independent
6. **Finally `PropertiesPanel.tsx`** - Lowest priority

---

## Testing Strategy

For each refactoring:
1. ✅ Run all existing tests before refactoring
2. ✅ Extract code to new modules
3. ✅ Update imports
4. ✅ Run tests again - all should pass
5. ✅ Add tests for new modules
6. ✅ Verify functionality in browser
7. ✅ Check file sizes meet targets

---

## Success Criteria

- ✅ All files under 500 lines (hard limit)
- ✅ Most files under 300 lines (soft limit)
- ✅ All existing tests pass
- ✅ No functionality lost
- ✅ Code is more maintainable
- ✅ New modules follow single responsibility principle
- ✅ Imports are clean and logical



