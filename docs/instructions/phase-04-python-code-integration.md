# Phase 4: Python Code Integration

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

---

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

**Status**: ✅ **COMPLETE** - All steps completed

