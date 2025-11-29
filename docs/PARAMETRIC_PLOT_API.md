# Parametric Plot Function API Design

## Function Signature

```python
plot_parametric(x_func, y_func, t_min, t_max, color=None)
```

### Parameters

- **`x_func`** (string or callable): Function of parameter `t` that defines the x-coordinate
  - String expression: `'sin(t)'`, `'t*cos(t)'`, `'2*t'`
  - Callable function: `lambda t: np.sin(t)`, `lambda t: t * np.cos(t)`
  - Variable name must be `t` (the parameter)

- **`y_func`** (string or callable): Function of parameter `t` that defines the y-coordinate
  - String expression: `'cos(t)'`, `'t*sin(t)'`, `'t**2'`
  - Callable function: `lambda t: np.cos(t)`, `lambda t: t * np.sin(t)`
  - Variable name must be `t` (the parameter)

- **`t_min`** (number): Minimum value of parameter `t`
  - Must be a finite number
  - Must be less than `t_max`

- **`t_max`** (number): Maximum value of parameter `t`
  - Must be a finite number
  - Must be greater than `t_min`

- **`color`** (string, optional): Color of the parametric curve
  - Default: `'#3b82f6'` (blue)
  - Format: Hex color string (e.g., `'#ff0000'`, `'#00ff00'`)

### Return Value

None (function stores plot data in frame state)

## Examples

### Circle
```python
plot_parametric('cos(t)', 'sin(t)', 0, 2*np.pi)
# or
plot_parametric(lambda t: np.cos(t), lambda t: np.sin(t), 0, 2*np.pi)
```

### Ellipse
```python
plot_parametric('2*cos(t)', 'sin(t)', 0, 2*np.pi, color='#ff0000')
```

### Spiral
```python
plot_parametric('t*cos(t)', 't*sin(t)', 0, 4*np.pi)
```

### Lissajous Curve
```python
plot_parametric('sin(3*t)', 'cos(2*t)', 0, 2*np.pi)
```

### Line Segment
```python
plot_parametric('t', '2*t + 1', 0, 5)
```

## Adaptive Sampling Strategy

Similar to regular `plot()` function:

1. **Initial Sampling**: Calculate optimal number of points based on parameter range
   - Formula: `max(200, min(2000, round((t_max - t_min) * 75)))`
   - Minimum: 200 points
   - Maximum: 2000 points
   - ~75 points per unit of parameter range

2. **Screen-Resolution Awareness**: Adjust sampling based on canvas size and zoom
   - Higher zoom = more points needed
   - Larger canvas = more points needed
   - Use `pixels_per_unit` to determine appropriate density

3. **Adaptive Refinement**: For callable functions, Python-side evaluation can:
   - Detect rapid changes in curve direction
   - Add more points in regions with high curvature
   - Reduce points in nearly straight segments

## Discontinuity Handling

Parametric curves can have discontinuities when:

1. **Infinite Values**: Either `x(t)` or `y(t)` becomes infinite
   - Example: `x = 1/t, y = 1/t` at `t = 0`

2. **NaN Values**: Either `x(t)` or `y(t)` becomes NaN
   - Example: `x = sqrt(t), y = sqrt(-t)` for negative `t`

3. **Rapid Jumps**: Large jumps in screen space between consecutive points
   - Similar to regular plot discontinuity detection
   - Break curve at discontinuities to avoid "tearing"

**Detection Strategy**:
- Check for `NaN` or `Infinity` in evaluated points
- Calculate screen-space distance between consecutive points
- If distance exceeds threshold (based on zoom level), break the curve
- Threshold: `max(1000, pixels_per_unit * 15)` pixels

## Evaluation Flow

1. **String Expressions**:
   - Store expressions as-is
   - Evaluation happens in Python during execution
   - Python generates points array `[[x1, y1], [x2, y2], ...]`

2. **Callable Functions**:
   - Try to extract string expression from lambda (similar to `plot()`)
   - If extraction fails, evaluate at points in Python
   - Python generates points array and passes to `plot_parametric_points()`

## Storage

Parametric plots are stored in frame state as `ParametricPlot` objects:

```typescript
interface ParametricPlot {
  id: string
  xFunc: string  // Expression or callable marker
  yFunc: string  // Expression or callable marker
  tMin: number
  tMax: number
  color: string
  points?: Array<[number, number]>  // Evaluated points (x, y)
  numPoints?: number
  isProgressive?: boolean
  cacheKey?: string
}
```

## Rendering

- Parametric curves are rendered as continuous lines/curves
- Points are connected in order (by parameter `t`)
- Discontinuities break the curve (no line drawn across breaks)
- Curves can extend outside frame bounds (clipping handled during rendering)
- Multiple parametric plots per frame are supported

## Differences from Regular `plot()`

1. **Two Functions**: Requires both `x_func` and `y_func` (not just `y = f(x)`)
2. **Parameter Range**: Uses `t_min` and `t_max` instead of `x_min` and `x_max`
3. **No Direct x-y Relationship**: x and y are independent functions of `t`
4. **Curve Ordering**: Points are ordered by parameter `t`, not by x-coordinate
5. **Potential Loops**: Parametric curves can form closed loops (e.g., circles)

