# Phase 11: Implicit Function Plotting

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

**Note**: This phase adds support for implicit functions where f(x, y) = 0 (e.g., x² + y² = 16 creates a circle, x² + y² - 16 = 0).

---

### [x] Step 11.1: Design Implicit Plot Function API
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

### [x] Step 11.2: Implement Implicit Plot Function Registration
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

### [x] Step 11.3: Implement Contour Finding Algorithm
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

### [x] Step 11.4: Implement Implicit Plot Rendering
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

### [x] Step 11.5: Optimize Implicit Plot Performance
**Task**: Optimize implicit plot evaluation and rendering for performance.

**Implementation**:
- [x] Implement adaptive grid resolution (zoom-aware scaling)
- [x] Cache equation evaluations where possible (implicitCache.ts)
- [x] Optimize contour finding algorithm
- [ ] Use progressive rendering for large implicit plots (deferred - see note below)
- [ ] Consider Web Workers for heavy computation (optional)
- [ ] Add performance monitoring for implicit plots

**Note on Progressive Rendering**: Progressive rendering (showing partial results as they're calculated) is deferred for now. It would require refactoring `findContourPoints` to be async/chunked and using `requestAnimationFrame` to render incrementally. Estimated effort: 2-3 hours. The current caching implementation provides good performance for most use cases.

**Tests**:
- Test performance with simple implicit equations
- Test performance with complex implicit equations
- Test adaptive grid resolution works correctly
- Test progressive rendering improves perceived performance
- Verify no visual quality degradation from optimizations

**Commit**: `perf: optimize implicit plot evaluation and rendering`

---

### [x] Step 11.6: Add Implicit Plot Examples and Documentation
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

**Status**: ✅ **COMPLETE** - All steps completed (some optimizations deferred)

