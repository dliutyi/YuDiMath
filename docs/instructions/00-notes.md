# Notes

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

## Extending These Instructions

**This is a living document.** As the project progresses:

- ✅ **After completing a step**: Mark it as complete with `[x]` and update any relevant notes in the phase files
- ✅ **When adding new features**: Add new steps following the same format and workflow to the appropriate phase file
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

---

**See [README.md](README.md) for the main instructions file with phase completion status.**

