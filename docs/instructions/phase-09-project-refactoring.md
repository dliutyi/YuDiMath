# Phase 9: Project Refactoring and Code Cleanup

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

**Note**: This phase focuses on improving code maintainability, modularity, and flexibility for future extensions. Files have grown large and need to be broken down into smaller, focused modules.

---

### [x] Step 9.1: Analyze and Document Current File Sizes
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

### [x] Step 9.2: Refactor Frame Drawing Utilities
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

### [x] Step 9.3: Refactor Python Functions System
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

### [x] Step 9.4: Refactor Main App Component (SKIPPED - kept original working version)
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

### [x] Step 9.5: Refactor Coordinate Frame Component (SKIPPED - only 18 lines, already modular)
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

### [x] Step 9.6: Extract Common Utilities and Types
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

### [x] Step 9.7: Improve Code Organization and Naming
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

**Status**: ✅ **COMPLETE** - All steps completed (some skipped as noted)

