# Implicit Plot Function API Design

## Function Signature

```python
plot_implicit(equation, x_min, x_max, y_min, y_max, color=None)
```

### Parameters

- **`equation`** (string or callable): Function of `x` and `y` that defines the implicit curve where f(x, y) = 0
  - String expression: `'x**2 + y**2 - 16'`, `'x**2/4 + y**2 - 1'`, `'x**2 - y**2 - 1'`
  - Callable function: `lambda x, y: x**2 + y**2 - 16`, `lambda x, y: x**2/4 + y**2 - 1`
  - The equation should evaluate to 0 at points on the curve
  - Positive values indicate one side of the curve, negative values indicate the other side

- **`x_min`** (number): Minimum x value for the search range
  - Must be a finite number
  - Must be less than `x_max`

- **`x_max`** (number): Maximum x value for the search range
  - Must be a finite number
  - Must be greater than `x_min`

- **`y_min`** (number): Minimum y value for the search range
  - Must be a finite number
  - Must be less than `y_max`

- **`y_max`** (number): Maximum y value for the search range
  - Must be a finite number
  - Must be greater than `y_min`

- **`color`** (string, optional): Color of the implicit curve
  - Default: `'#3b82f6'` (blue)
  - Format: Hex color string (e.g., `'#ff0000'`, `'#00ff00'`)

### Return Value

None (function stores plot data in frame state)

## Examples

### Circle
```python
plot_implicit('x**2 + y**2 - 16', -10, 10, -10, 10)
# or
plot_implicit(lambda x, y: x**2 + y**2 - 16, -10, 10, -10, 10)
```

### Ellipse
```python
plot_implicit('x**2/4 + y**2 - 1', -5, 5, -5, 5, color='#ff0000')
```

### Hyperbola
```python
plot_implicit('x**2 - y**2 - 1', -5, 5, -5, 5)
```

### Rose Curve (Polar-like)
```python
plot_implicit('x**2 + y**2 - 4*x*y', -5, 5, -5, 5)
```

### Multiple Curves
```python
# Circle
plot_implicit('x**2 + y**2 - 16', -10, 10, -10, 10, color='#ff0000')
# Ellipse
plot_implicit('x**2/4 + y**2 - 1', -5, 5, -5, 5, color='#00ff00')
```

## Contour Finding Algorithm: Marching Squares

The implicit plot uses the **Marching Squares** algorithm to find contour points where f(x, y) = 0.

### Algorithm Overview

1. **Grid Evaluation**: Create a 2D grid over the specified range (x_min to x_max, y_min to y_max)
2. **Sign Detection**: Evaluate the equation at each grid point and determine the sign (positive, negative, or zero)
3. **Contour Detection**: For each square cell in the grid:
   - Check the signs at the four corners
   - If signs differ (zero-crossing), the contour passes through this cell
   - Use linear interpolation to find the exact zero-crossing points along cell edges
4. **Contour Tracing**: Connect zero-crossing points to form continuous contour segments
5. **Multiple Contours**: Handle disconnected contours (e.g., multiple circles)

### Grid Resolution

- **Base Resolution**: Adaptive based on range size and zoom level
  - Formula: `max(50, min(500, round((x_max - x_min) * pixels_per_unit / 10)))`
  - Minimum: 50x50 grid
  - Maximum: 500x500 grid (to avoid performance issues)
- **Adaptive Refinement**: For cells containing zero-crossings:
  - Subdivide cells that contain contours
  - Use recursive subdivision up to a maximum depth (e.g., 3-4 levels)
  - This provides finer detail near contours while keeping performance reasonable

### Performance Considerations

- **Progressive Rendering**: For large grids, render contours progressively as they are found
- **Early Termination**: Skip cells that are clearly outside the contour (all corners have same sign)
- **Caching**: Cache equation evaluations where possible (especially for string expressions)
- **Optimization**: Use efficient data structures for contour tracing

### Edge Cases

- **No Contours**: If no zero-crossings are found, no curve is drawn
- **Disconnected Contours**: Multiple separate curves are handled (e.g., two circles)
- **Boundary Cases**: Contours that extend outside the search range are clipped
- **Singular Points**: Points where the equation is exactly zero are included in the contour

## Storage

Implicit plots are stored in frame state as `ImplicitPlot` objects:

```typescript
interface ImplicitPlot {
  id: string
  equation: string  // Expression or callable marker
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  color: string
  points?: Array<[number, number]>  // Contour points (x, y)
  numPoints?: number
  isProgressive?: boolean
  cacheKey?: string
}
```

## Rendering

- Implicit curves are rendered as continuous lines connecting contour points
- Multiple disconnected contours are drawn as separate line segments
- Contours can extend outside frame bounds (clipping handled during rendering)
- Multiple implicit plots per frame are supported
- Each contour segment is drawn independently

## Differences from Regular `plot()` and `plot_parametric()`

1. **Two Variables**: Requires both `x` and `y` in the equation (not just `y = f(x)`)
2. **Zero-Crossing**: Finds points where equation equals zero (not explicit function evaluation)
3. **2D Search**: Requires a 2D search range (x_min, x_max, y_min, y_max)
4. **Contour Finding**: Uses marching squares algorithm instead of direct evaluation
5. **Multiple Contours**: Can produce multiple disconnected curves from a single equation
6. **No Parameter**: Unlike parametric plots, there's no parameter `t` - the curve is defined implicitly

## Implementation Notes

- The marching squares algorithm is well-suited for this task
- Linear interpolation along cell edges provides smooth contours
- Adaptive grid refinement ensures quality without excessive computation
- Progressive rendering improves perceived performance for complex equations

