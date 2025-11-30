# Linear Algebra & Calculus Web Application - Development Instructions

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

**See [README.md](README.md) for the main instructions file with phase completion status.**

