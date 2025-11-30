# Phase 10: Parametric Function Plotting

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

**Note**: This phase adds support for parametric functions where x and y are both functions of a parameter t (e.g., x = sin(t), y = cos(t) creates a circle).

---

### [x] Step 10.1: Design Parametric Plot Function API
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

### [x] Step 10.3: Implement Parametric Function Evaluation
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

### [x] Step 10.4: Implement Parametric Plot Rendering
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

### [x] Step 10.5: Add Parametric Plot Examples and Documentation
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

**Status**: ✅ **COMPLETE** - All steps completed

