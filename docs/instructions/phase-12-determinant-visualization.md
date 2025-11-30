# Phase 12: Determinant Visualization (Matrix Area Fill)

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

**Note**: This phase adds a function to visualize the geometric interpretation of a 2x2 matrix determinant by filling the parallelogram/rectangle formed by two vectors. The filled area represents the absolute value of the determinant.

---

### [x] Step 12.1: Design Determinant Fill Function API
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

### [x] Step 12.2: Implement Determinant Fill Function Registration
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

### [x] Step 12.3: Calculate Parallelogram Vertices
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

### [x] Step 12.4: Implement Determinant Fill Rendering
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

### [x] Step 12.5: Add Determinant Visualization Features
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

### [x] Step 12.6: Add Determinant Fill Examples and Documentation
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

**Status**: ✅ **COMPLETE** - All steps completed

