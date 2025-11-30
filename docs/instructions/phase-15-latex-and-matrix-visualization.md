# Phase 15: LaTeX Formula Rendering and Matrix Visualization

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

---

### [ ] Step 15.1: Design LaTeX Formula Rendering API
**Task**: Design the API for rendering LaTeX formatted formulas at specific coordinates.

**Implementation**:
- Design function signature: `show_formula(formula, x, y, color?, size?)`
  - `formula`: LaTeX string expression - e.g., `r'\frac{a}{b}'`, `r'x^2 + y^2 = r^2'`
  - `x`, `y`: coordinates in frame coordinate system where formula should be displayed
  - `color`: optional color string (default: text primary color)
  - `size`: optional font size (default: 16px)
- Research LaTeX rendering libraries for browser (e.g., KaTeX, MathJax)
- Consider rendering approach (canvas text vs HTML overlay)
- Document expected behavior and LaTeX syntax support
- Consider coordinate system (formula position relative to frame or background)

**Tests**:
- Verify API design is clear and intuitive
- Verify LaTeX syntax examples work conceptually
- Verify coordinate positioning strategy is sound

**Commit**: `feat: design LaTeX formula rendering API`

---

### [ ] Step 15.2: Implement LaTeX Rendering Library Integration
**Task**: Integrate LaTeX rendering library (KaTeX or MathJax) into the application.

**Implementation**:
- Install and configure LaTeX rendering library (prefer KaTeX for performance)
- Add library to `public/index.html` or bundle with application
- Create LaTeX rendering utility function
- Support common LaTeX syntax (fractions, superscripts, subscripts, Greek letters, etc.)
- Handle rendering errors gracefully (invalid LaTeX syntax)
- Consider caching rendered formulas for performance

**Tests**:
- Test library loads correctly
- Test basic LaTeX rendering (simple formulas)
- Test complex LaTeX rendering (fractions, exponents, etc.)
- Test error handling for invalid LaTeX
- Test rendering performance

**Commit**: `feat: integrate LaTeX rendering library (KaTeX/MathJax)`

---

### [ ] Step 15.3: Implement show_formula Function Registration
**Task**: Register `show_formula` function in the Python function registry.

**Implementation**:
- Add `showFormulaImplementation` to appropriate module (e.g., `src/utils/pythonFormula.ts`)
- Register function as `'show_formula'` in function registry
- Validate parameters (formula, x, y, color, size)
- Store formula data in frame state
- Add `FormulaLabel` type to `src/types/index.ts`:
  ```typescript
  interface FormulaLabel {
    id: string
    formula: string  // LaTeX string
    x: number
    y: number
    color?: string
    size?: number
  }
  ```

**Tests**:
- Test function registration
- Test parameter validation
- Test formula storage in frame state
- Test function call storage

**Commit**: `feat: implement show_formula function registration`

---

### [ ] Step 15.4: Implement Formula Rendering in Frames
**Task**: Render LaTeX formulas at specified coordinates in frames.

**Implementation**:
- Add formula rendering to frame drawing logic
- Transform formula coordinates to frame coordinate system
- Render LaTeX formulas at specified positions
- Apply formula colors and sizes
- Support multiple formulas per frame
- Handle formulas that extend outside frame bounds
- Consider rendering approach:
  - Option 1: Render to canvas using library's canvas API
  - Option 2: Use HTML overlay with positioned elements (may require z-index management)
- Ensure formulas scale correctly with frame zoom

**Tests**:
- Test formula rendering at various coordinates
- Test formula transformation to frame coordinates
- Test multiple formulas rendering
- Test formula colors and sizes
- Test formulas outside bounds handling
- Test formula scaling with frame zoom

**Commit**: `feat: implement LaTeX formula rendering in frames`

---

### [ ] Step 15.5: Design Matrix Drawing Syntactic Sugar API
**Task**: Design a convenient API for drawing matrices visually.

**Implementation**:
- Design function signature: `draw_matrix(matrix, position, color?)`
  - `matrix`: numpy array or 2D list representing the matrix
  - `position`: tuple `(x, y)` indicating where to draw the matrix (top-left corner or center)
  - `color`: optional color string for matrix elements and brackets
- Alternative signature: `draw_matrix(matrix, x, y, color?)`
- Consider visual representation:
  - Draw matrix brackets (square brackets `[ ]` or parentheses `( )`)
  - Display matrix elements in a grid
  - Support both 2D and potentially 3D matrices (for future)
- Consider size and spacing:
  - Automatic sizing based on matrix dimensions
  - Configurable element spacing
  - Configurable bracket size
- Document expected behavior and examples

**Tests**:
- Verify API design is clear and intuitive
- Verify examples work conceptually
- Verify visual representation strategy is sound

**Commit**: `feat: design matrix drawing syntactic sugar API`

---

### [ ] Step 15.6: Implement draw_matrix Function Registration
**Task**: Register `draw_matrix` function in the Python function registry.

**Implementation**:
- Add `drawMatrixImplementation` to appropriate module (e.g., `src/utils/pythonMatrix.ts`)
- Register function as `'draw_matrix'` in function registry
- Validate parameters (matrix, position/x/y, color)
- Ensure matrix is 2D array (validate dimensions)
- Store matrix data in frame state
- Add `MatrixVisualization` type to `src/types/index.ts`:
  ```typescript
  interface MatrixVisualization {
    id: string
    matrix: number[][]  // 2D array of matrix elements
    x: number
    y: number
    color?: string
    elementSpacing?: number  // optional spacing between elements
    bracketSize?: number     // optional bracket size
  }
  ```

**Tests**:
- Test function registration
- Test parameter validation
- Test matrix dimension validation
- Test function call storage

**Commit**: `feat: implement draw_matrix function registration`

---

### [ ] Step 15.7: Implement Matrix Rendering in Frames
**Task**: Render matrices visually with brackets and elements in frames.

**Implementation**:
- Add matrix rendering to frame drawing logic
- Transform matrix position to frame coordinate system
- Draw matrix brackets (square brackets `[ ]`):
  - Calculate bracket size based on matrix dimensions
  - Draw left and right brackets
  - Position brackets correctly relative to matrix elements
- Draw matrix elements:
  - Calculate element positions in grid
  - Render each element as text (formatted numbers)
  - Apply element spacing
  - Format numbers appropriately (decimals, scientific notation)
- Apply matrix colors
- Support multiple matrices per frame
- Handle matrices that extend outside frame bounds
- Ensure matrices scale correctly with frame zoom

**Tests**:
- Test matrix rendering with various sizes (2x2, 3x3, 2x3, etc.)
- Test matrix transformation to frame coordinates
- Test multiple matrices rendering
- Test matrix colors
- Test matrices outside bounds handling
- Test matrix scaling with frame zoom
- Test bracket rendering accuracy
- Test element positioning and spacing

**Commit**: `feat: implement matrix visualization rendering in frames`

---

### [ ] Step 15.8: Add LaTeX and Matrix Examples and Documentation
**Task**: Add examples and update documentation for LaTeX formulas and matrix visualization.

**Implementation**:
- Add example LaTeX formulas to default code templates:
  - Simple formula: `show_formula(r'x^2 + y^2 = r^2', 0, 0)`
  - Fraction: `show_formula(r'\frac{a}{b}', 2, 2)`
  - Greek letters: `show_formula(r'\alpha + \beta = \gamma', -2, 2)`
  - Complex: `show_formula(r'\int_{0}^{1} x^2 dx = \frac{1}{3}', 0, -2)`
- Add example matrices to default code templates:
  - 2x2 matrix: `draw_matrix(np.array([[1, 2], [3, 4]]), 0, 0)`
  - 3x3 matrix: `draw_matrix(np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]]), 2, 2)`
  - Identity matrix: `draw_matrix(np.eye(3), -2, -2)`
- Update code generator to include LaTeX and matrix examples
- Document both functions in code comments
- Add examples to README (when created)

**Tests**:
- Test example LaTeX formulas render correctly
- Test example matrices render correctly
- Test code generation includes examples
- Verify examples are mathematically correct

**Commit**: `docs: add LaTeX formula and matrix visualization examples and documentation`

---

**Status**: ⏳ **NOT STARTED** - All steps pending

