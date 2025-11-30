# Phase 5: Vector and Function Visualization

**See [00-introduction.md](00-introduction.md) for overview and development workflow.**

---

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

**Status**: ⚠️ **PARTIAL** - Steps 5.1-5.2 completed, Steps 5.3-5.4 skipped

