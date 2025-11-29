import type { PythonFunctionCallback } from './pythonFunctions'
import { getRegisteredFunctionNames } from './pythonFunctionRegistry'
import { createPythonFunctionWrapper, updateCanvasInfoInPyodide } from './pythonContext'

export function injectFunctionsIntoPyodide(pyodide: any): void {
  // Create a Python module that exposes all registered functions
  const functionNames = getRegisteredFunctionNames()
  
  // Create JavaScript objects for each function
  const jsFunctions: Record<string, PythonFunctionCallback> = {}
  for (const name of functionNames) {
    jsFunctions[name] = createPythonFunctionWrapper(name)
  }

  try {
    // Use registerJsModule to make functions available as a Python module
    if (typeof pyodide.registerJsModule === 'function') {
      pyodide.registerJsModule('__yudimath_functions', jsFunctions)
      
      // Initialize canvas info with defaults
      updateCanvasInfoInPyodide(pyodide)
      
      // Create Python wrapper functions that handle keyword arguments properly
      // These wrappers convert keyword arguments to positional arguments for the JS functions
      // For plot(), we also handle callables by extracting their expression
      const pythonCode = `
# Inject predefined functions into global scope
import __yudimath_functions as _yudimath
import numpy as np

# Canvas information for screen-resolution-aware sampling (updated before each execution)
try:
    _canvas_width = __yudimath_canvas_width
    _canvas_height = __yudimath_canvas_height
    _pixels_per_unit = __yudimath_pixels_per_unit
    _is_slider_change = __yudimath_is_slider_change
except:
    # Fallback if not available
    _canvas_width = 1920
    _canvas_height = 1080
    _pixels_per_unit = 100
    _is_slider_change = False

# Wrapper for draw() that handles keyword arguments and numpy arrays
def draw(vector, color=None):
    # Convert numpy array to list if needed
    import numpy as np
    if isinstance(vector, np.ndarray):
        vector = vector.tolist()
    elif hasattr(vector, 'tolist'):
        vector = vector.tolist()
    
    if color is not None:
        return _yudimath.draw(vector, color)
    else:
        return _yudimath.draw(vector)

# Wrapper for plot() that handles keyword arguments and callables
def plot(formula, x_min=None, x_max=None, color=None):
    # Handle both positional and keyword arguments
    if x_min is None or x_max is None:
        raise ValueError("plot() requires x_min and x_max arguments")
    
    # If formula is callable, we need to evaluate it in Python and pass points
    # For now, try to extract expression, but if that fails, evaluate at points
    if callable(formula):
        import numpy as np
        # IMPORTANT: Save the original callable before any modifications
        original_callable = formula
        extracted_expression = None
        
        # Try to get source code first
        try:
            import inspect
            source = inspect.getsource(formula)
            print(f"[plot wrapper] Got source: {repr(source)}")
            # Extract the expression from lambda x: expression
            if 'lambda' in source:
                # Find the part after 'lambda' 
                lambda_part = source.split('lambda', 1)[1]
                # Remove variable name(s) and colon - handle cases like "lambda x:" or "lambda x, y:"
                if ':' in lambda_part:
                    expr = lambda_part.split(':', 1)[1].strip()
                    # Clean up: remove trailing commas, parentheses, whitespace, newlines
                    expr = expr.rstrip(',').rstrip(')').rstrip().strip()
                    # Remove any leading/trailing quotes
                    while (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
                        expr = expr[1:-1].strip()
                    # Remove newlines and extra whitespace
                    expr = ' '.join(expr.split())
                    extracted_expression = expr
                    print(f"[plot wrapper] Extracted expression: {repr(extracted_expression)}")
                    # Use extracted expression instead of callable
                    formula = extracted_expression
                else:
                    raise ValueError("Could not find ':' in lambda")
            else:
                raise ValueError("Not a lambda function")
        except Exception as e:
            print(f"[plot wrapper] Will evaluate callable at points: {e}")
            # Evaluate the function at many points and pass them directly
            # Use the original callable, not the potentially modified formula
            try:
                # For callable functions, we can't analyze the expression, so we must use dense sampling
                # to handle high-frequency functions. Use a conservative approach: always sample densely.
                x_range = x_max - x_min
                
                # Intelligent adaptive sampling - automatically determines optimal density
                # Algorithm: Start with moderate sampling, then recursively subdivide based on error
                
                pixels_covered = x_range * _pixels_per_unit
                
                # Initial sampling: adapt to zoom level
                # When zoomed in (high pixels_per_unit), we need more points to capture detail
                # CRITICAL: Use even more points per pixel when very zoomed in to ensure smooth curves
                # This ensures we capture all oscillations visible on screen
                # BUT: Use lighter sampling for slider changes to keep sliders smooth and live
                if _is_slider_change:
                    # Slider change - use MINIMAL sampling for maximum speed
                    # This keeps sliders smooth and responsive
                    # Use uniform sampling only - no adaptive refinement
                    points_per_pixel = 0.15  # Ultra-minimal - 0.15 points per pixel for maximum speed
                    initial_n = max(50, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 150)  # Very low cap for maximum speed
                elif _pixels_per_unit > 200:
                    # Extremely zoomed in - use extremely dense sampling
                    points_per_pixel = 8.0  # Increased from 5.0
                    initial_n = max(5000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 30000)  # Increased cap
                elif _pixels_per_unit > 100:
                    # Very zoomed in - use very dense sampling
                    points_per_pixel = 6.0  # Increased from 5.0
                    initial_n = max(3000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 25000)  # Increased cap
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    points_per_pixel = 5.0  # Increased from 4.5
                    initial_n = max(2000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 15000)  # Increased cap
                else:
                    # Normal zoom
                    points_per_pixel = 4.0
                    initial_n = max(1000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 6000)
                
                # Initialize
                points = []
                estimated_freq = 0.0
                max_slope = 0.0
                
                # Adaptive parameters - more aggressive when zoomed in
                # When zoomed in, we can see more detail, so use deeper recursion
                # But balance with performance - don't go too deep
                if _pixels_per_unit > 100:
                    # Very zoomed in - use very aggressive sampling
                    max_depth = 30  # Increased from 25
                    min_step = (x_max - x_min) / 100000000  # Even finer (100M divisions)
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    max_depth = 25
                    min_step = (x_max - x_min) / 50000000  # 50M divisions
                else:
                    max_depth = 22
                    min_step = (x_max - x_min) / 10000000  # Very fine
                
                # Pixel size in world coordinates - used to determine if we need more samples
                pixel_size_x = x_range / pixels_covered if pixels_covered > 0 else x_range / 1000
                
                # Memoization cache to avoid redundant function evaluations (major performance boost)
                eval_cache = {}
                cache_hits = 0
                cache_misses = 0
                
                def evaluate_with_cache(x):
                    """Evaluate function with memoization for performance"""
                    # Round to avoid floating point precision issues in cache
                    x_key = round(x, 12)
                    if x_key in eval_cache:
                        nonlocal cache_hits
                        cache_hits += 1
                        return eval_cache[x_key]
                    nonlocal cache_misses
                    cache_misses += 1
                    try:
                        y = float(original_callable(x))
                        if np.isfinite(y):
                            eval_cache[x_key] = y
                            return y
                        else:
                            eval_cache[x_key] = None
                            return None
                    except:
                        eval_cache[x_key] = None
                        return None
                
                def sample_adaptive(x1, x2, y1_val, depth):
                    """Recursively sample function, subdividing where it changes rapidly"""
                    # Base case: interval too small or max depth reached
                    if depth > max_depth or (x2 - x1) < min_step:
                        # Add midpoint if we don't have it yet
                        x = (x1 + x2) / 2
                        y = evaluate_with_cache(x)
                        if y is not None:
                            points.append([float(x), y])
                        return
                    
                    # If interval is smaller than a pixel, we're done (pixel-perfect)
                    # This prevents infinite recursion
                    if (x2 - x1) < pixel_size_x * 0.5:
                        return
                    
                    try:
                        # Evaluate at endpoints, midpoint, and quarter points for better derivative estimation
                        # Handle invalid points gracefully - don't skip entire intervals
                        # Use cached evaluation for performance
                        if y1_val is None:
                            y1_val = evaluate_with_cache(x1)
                        
                        y2 = evaluate_with_cache(x2)
                        
                        x_mid = (x1 + x2) / 2
                        y_mid = evaluate_with_cache(x_mid)
                        
                        # If all three points are invalid, try to subdivide anyway to find valid regions
                        if y1_val is None and y2 is None and y_mid is None:
                            # All invalid - subdivide to search for valid regions
                            sample_adaptive(x1, x_mid, None, depth + 1)
                            sample_adaptive(x_mid, x2, None, depth + 1)
                            return
                        
                        # If we have at least one valid point, continue with adaptive sampling
                        valid_points = [(x1, y1_val), (x_mid, y_mid), (x2, y2)]
                        valid_points = [(x, y) for x, y in valid_points if y is not None and np.isfinite(y)]
                        
                        if len(valid_points) < 2:
                            # Not enough valid points - subdivide to find more
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                            return
                        
                        # Evaluate at quarter points for better curvature estimation
                        x_q1 = (x1 + x_mid) / 2
                        x_q3 = (x_mid + x2) / 2
                        y_q1 = evaluate_with_cache(x_q1)
                        y_q3 = evaluate_with_cache(x_q3)
                        
                        # Calculate linear interpolation at midpoint (use available valid points)
                        if y1_val is not None and y2 is not None:
                            y_linear = (y1_val + y2) / 2
                        elif y1_val is not None and y_mid is not None:
                            y_linear = y_mid  # Use midpoint as approximation
                        elif y2 is not None and y_mid is not None:
                            y_linear = y_mid
                        else:
                            y_linear = y_mid if y_mid is not None else (y1_val if y1_val is not None else y2)
                        
                        # Estimate first derivative (slope) at endpoints
                        dx = x2 - x1
                        slope1 = 0
                        slope2 = 0
                        if y1_val is not None and y_mid is not None and (x_mid - x1) > 0:
                            slope1 = (y_mid - y1_val) / (x_mid - x1)
                        if y_mid is not None and y2 is not None and (x2 - x_mid) > 0:
                            slope2 = (y2 - y_mid) / (x2 - x_mid)
                        
                        # Estimate second derivative (curvature) if quarter points are available
                        curvature = 0
                        if y_q1 is not None and y_q3 is not None and np.isfinite(y_q1) and np.isfinite(y_q3):
                            slope_q1 = (y_mid - y_q1) / (x_mid - x_q1) if (x_mid - x_q1) > 0 else 0
                            slope_q3 = (y_q3 - y_mid) / (x_q3 - x_mid) if (x_q3 - x_mid) > 0 else 0
                            curvature = abs(slope_q3 - slope_q1) / (x_q3 - x_q1) if (x_q3 - x_q1) > 0 else 0
                        else:
                            # Fallback: estimate curvature from slope change
                            curvature = abs(slope2 - slope1) / dx if dx > 0 else 0
                        
                        # Calculate error metric: combination of deviation from linear and curvature
                        # Use only valid y values for max_y calculation
                        valid_y_values = [abs(y) for y in [y1_val, y2, y_mid] if y is not None and np.isfinite(y)]
                        max_y = max(valid_y_values) if valid_y_values else 1
                        
                        # Calculate linear error only if we have valid midpoint
                        if y_mid is not None and np.isfinite(y_mid) and y_linear is not None:
                            linear_error = abs(y_mid - y_linear) / (max_y + 1)
                        else:
                            # If midpoint is invalid but endpoints are valid, assume high error (discontinuity)
                            linear_error = 1.0 if (y1_val is not None and y2 is not None) else 0.0
                        
                        # Normalize curvature by function scale and x-range
                        normalized_curvature = curvature * dx * dx / (max_y + 1) if max_y > 0 else 0
                        
                        # Combined error metric: linear error + curvature contribution
                        # Curvature is weighted less since it's a second-order effect
                        combined_error = linear_error + normalized_curvature * 0.3
                        
                        # Aggressive error detection for high-quality rendering
                        # Prioritize quality for high-frequency functions
                        # ADAPTIVE THRESHOLDS: More sensitive when zoomed in (higher pixels_per_unit)
                        # When zoomed in, smaller errors become visible, so use lower thresholds
                        should_subdivide = False
                        
                        # Adaptive thresholds based on zoom level
                        # Higher pixels_per_unit = more zoomed in = need more sensitive thresholds
                        # Use much less sensitive thresholds for slider changes to speed things up
                        if _is_slider_change:
                            # Slider change - use much less sensitive thresholds for speed
                            error_threshold = 0.005  # 0.5% error threshold (much less sensitive)
                            slope_threshold = 200  # Much higher slope change threshold
                        elif _pixels_per_unit > 100:
                            # Very zoomed in - extremely sensitive
                            error_threshold = 0.0001  # 0.01% error threshold
                            slope_threshold = 20  # Lower slope change threshold
                        elif _pixels_per_unit > 50:
                            # Moderately zoomed in - very sensitive
                            error_threshold = 0.0002  # 0.02% error threshold
                            slope_threshold = 30
                        else:
                            # Normal zoom - standard sensitivity
                            error_threshold = 0.0005  # 0.05% error threshold
                            slope_threshold = 50
                        
                        if y1_val is not None and y2 is not None and y_mid is not None:
                            # Linear interpolation error check
                            y_linear = (y1_val + y2) / 2
                            error = abs(y_mid - y_linear)
                            y_magnitude = max(abs(y1_val), abs(y2), abs(y_mid), 1)
                            
                            # Normalized error - use adaptive threshold based on zoom
                            normalized_error = error / y_magnitude if y_magnitude > 0 else 0
                            should_subdivide = normalized_error > error_threshold
                            
                            # Also check for rapid slope change (indicates high frequency)
                            if not should_subdivide:
                                slope1 = (y_mid - y1_val) / (x_mid - x1) if (x_mid - x1) > 0 else 0
                                slope2 = (y2 - y_mid) / (x2 - x_mid) if (x2 - x_mid) > 0 else 0
                                slope_change = abs(slope2 - slope1)
                                # If slope changes significantly, subdivide (adaptive threshold)
                                if slope_change > slope_threshold:
                                    should_subdivide = True
                        else:
                            should_subdivide = True  # Always subdivide around discontinuities
                        
                        # Detect discontinuities - critical for functions like 1/tan(exp(x))
                        has_discontinuity = (y1_val is None) != (y2 is None) or (y_mid is None and (y1_val is not None or y2 is not None))
                        if has_discontinuity:
                            should_subdivide = True
                        
                        if should_subdivide:
                            # Function changes rapidly, has high curvature, or has discontinuities - subdivide
                            # Add valid points
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                            
                            # Add quarter points if they're valid
                            if y_q1 is not None and np.isfinite(y_q1):
                                points.append([float(x_q1), float(y_q1)])
                            if y_q3 is not None and np.isfinite(y_q3):
                                points.append([float(x_q3), float(y_q3)])
                            
                            # Recursively subdivide both halves
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                        else:
                            # Function is smooth - just add midpoint if valid
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                    except:
                        # If evaluation fails, try to subdivide anyway
                        x_mid = (x1 + x2) / 2
                        sample_adaptive(x1, x_mid, y1_val, depth + 1)
                        sample_adaptive(x_mid, x2, None, depth + 1)
                
                # Pixel-perfect initial sampling: one point per screen pixel column
                x_samples = np.linspace(x_min, x_max, initial_n)
                
                # For sliders, use ultra-fast path - minimal overhead
                if _is_slider_change:
                    # Ultra-fast path for sliders - no tracking, no logging, direct evaluation
                    # Skip caching overhead - direct evaluation is faster for small point counts
                    for x in x_samples:
                        try:
                            y = float(original_callable(x))
                            if np.isfinite(y):
                                points.append([float(x), y])
                        except:
                            pass  # Skip invalid points silently
                    # Immediate return for sliders - no adaptive sampling, no logging
                    # linspace is already sorted, so skip sort if possible
                    if len(points) > 0:
                        if len(points) > 1 and points[0][0] > points[-1][0]:
                            points.sort(key=lambda p: p[0])
                        points_list = [[float(p[0]), float(p[1])] for p in points]
                        return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                    else:
                        return _yudimath.plot_points([], x_min, x_max, color if color is not None else None)
                
                # Full path for non-slider executions
                initial_points = []
                valid_count = 0
                error_count = 0
                
                # First pass: batch evaluate all points using cached evaluation
                for x in x_samples:
                    y = evaluate_with_cache(x)
                    if y is not None:
                        points.append([float(x), y])
                        initial_points.append((x, y))
                        valid_count += 1
                    else:
                        initial_points.append((x, None))
                        error_count += 1
                
                print(f"[plot wrapper] Initial pixel-perfect sampling: {valid_count} valid, {error_count} errors out of {initial_n} points")
                print(f"[plot wrapper] Cache stats: {cache_hits} hits, {cache_misses} misses (hit rate: {cache_hits/(cache_hits+cache_misses)*100:.1f}%)" if (cache_hits + cache_misses) > 0 else "[plot wrapper] Cache stats: no evaluations yet")
                
                # If we got very few valid points, try fallback
                if valid_count < 2:
                    print(f"[plot wrapper] Only {valid_count} valid points found, trying fallback")
                    if len(points) > 0:
                        points.sort(key=lambda p: p[0])
                        points_list = [[float(p[0]), float(p[1])] for p in points]
                        return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                
                # Second pass: adaptive refinement between consecutive pixel samples
                # This ensures we capture all oscillations and discontinuities
                # Only for non-slider executions
                    # Only do second pass refinement for non-slider executions
                    # CRITICAL: When zoomed in, we need to be more aggressive with refinement
                    for i in range(len(initial_points) - 1):
                        x1, y1_val = initial_points[i]
                        x2, y2_val = initial_points[i + 1]
                        
                        # Calculate gap size in world coordinates
                        x_diff = x2 - x1
                        
                        # Always refine between pixel samples to catch rapid changes
                        # But be more aggressive when zoomed in (higher pixels_per_unit)
                        if _pixels_per_unit > 200:
                            # Extremely zoomed in - refine ALL gaps, no matter how small
                            sample_adaptive(x1, x2, y1_val, 0)
                        elif _pixels_per_unit > 100:
                            # Very zoomed in - refine even tiny gaps
                            if x_diff > pixel_size_x * 0.05:  # Refine if gap > 0.05 pixels (very small)
                                sample_adaptive(x1, x2, y1_val, 0)
                        elif _pixels_per_unit > 50:
                            # Moderately zoomed in
                            if x_diff > pixel_size_x * 0.2:  # Refine if gap > 0.2 pixels
                                sample_adaptive(x1, x2, y1_val, 0)
                        else:
                            # Normal zoom - refine if gap is significant
                            if x_diff > pixel_size_x * 1.0:  # Refine if gap > 1.0 pixels
                                sample_adaptive(x1, x2, y1_val, 0)
                
                # Sort points by x coordinate (adaptive sampling may add points out of order)
                points.sort(key=lambda p: p[0])
                
                print(f"[plot wrapper] Evaluated {len(points)} points from callable function")
                
                # Fallback: if no points were collected, try simple uniform sampling
                if len(points) == 0:
                    print(f"[plot wrapper] No points collected, trying fallback uniform sampling")
                    # Try a simpler approach: just evaluate at evenly spaced points
                    # Use a denser grid for fallback to increase chances of finding valid points
                    fallback_points = []
                    fallback_n = max(200, min(500, initial_n * 2))  # Use more points for fallback
                    error_count = 0
                    success_count = 0
                    last_error = None
                    last_success_x = None
                    
                    # Try with a denser grid
                    for x in np.linspace(x_min, x_max, fallback_n):
                        try:
                            y = float(original_callable(x))
                            if np.isfinite(y):
                                fallback_points.append([float(x), y])
                                success_count += 1
                                last_success_x = x
                            else:
                                error_count += 1
                        except ZeroDivisionError as e:
                            error_count += 1
                            last_error = f"ZeroDivisionError: {str(e)}"
                            continue
                        except (ValueError, OverflowError, TypeError) as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            continue
                        except Exception as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            # Only print first few errors to avoid spam
                            if error_count <= 3:
                                print(f"[plot wrapper] Fallback: Error at x={x}: {e}")
                            continue
                    
                    if len(fallback_points) > 0:
                        points = fallback_points
                        print(f"[plot wrapper] Fallback collected {len(points)} points (had {error_count} errors, last success at x={last_success_x})")
                    else:
                        # Try one more time with even denser sampling
                        print(f"[plot wrapper] Fallback failed, trying ultra-dense sampling")
                        ultra_dense_points = []
                        # Use very dense sampling for difficult functions
                        ultra_n = 5000  # Very dense
                        for x in np.linspace(x_min, x_max, ultra_n):
                            try:
                                y = float(original_callable(x))
                                if np.isfinite(y):
                                    ultra_dense_points.append([float(x), y])
                            except:
                                continue
                        
                        if len(ultra_dense_points) > 0:
                            points = ultra_dense_points
                            print(f"[plot wrapper] Ultra-dense sampling collected {len(points)} points")
                        else:
                            error_msg = f"plot() could not evaluate callable function at any points in range [{x_min}, {x_max}]"
                            if last_error:
                                error_msg += f". Last error: {last_error}"
                            error_msg += f". Tried {fallback_n} and {ultra_n} points."
                            raise ValueError(error_msg)
                
                # Convert points to a JavaScript-compatible format (list of lists)
                # Pyodide will handle the conversion, but we ensure it's a plain Python list
                points_list = [[float(p[0]), float(p[1])] for p in points]
                
                # Pass points directly to JavaScript - use plot_points function
                return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                    
            except Exception as e2:
                print(f"[plot wrapper] Point evaluation failed: {e2}")
                raise ValueError(f"plot() could not evaluate callable function. Error: {str(e2)}")
    
    # Call the underlying JavaScript function with all arguments
    # Use extracted expression if available, otherwise use original formula
    formula_to_use = extracted_expression if 'extracted_expression' in locals() and extracted_expression is not None else formula
    if color is not None:
        return _yudimath.plot(formula_to_use, x_min, x_max, color)
    else:
        return _yudimath.plot(formula_to_use, x_min, x_max)

# Wrapper for plot_parametric() that handles keyword arguments and callables
def plot_parametric(x_func, y_func, t_min=None, t_max=None, color=None):
    # Handle both positional and keyword arguments
    if t_min is None or t_max is None:
        raise ValueError("plot_parametric() requires t_min and t_max arguments")
    
    # Check if x_func or y_func are callables
    x_is_callable = callable(x_func)
    y_is_callable = callable(y_func)
    
    # If both are strings, pass through to JavaScript
    if not x_is_callable and not y_is_callable:
        if color is not None:
            return _yudimath.plot_parametric(x_func, y_func, t_min, t_max, color)
        else:
            return _yudimath.plot_parametric(x_func, y_func, t_min, t_max)
    
    # If either is callable, we need to evaluate in Python
    # Save original callables
    original_x_func = x_func if x_is_callable else None
    original_y_func = y_func if y_is_callable else None
    
    # Try to extract expressions from callables (similar to plot())
    x_func_string = None
    y_func_string = None
    
    if x_is_callable:
        try:
            import inspect
            source = inspect.getsource(x_func)
            if 'lambda' in source:
                lambda_part = source.split('lambda', 1)[1]
                if ':' in lambda_part:
                    expr = lambda_part.split(':', 1)[1].strip()
                    expr = expr.rstrip(',').rstrip(')').rstrip().strip()
                    while (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
                        expr = expr[1:-1].strip()
                    expr = ' '.join(expr.split())
                    x_func_string = expr
                    x_func = expr  # Use extracted expression
        except:
            pass  # Will evaluate at points
    
    if y_is_callable:
        try:
            import inspect
            source = inspect.getsource(y_func)
            if 'lambda' in source:
                lambda_part = source.split('lambda', 1)[1]
                if ':' in lambda_part:
                    expr = lambda_part.split(':', 1)[1].strip()
                    expr = expr.rstrip(',').rstrip(')').rstrip().strip()
                    while (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
                        expr = expr[1:-1].strip()
                    expr = ' '.join(expr.split())
                    y_func_string = expr
                    y_func = expr  # Use extracted expression
        except:
            pass  # Will evaluate at points
    
    # If we successfully extracted both expressions, use them
    if x_func_string is not None and y_func_string is not None:
        if color is not None:
            return _yudimath.plot_parametric(x_func_string, y_func_string, t_min, t_max, color)
        else:
            return _yudimath.plot_parametric(x_func_string, y_func_string, t_min, t_max)
    
    # Otherwise, evaluate callables at points
    # Use adaptive sampling similar to plot()
    try:
        import numpy as np
        t_range = t_max - t_min
        
        # First, estimate coordinate range by sampling multiple points across the range
        # This helps determine if we need more points for large coordinate values
        # Sample more points to better catch the maximum coordinate value
        estimated_max_coord = 1.0
        try:
            # Sample 20 points across the range for better estimation
            num_samples = 20
            sample_t = np.linspace(t_min, t_max, num_samples)
            for t_val in sample_t:
                try:
                    if x_is_callable and original_x_func is not None:
                        x_val = float(original_x_func(t_val))
                    else:
                        x_val = float(eval(x_func, {'t': t_val, 'np': np, 'math': __import__('math'), 'sin': np.sin, 'cos': np.cos, 'tan': np.tan, 'exp': np.exp, 'log': np.log, 'sqrt': np.sqrt, 'abs': abs}))
                    if y_is_callable and original_y_func is not None:
                        y_val = float(original_y_func(t_val))
                    else:
                        y_val = float(eval(y_func, {'t': t_val, 'np': np, 'math': __import__('math'), 'sin': np.sin, 'cos': np.cos, 'tan': np.tan, 'exp': np.exp, 'log': np.log, 'sqrt': np.sqrt, 'abs': abs}))
                    if np.isfinite(x_val) and np.isfinite(y_val):
                        estimated_max_coord = max(estimated_max_coord, abs(x_val), abs(y_val))
                except:
                    pass
        except:
            pass  # If sampling fails, use default
        
        # More aggressive scaling: use square root to avoid excessive points but still scale up
        # For coordinates around 100, this gives ~3x scaling instead of 10x
        # This balances quality and performance better
        if estimated_max_coord > 10:
            coordinate_scale = 1.0 + (estimated_max_coord - 10.0) / 30.0  # Linear scaling above 10
            coordinate_scale = min(coordinate_scale, 10.0)  # Cap at 10x to avoid excessive points
        else:
            coordinate_scale = 1.0
        
        # Calculate optimal number of points based on range, zoom, AND coordinate scale
        pixels_covered = t_range * _pixels_per_unit
        
        # Initial sampling: adapt to zoom level and coordinate scale
        if _is_slider_change:
            # Slider change - use minimal sampling
            points_per_pixel = 0.15
            initial_n = max(50, int(pixels_covered * points_per_pixel * coordinate_scale))
            initial_n = min(initial_n, 150)
        elif _pixels_per_unit > 200:
            points_per_pixel = 8.0
            initial_n = max(5000, int(pixels_covered * points_per_pixel * coordinate_scale))
            initial_n = min(initial_n, 30000)
        elif _pixels_per_unit > 100:
            points_per_pixel = 6.0
            initial_n = max(3000, int(pixels_covered * points_per_pixel * coordinate_scale))
            initial_n = min(initial_n, 25000)
        elif _pixels_per_unit > 50:
            points_per_pixel = 5.0
            initial_n = max(2000, int(pixels_covered * points_per_pixel * coordinate_scale))
            initial_n = min(initial_n, 15000)
        else:
            points_per_pixel = 4.0
            initial_n = max(1000, int(pixels_covered * points_per_pixel * coordinate_scale))
            initial_n = min(initial_n, 6000)
        
        # Evaluate functions at t values
        points = []
        t_samples = np.linspace(t_min, t_max, initial_n)
        
        # Memoization cache for function evaluations
        eval_cache_x = {}
        eval_cache_y = {}
        
        def evaluate_x_with_cache(t):
            t_key = round(t, 12)
            if t_key in eval_cache_x:
                return eval_cache_x[t_key]
            try:
                if x_is_callable and original_x_func is not None:
                    val = float(original_x_func(t))
                else:
                    # String expression - evaluate using eval (with t in namespace)
                    val = float(eval(x_func, {'t': t, 'np': np, 'math': __import__('math'), 'sin': np.sin, 'cos': np.cos, 'tan': np.tan, 'exp': np.exp, 'log': np.log, 'sqrt': np.sqrt, 'abs': abs}))
                if np.isfinite(val):
                    eval_cache_x[t_key] = val
                    return val
                else:
                    eval_cache_x[t_key] = None
                    return None
            except:
                eval_cache_x[t_key] = None
                return None
        
        def evaluate_y_with_cache(t):
            t_key = round(t, 12)
            if t_key in eval_cache_y:
                return eval_cache_y[t_key]
            try:
                if y_is_callable and original_y_func is not None:
                    val = float(original_y_func(t))
                else:
                    # String expression - evaluate using eval (with t in namespace)
                    val = float(eval(y_func, {'t': t, 'np': np, 'math': __import__('math'), 'sin': np.sin, 'cos': np.cos, 'tan': np.tan, 'exp': np.exp, 'log': np.log, 'sqrt': np.sqrt, 'abs': abs}))
                if np.isfinite(val):
                    eval_cache_y[t_key] = val
                    return val
                else:
                    eval_cache_y[t_key] = None
                    return None
            except:
                eval_cache_y[t_key] = None
                return None
        
        # Evaluate at all t samples
        for t in t_samples:
            x_val = evaluate_x_with_cache(t)
            y_val = evaluate_y_with_cache(t)
            if x_val is not None and y_val is not None:
                points.append([float(x_val), float(y_val)])
        
        if len(points) == 0:
            raise ValueError(f"plot_parametric() could not evaluate functions at any points in range [{t_min}, {t_max}]")
        
        # Sort points by t (they should already be sorted, but ensure it)
        # Note: For parametric plots, we don't sort by x or y - we keep t order
        
        # Convert to JavaScript-compatible format
        points_list = [[float(p[0]), float(p[1])] for p in points]
        
        # Pass points to JavaScript
        if color is not None:
            return _yudimath.plot_parametric_points(points_list, t_min, t_max, color)
        else:
            return _yudimath.plot_parametric_points(points_list, t_min, t_max)
            
    except Exception as e:
        print(f"[plot_parametric wrapper] Evaluation failed: {e}")
        raise ValueError(f"plot_parametric() could not evaluate functions. Error: {str(e)}")
`
      pyodide.runPython(pythonCode)
      console.log('[pythonFunctions] Functions injected via registerJsModule with keyword argument support:', functionNames)
    } else {
      // Fallback: directly set functions in global scope
      // Create Python wrappers that handle keyword arguments
      const pythonCode = `
import numpy as np

# Wrapper for draw() that handles keyword arguments and numpy arrays
def draw(vector, color=None):
    # Convert numpy array to list if needed
    import numpy as np
    if isinstance(vector, np.ndarray):
        vector = vector.tolist()
    elif hasattr(vector, 'tolist'):
        vector = vector.tolist()
    
    if color is not None:
        return __yudimath_draw(vector, color)
    else:
        return __yudimath_draw(vector)

# Wrapper for plot() that handles keyword arguments and callables
def plot(formula, x_min=None, x_max=None, color=None):
    if x_min is None or x_max is None:
        raise ValueError("plot() requires x_min and x_max arguments")
    
    # If formula is callable, we need to evaluate it in Python and pass points
    # For now, try to extract expression, but if that fails, evaluate at points
    if callable(formula):
        import numpy as np
        # IMPORTANT: Save the original callable before any modifications
        original_callable = formula
        extracted_expression = None
        
        # Try to get source code first
        try:
            import inspect
            source = inspect.getsource(formula)
            print(f"[plot wrapper] Got source: {repr(source)}")
            # Extract the expression from lambda x: expression
            if 'lambda' in source:
                # Find the part after 'lambda' 
                lambda_part = source.split('lambda', 1)[1]
                # Remove variable name(s) and colon - handle cases like "lambda x:" or "lambda x, y:"
                if ':' in lambda_part:
                    expr = lambda_part.split(':', 1)[1].strip()
                    # Clean up: remove trailing commas, parentheses, whitespace, newlines
                    expr = expr.rstrip(',').rstrip(')').rstrip().strip()
                    # Remove any leading/trailing quotes
                    while (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
                        expr = expr[1:-1].strip()
                    # Remove newlines and extra whitespace
                    expr = ' '.join(expr.split())
                    extracted_expression = expr
                    print(f"[plot wrapper] Extracted expression: {repr(extracted_expression)}")
                    # Use extracted expression instead of callable
                    formula = extracted_expression
                else:
                    raise ValueError("Could not find ':' in lambda")
            else:
                raise ValueError("Not a lambda function")
        except Exception as e:
            print(f"[plot wrapper] Will evaluate callable at points: {e}")
            # Evaluate the function at many points and pass them directly
            # Use the original callable, not the potentially modified formula
            try:
                # For callable functions, we can't analyze the expression, so we must use dense sampling
                # to handle high-frequency functions. Use a conservative approach: always sample densely.
                x_range = x_max - x_min
                
                # Intelligent adaptive sampling - automatically determines optimal density
                # Algorithm: Start with moderate sampling, then recursively subdivide based on error
                
                pixels_covered = x_range * _pixels_per_unit
                
                # Initial sampling: adapt to zoom level
                # When zoomed in (high pixels_per_unit), we need more points to capture detail
                # CRITICAL: Use even more points per pixel when very zoomed in to ensure smooth curves
                # This ensures we capture all oscillations visible on screen
                # BUT: Use lighter sampling for slider changes to keep sliders smooth and live
                if _is_slider_change:
                    # Slider change - use MINIMAL sampling for maximum speed
                    # This keeps sliders smooth and responsive
                    # Use uniform sampling only - no adaptive refinement
                    points_per_pixel = 0.15  # Ultra-minimal - 0.15 points per pixel for maximum speed
                    initial_n = max(50, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 150)  # Very low cap for maximum speed
                elif _pixels_per_unit > 200:
                    # Extremely zoomed in - use extremely dense sampling
                    points_per_pixel = 8.0  # Increased from 5.0
                    initial_n = max(5000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 30000)  # Increased cap
                elif _pixels_per_unit > 100:
                    # Very zoomed in - use very dense sampling
                    points_per_pixel = 6.0  # Increased from 5.0
                    initial_n = max(3000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 25000)  # Increased cap
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    points_per_pixel = 5.0  # Increased from 4.5
                    initial_n = max(2000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 15000)  # Increased cap
                else:
                    # Normal zoom
                    points_per_pixel = 4.0
                    initial_n = max(1000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 6000)
                
                # Initialize
                points = []
                estimated_freq = 0.0
                max_slope = 0.0
                
                # Adaptive parameters - more aggressive when zoomed in
                # When zoomed in, we can see more detail, so use deeper recursion
                # But balance with performance - don't go too deep
                if _pixels_per_unit > 100:
                    # Very zoomed in - use very aggressive sampling
                    max_depth = 30  # Increased from 25
                    min_step = (x_max - x_min) / 100000000  # Even finer (100M divisions)
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    max_depth = 25
                    min_step = (x_max - x_min) / 50000000  # 50M divisions
                else:
                    max_depth = 22
                    min_step = (x_max - x_min) / 10000000  # Very fine
                
                # Pixel size in world coordinates - used to determine if we need more samples
                pixel_size_x = x_range / pixels_covered if pixels_covered > 0 else x_range / 1000
                
                # Memoization cache to avoid redundant function evaluations (major performance boost)
                eval_cache = {}
                cache_hits = 0
                cache_misses = 0
                
                def evaluate_with_cache(x):
                    """Evaluate function with memoization for performance"""
                    # Round to avoid floating point precision issues in cache
                    x_key = round(x, 12)
                    if x_key in eval_cache:
                        nonlocal cache_hits
                        cache_hits += 1
                        return eval_cache[x_key]
                    nonlocal cache_misses
                    cache_misses += 1
                    try:
                        y = float(original_callable(x))
                        if np.isfinite(y):
                            eval_cache[x_key] = y
                            return y
                        else:
                            eval_cache[x_key] = None
                            return None
                    except:
                        eval_cache[x_key] = None
                        return None
                
                def sample_adaptive(x1, x2, y1_val, depth):
                    """Recursively sample function, subdividing where it changes rapidly"""
                    # Base case: interval too small or max depth reached
                    if depth > max_depth or (x2 - x1) < min_step:
                        # Add midpoint if we don't have it yet
                        x = (x1 + x2) / 2
                        y = evaluate_with_cache(x)
                        if y is not None:
                            points.append([float(x), y])
                        return
                    
                    # If interval is smaller than a pixel, we're done (pixel-perfect)
                    # This prevents infinite recursion
                    if (x2 - x1) < pixel_size_x * 0.5:
                        return
                    
                    try:
                        # Evaluate at endpoints, midpoint, and quarter points for better derivative estimation
                        # Handle invalid points gracefully - don't skip entire intervals
                        # Use cached evaluation for performance
                        if y1_val is None:
                            y1_val = evaluate_with_cache(x1)
                        
                        y2 = evaluate_with_cache(x2)
                        
                        x_mid = (x1 + x2) / 2
                        y_mid = evaluate_with_cache(x_mid)
                        
                        # If all three points are invalid, try to subdivide anyway to find valid regions
                        if y1_val is None and y2 is None and y_mid is None:
                            # All invalid - subdivide to search for valid regions
                            sample_adaptive(x1, x_mid, None, depth + 1)
                            sample_adaptive(x_mid, x2, None, depth + 1)
                            return
                        
                        # If we have at least one valid point, continue with adaptive sampling
                        valid_points = [(x1, y1_val), (x_mid, y_mid), (x2, y2)]
                        valid_points = [(x, y) for x, y in valid_points if y is not None and np.isfinite(y)]
                        
                        if len(valid_points) < 2:
                            # Not enough valid points - subdivide to find more
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                            return
                        
                        # Evaluate at quarter points for better curvature estimation
                        x_q1 = (x1 + x_mid) / 2
                        x_q3 = (x_mid + x2) / 2
                        y_q1 = evaluate_with_cache(x_q1)
                        y_q3 = evaluate_with_cache(x_q3)
                        
                        # Calculate linear interpolation at midpoint (use available valid points)
                        if y1_val is not None and y2 is not None:
                            y_linear = (y1_val + y2) / 2
                        elif y1_val is not None and y_mid is not None:
                            y_linear = y_mid  # Use midpoint as approximation
                        elif y2 is not None and y_mid is not None:
                            y_linear = y_mid
                        else:
                            y_linear = y_mid if y_mid is not None else (y1_val if y1_val is not None else y2)
                        
                        # Estimate first derivative (slope) at endpoints
                        dx = x2 - x1
                        slope1 = 0
                        slope2 = 0
                        if y1_val is not None and y_mid is not None and (x_mid - x1) > 0:
                            slope1 = (y_mid - y1_val) / (x_mid - x1)
                        if y_mid is not None and y2 is not None and (x2 - x_mid) > 0:
                            slope2 = (y2 - y_mid) / (x2 - x_mid)
                        
                        # Estimate second derivative (curvature) if quarter points are available
                        curvature = 0
                        if y_q1 is not None and y_q3 is not None and np.isfinite(y_q1) and np.isfinite(y_q3):
                            slope_q1 = (y_mid - y_q1) / (x_mid - x_q1) if (x_mid - x_q1) > 0 else 0
                            slope_q3 = (y_q3 - y_mid) / (x_q3 - x_mid) if (x_q3 - x_mid) > 0 else 0
                            curvature = abs(slope_q3 - slope_q1) / (x_q3 - x_q1) if (x_q3 - x_q1) > 0 else 0
                        else:
                            # Fallback: estimate curvature from slope change
                            curvature = abs(slope2 - slope1) / dx if dx > 0 else 0
                        
                        # Calculate error metric: combination of deviation from linear and curvature
                        # Use only valid y values for max_y calculation
                        valid_y_values = [abs(y) for y in [y1_val, y2, y_mid] if y is not None and np.isfinite(y)]
                        max_y = max(valid_y_values) if valid_y_values else 1
                        
                        # Calculate linear error only if we have valid midpoint
                        if y_mid is not None and np.isfinite(y_mid) and y_linear is not None:
                            linear_error = abs(y_mid - y_linear) / (max_y + 1)
                        else:
                            # If midpoint is invalid but endpoints are valid, assume high error (discontinuity)
                            linear_error = 1.0 if (y1_val is not None and y2 is not None) else 0.0
                        
                        # Normalize curvature by function scale and x-range
                        normalized_curvature = curvature * dx * dx / (max_y + 1) if max_y > 0 else 0
                        
                        # Combined error metric: linear error + curvature contribution
                        # Curvature is weighted less since it's a second-order effect
                        combined_error = linear_error + normalized_curvature * 0.3
                        
                        # Aggressive error detection for high-quality rendering
                        # Prioritize quality for high-frequency functions
                        # ADAPTIVE THRESHOLDS: More sensitive when zoomed in (higher pixels_per_unit)
                        # When zoomed in, smaller errors become visible, so use lower thresholds
                        should_subdivide = False
                        
                        # Adaptive thresholds based on zoom level
                        # Higher pixels_per_unit = more zoomed in = need more sensitive thresholds
                        # Use much less sensitive thresholds for slider changes to speed things up
                        if _is_slider_change:
                            # Slider change - use much less sensitive thresholds for speed
                            error_threshold = 0.005  # 0.5% error threshold (much less sensitive)
                            slope_threshold = 200  # Much higher slope change threshold
                        elif _pixels_per_unit > 100:
                            # Very zoomed in - extremely sensitive
                            error_threshold = 0.0001  # 0.01% error threshold
                            slope_threshold = 20  # Lower slope change threshold
                        elif _pixels_per_unit > 50:
                            # Moderately zoomed in - very sensitive
                            error_threshold = 0.0002  # 0.02% error threshold
                            slope_threshold = 30
                        else:
                            # Normal zoom - standard sensitivity
                            error_threshold = 0.0005  # 0.05% error threshold
                            slope_threshold = 50
                        
                        if y1_val is not None and y2 is not None and y_mid is not None:
                            # Linear interpolation error check
                            y_linear = (y1_val + y2) / 2
                            error = abs(y_mid - y_linear)
                            y_magnitude = max(abs(y1_val), abs(y2), abs(y_mid), 1)
                            
                            # Normalized error - use adaptive threshold based on zoom
                            normalized_error = error / y_magnitude if y_magnitude > 0 else 0
                            should_subdivide = normalized_error > error_threshold
                            
                            # Also check for rapid slope change (indicates high frequency)
                            if not should_subdivide:
                                slope1 = (y_mid - y1_val) / (x_mid - x1) if (x_mid - x1) > 0 else 0
                                slope2 = (y2 - y_mid) / (x2 - x_mid) if (x2 - x_mid) > 0 else 0
                                slope_change = abs(slope2 - slope1)
                                # If slope changes significantly, subdivide (adaptive threshold)
                                if slope_change > slope_threshold:
                                    should_subdivide = True
                        else:
                            should_subdivide = True  # Always subdivide around discontinuities
                        
                        # Detect discontinuities - critical for functions like 1/tan(exp(x))
                        has_discontinuity = (y1_val is None) != (y2 is None) or (y_mid is None and (y1_val is not None or y2 is not None))
                        if has_discontinuity:
                            should_subdivide = True
                        
                        if should_subdivide:
                            # Function changes rapidly, has high curvature, or has discontinuities - subdivide
                            # Add valid points
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                            
                            # Add quarter points if they're valid
                            if y_q1 is not None and np.isfinite(y_q1):
                                points.append([float(x_q1), float(y_q1)])
                            if y_q3 is not None and np.isfinite(y_q3):
                                points.append([float(x_q3), float(y_q3)])
                            
                            # Recursively subdivide both halves
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                        else:
                            # Function is smooth - just add midpoint if valid
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                    except:
                        # If evaluation fails, try to subdivide anyway
                        x_mid = (x1 + x2) / 2
                        sample_adaptive(x1, x_mid, y1_val, depth + 1)
                        sample_adaptive(x_mid, x2, None, depth + 1)
                
                # Pixel-perfect initial sampling: one point per screen pixel column
                x_samples = np.linspace(x_min, x_max, initial_n)
                
                # For sliders, use ultra-fast path - minimal overhead
                if _is_slider_change:
                    # Ultra-fast path for sliders - no tracking, no logging, direct evaluation
                    # Skip caching overhead - direct evaluation is faster for small point counts
                    for x in x_samples:
                        try:
                            y = float(original_callable(x))
                            if np.isfinite(y):
                                points.append([float(x), y])
                        except:
                            pass  # Skip invalid points silently
                    # Immediate return for sliders - no adaptive sampling, no logging
                    # linspace is already sorted, so skip sort if possible
                    if len(points) > 0:
                        if len(points) > 1 and points[0][0] > points[-1][0]:
                            points.sort(key=lambda p: p[0])
                        points_list = [[float(p[0]), float(p[1])] for p in points]
                        return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                    else:
                        return _yudimath.plot_points([], x_min, x_max, color if color is not None else None)
                
                # Full path for non-slider executions
                initial_points = []
                valid_count = 0
                error_count = 0
                
                # First pass: batch evaluate all points using cached evaluation
                for x in x_samples:
                    y = evaluate_with_cache(x)
                    if y is not None:
                        points.append([float(x), y])
                        initial_points.append((x, y))
                        valid_count += 1
                    else:
                        initial_points.append((x, None))
                        error_count += 1
                
                print(f"[plot wrapper] Initial pixel-perfect sampling: {valid_count} valid, {error_count} errors out of {initial_n} points")
                print(f"[plot wrapper] Cache stats: {cache_hits} hits, {cache_misses} misses (hit rate: {cache_hits/(cache_hits+cache_misses)*100:.1f}%)" if (cache_hits + cache_misses) > 0 else "[plot wrapper] Cache stats: no evaluations yet")
                
                # If we got very few valid points, try fallback
                if valid_count < 2:
                    print(f"[plot wrapper] Only {valid_count} valid points found, trying fallback")
                    if len(points) > 0:
                        points.sort(key=lambda p: p[0])
                        points_list = [[float(p[0]), float(p[1])] for p in points]
                        return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                
                # Second pass: adaptive refinement between consecutive pixel samples
                # This ensures we capture all oscillations and discontinuities
                # Only for non-slider executions
                    # Only do second pass refinement for non-slider executions
                    # CRITICAL: When zoomed in, we need to be more aggressive with refinement
                    for i in range(len(initial_points) - 1):
                        x1, y1_val = initial_points[i]
                        x2, y2_val = initial_points[i + 1]
                        
                        # Calculate gap size in world coordinates
                        x_diff = x2 - x1
                        
                        # Always refine between pixel samples to catch rapid changes
                        # But be more aggressive when zoomed in (higher pixels_per_unit)
                        if _pixels_per_unit > 200:
                            # Extremely zoomed in - refine ALL gaps, no matter how small
                            sample_adaptive(x1, x2, y1_val, 0)
                        elif _pixels_per_unit > 100:
                            # Very zoomed in - refine even tiny gaps
                            if x_diff > pixel_size_x * 0.05:  # Refine if gap > 0.05 pixels (very small)
                                sample_adaptive(x1, x2, y1_val, 0)
                        elif _pixels_per_unit > 50:
                            # Moderately zoomed in
                            if x_diff > pixel_size_x * 0.2:  # Refine if gap > 0.2 pixels
                                sample_adaptive(x1, x2, y1_val, 0)
                        else:
                            # Normal zoom - refine if gap is significant
                            if x_diff > pixel_size_x * 1.0:  # Refine if gap > 1.0 pixels
                                sample_adaptive(x1, x2, y1_val, 0)
                
                # Sort points by x coordinate (adaptive sampling may add points out of order)
                points.sort(key=lambda p: p[0])
                
                print(f"[plot wrapper] Evaluated {len(points)} points from callable function")
                
                # Fallback: if no points were collected, try simple uniform sampling
                if len(points) == 0:
                    print(f"[plot wrapper] No points collected, trying fallback uniform sampling")
                    # Try a simpler approach: just evaluate at evenly spaced points
                    # Use a denser grid for fallback to increase chances of finding valid points
                    fallback_points = []
                    fallback_n = max(200, min(500, initial_n * 2))  # Use more points for fallback
                    error_count = 0
                    success_count = 0
                    last_error = None
                    last_success_x = None
                    
                    # Try with a denser grid
                    for x in np.linspace(x_min, x_max, fallback_n):
                        try:
                            y = float(original_callable(x))
                            if np.isfinite(y):
                                fallback_points.append([float(x), y])
                                success_count += 1
                                last_success_x = x
                            else:
                                error_count += 1
                        except ZeroDivisionError as e:
                            error_count += 1
                            last_error = f"ZeroDivisionError: {str(e)}"
                            continue
                        except (ValueError, OverflowError, TypeError) as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            continue
                        except Exception as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            # Only print first few errors to avoid spam
                            if error_count <= 3:
                                print(f"[plot wrapper] Fallback: Error at x={x}: {e}")
                            continue
                    
                    if len(fallback_points) > 0:
                        points = fallback_points
                        print(f"[plot wrapper] Fallback collected {len(points)} points (had {error_count} errors, last success at x={last_success_x})")
                    else:
                        # Try one more time with even denser sampling
                        print(f"[plot wrapper] Fallback failed, trying ultra-dense sampling")
                        ultra_dense_points = []
                        # Use very dense sampling for difficult functions
                        ultra_n = 5000  # Very dense
                        for x in np.linspace(x_min, x_max, ultra_n):
                            try:
                                y = float(original_callable(x))
                                if np.isfinite(y):
                                    ultra_dense_points.append([float(x), y])
                            except:
                                continue
                        
                        if len(ultra_dense_points) > 0:
                            points = ultra_dense_points
                            print(f"[plot wrapper] Ultra-dense sampling collected {len(points)} points")
                        else:
                            error_msg = f"plot() could not evaluate callable function at any points in range [{x_min}, {x_max}]"
                            if last_error:
                                error_msg += f". Last error: {last_error}"
                            error_msg += f". Tried {fallback_n} and {ultra_n} points."
                            raise ValueError(error_msg)
                
                # Convert points to a JavaScript-compatible format (list of lists)
                # Pyodide will handle the conversion, but we ensure it's a plain Python list
                points_list = [[float(p[0]), float(p[1])] for p in points]
                
                # Pass points directly to JavaScript - use plot_points function
                return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                    
            except Exception as e2:
                print(f"[plot wrapper] Point evaluation failed: {e2}")
                raise ValueError(f"plot() could not evaluate callable function. Error: {str(e2)}")
    
    # Use extracted expression if available, otherwise use original formula
    formula_to_use = extracted_expression if 'extracted_expression' in locals() and extracted_expression is not None else formula
    if color is not None:
        return __yudimath_plot(formula_to_use, x_min, x_max, color)
    else:
        return __yudimath_plot(formula_to_use, x_min, x_max)
`
      // Set JS functions with prefixed names
      for (const name of functionNames) {
        pyodide.globals.set(`__yudimath_${name}`, jsFunctions[name])
      }
      // Then create Python wrappers
      pyodide.runPython(pythonCode)
      console.log('[pythonFunctions] Functions injected via globals.set with keyword argument support:', functionNames)
    }
  } catch (error: any) {
    console.error('[pythonFunctions] Error injecting functions into Python:', error)
    // Try fallback approach
    try {
      console.log('[pythonFunctions] Attempting fallback: direct global assignment')
      const pythonCode = `
def draw(vector, color=None):
    if color is not None:
        return __yudimath_draw(vector, color)
    else:
        return __yudimath_draw(vector)

def plot(formula, x_min=None, x_max=None, color=None, num_points=None):
    if x_min is None or x_max is None:
        raise ValueError("plot() requires x_min and x_max arguments")
    
    # If formula is callable, we need to evaluate it in Python and pass points
    if callable(formula):
        import numpy as np
        # IMPORTANT: Save the original callable before any modifications
        original_callable = formula
        extracted_expression = None
        
        # Try to get source code first
        try:
            import inspect
            source = inspect.getsource(formula)
            print(f"[plot wrapper] Got source: {repr(source)}")
            # Extract the expression from lambda x: expression
            if 'lambda' in source:
                # Find the part after 'lambda' 
                lambda_part = source.split('lambda', 1)[1]
                # Remove variable name(s) and colon - handle cases like "lambda x:" or "lambda x, y:"
                if ':' in lambda_part:
                    expr = lambda_part.split(':', 1)[1].strip()
                    # Clean up: remove trailing commas, parentheses, whitespace, newlines
                    expr = expr.rstrip(',').rstrip(')').rstrip().strip()
                    # Remove any leading/trailing quotes
                    while (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
                        expr = expr[1:-1].strip()
                    # Remove newlines and extra whitespace
                    expr = ' '.join(expr.split())
                    extracted_expression = expr
                    print(f"[plot wrapper] Extracted expression: {repr(extracted_expression)}")
                    # Use extracted expression instead of callable
                    formula = extracted_expression
                else:
                    raise ValueError("Could not find ':' in lambda")
            else:
                raise ValueError("Not a lambda function")
        except Exception as e:
            print(f"[plot wrapper] Will evaluate callable at points: {e}")
            # Evaluate the function at many points and pass them directly
            # Use the original callable, not the potentially modified formula
            try:
                # For callable functions, we can't analyze the expression, so we must use dense sampling
                # to handle high-frequency functions. Use a conservative approach: always sample densely.
                x_range = x_max - x_min
                
                # Intelligent adaptive sampling - automatically determines optimal density
                # Algorithm: Start with moderate sampling, then recursively subdivide based on error
                
                pixels_covered = x_range * _pixels_per_unit
                
                # Initial sampling: adapt to zoom level
                # When zoomed in (high pixels_per_unit), we need more points to capture detail
                # CRITICAL: Use even more points per pixel when very zoomed in to ensure smooth curves
                # This ensures we capture all oscillations visible on screen
                # BUT: Use lighter sampling for slider changes to keep sliders smooth and live
                if _is_slider_change:
                    # Slider change - use MINIMAL sampling for maximum speed
                    # This keeps sliders smooth and responsive
                    # Use uniform sampling only - no adaptive refinement
                    points_per_pixel = 0.15  # Ultra-minimal - 0.15 points per pixel for maximum speed
                    initial_n = max(50, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 150)  # Very low cap for maximum speed
                elif _pixels_per_unit > 200:
                    # Extremely zoomed in - use extremely dense sampling
                    points_per_pixel = 8.0  # Increased from 5.0
                    initial_n = max(5000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 30000)  # Increased cap
                elif _pixels_per_unit > 100:
                    # Very zoomed in - use very dense sampling
                    points_per_pixel = 6.0  # Increased from 5.0
                    initial_n = max(3000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 25000)  # Increased cap
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    points_per_pixel = 5.0  # Increased from 4.5
                    initial_n = max(2000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 15000)  # Increased cap
                else:
                    # Normal zoom
                    points_per_pixel = 4.0
                    initial_n = max(1000, int(pixels_covered * points_per_pixel))
                    initial_n = min(initial_n, 6000)
                
                # Initialize
                points = []
                estimated_freq = 0.0
                max_slope = 0.0
                
                # Adaptive parameters - more aggressive when zoomed in
                # When zoomed in, we can see more detail, so use deeper recursion
                # But balance with performance - don't go too deep
                if _pixels_per_unit > 100:
                    # Very zoomed in - use very aggressive sampling
                    max_depth = 30  # Increased from 25
                    min_step = (x_max - x_min) / 100000000  # Even finer (100M divisions)
                elif _pixels_per_unit > 50:
                    # Moderately zoomed in
                    max_depth = 25
                    min_step = (x_max - x_min) / 50000000  # 50M divisions
                else:
                    max_depth = 22
                    min_step = (x_max - x_min) / 10000000  # Very fine
                
                # Pixel size in world coordinates - used to determine if we need more samples
                pixel_size_x = x_range / pixels_covered if pixels_covered > 0 else x_range / 1000
                
                # Memoization cache to avoid redundant function evaluations (major performance boost)
                eval_cache = {}
                cache_hits = 0
                cache_misses = 0
                
                def evaluate_with_cache(x):
                    """Evaluate function with memoization for performance"""
                    # Round to avoid floating point precision issues in cache
                    x_key = round(x, 12)
                    if x_key in eval_cache:
                        nonlocal cache_hits
                        cache_hits += 1
                        return eval_cache[x_key]
                    nonlocal cache_misses
                    cache_misses += 1
                    try:
                        y = float(original_callable(x))
                        if np.isfinite(y):
                            eval_cache[x_key] = y
                            return y
                        else:
                            eval_cache[x_key] = None
                            return None
                    except:
                        eval_cache[x_key] = None
                        return None
                
                def sample_adaptive(x1, x2, y1_val, depth):
                    """Recursively sample function, subdividing where it changes rapidly"""
                    # Base case: interval too small or max depth reached
                    if depth > max_depth or (x2 - x1) < min_step:
                        # Add midpoint if we don't have it yet
                        x = (x1 + x2) / 2
                        y = evaluate_with_cache(x)
                        if y is not None:
                            points.append([float(x), y])
                        return
                    
                    # If interval is smaller than a pixel, we're done (pixel-perfect)
                    # This prevents infinite recursion
                    if (x2 - x1) < pixel_size_x * 0.5:
                        return
                    
                    try:
                        # Evaluate at endpoints, midpoint, and quarter points for better derivative estimation
                        # Handle invalid points gracefully - don't skip entire intervals
                        # Use cached evaluation for performance
                        if y1_val is None:
                            y1_val = evaluate_with_cache(x1)
                        
                        y2 = evaluate_with_cache(x2)
                        
                        x_mid = (x1 + x2) / 2
                        y_mid = evaluate_with_cache(x_mid)
                        
                        # If all three points are invalid, try to subdivide anyway to find valid regions
                        if y1_val is None and y2 is None and y_mid is None:
                            # All invalid - subdivide to search for valid regions
                            sample_adaptive(x1, x_mid, None, depth + 1)
                            sample_adaptive(x_mid, x2, None, depth + 1)
                            return
                        
                        # If we have at least one valid point, continue with adaptive sampling
                        valid_points = [(x1, y1_val), (x_mid, y_mid), (x2, y2)]
                        valid_points = [(x, y) for x, y in valid_points if y is not None and np.isfinite(y)]
                        
                        if len(valid_points) < 2:
                            # Not enough valid points - subdivide to find more
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                            return
                        
                        # Evaluate at quarter points for better curvature estimation
                        x_q1 = (x1 + x_mid) / 2
                        x_q3 = (x_mid + x2) / 2
                        y_q1 = evaluate_with_cache(x_q1)
                        y_q3 = evaluate_with_cache(x_q3)
                        
                        # Calculate linear interpolation at midpoint (use available valid points)
                        if y1_val is not None and y2 is not None:
                            y_linear = (y1_val + y2) / 2
                        elif y1_val is not None and y_mid is not None:
                            y_linear = y_mid  # Use midpoint as approximation
                        elif y2 is not None and y_mid is not None:
                            y_linear = y_mid
                        else:
                            y_linear = y_mid if y_mid is not None else (y1_val if y1_val is not None else y2)
                        
                        # Estimate first derivative (slope) at endpoints
                        dx = x2 - x1
                        slope1 = 0
                        slope2 = 0
                        if y1_val is not None and y_mid is not None and (x_mid - x1) > 0:
                            slope1 = (y_mid - y1_val) / (x_mid - x1)
                        if y_mid is not None and y2 is not None and (x2 - x_mid) > 0:
                            slope2 = (y2 - y_mid) / (x2 - x_mid)
                        
                        # Estimate second derivative (curvature) if quarter points are available
                        curvature = 0
                        if y_q1 is not None and y_q3 is not None and np.isfinite(y_q1) and np.isfinite(y_q3):
                            slope_q1 = (y_mid - y_q1) / (x_mid - x_q1) if (x_mid - x_q1) > 0 else 0
                            slope_q3 = (y_q3 - y_mid) / (x_q3 - x_mid) if (x_q3 - x_mid) > 0 else 0
                            curvature = abs(slope_q3 - slope_q1) / (x_q3 - x_q1) if (x_q3 - x_q1) > 0 else 0
                        else:
                            # Fallback: estimate curvature from slope change
                            curvature = abs(slope2 - slope1) / dx if dx > 0 else 0
                        
                        # Calculate error metric: combination of deviation from linear and curvature
                        # Use only valid y values for max_y calculation
                        valid_y_values = [abs(y) for y in [y1_val, y2, y_mid] if y is not None and np.isfinite(y)]
                        max_y = max(valid_y_values) if valid_y_values else 1
                        
                        # Calculate linear error only if we have valid midpoint
                        if y_mid is not None and np.isfinite(y_mid) and y_linear is not None:
                            linear_error = abs(y_mid - y_linear) / (max_y + 1)
                        else:
                            # If midpoint is invalid but endpoints are valid, assume high error (discontinuity)
                            linear_error = 1.0 if (y1_val is not None and y2 is not None) else 0.0
                        
                        # Normalize curvature by function scale and x-range
                        normalized_curvature = curvature * dx * dx / (max_y + 1) if max_y > 0 else 0
                        
                        # Combined error metric: linear error + curvature contribution
                        # Curvature is weighted less since it's a second-order effect
                        combined_error = linear_error + normalized_curvature * 0.3
                        
                        # Aggressive error detection for high-quality rendering
                        # Prioritize quality for high-frequency functions
                        # ADAPTIVE THRESHOLDS: More sensitive when zoomed in (higher pixels_per_unit)
                        # When zoomed in, smaller errors become visible, so use lower thresholds
                        should_subdivide = False
                        
                        # Adaptive thresholds based on zoom level
                        # Higher pixels_per_unit = more zoomed in = need more sensitive thresholds
                        # Use much less sensitive thresholds for slider changes to speed things up
                        if _is_slider_change:
                            # Slider change - use much less sensitive thresholds for speed
                            error_threshold = 0.005  # 0.5% error threshold (much less sensitive)
                            slope_threshold = 200  # Much higher slope change threshold
                        elif _pixels_per_unit > 100:
                            # Very zoomed in - extremely sensitive
                            error_threshold = 0.0001  # 0.01% error threshold
                            slope_threshold = 20  # Lower slope change threshold
                        elif _pixels_per_unit > 50:
                            # Moderately zoomed in - very sensitive
                            error_threshold = 0.0002  # 0.02% error threshold
                            slope_threshold = 30
                        else:
                            # Normal zoom - standard sensitivity
                            error_threshold = 0.0005  # 0.05% error threshold
                            slope_threshold = 50
                        
                        if y1_val is not None and y2 is not None and y_mid is not None:
                            # Linear interpolation error check
                            y_linear = (y1_val + y2) / 2
                            error = abs(y_mid - y_linear)
                            y_magnitude = max(abs(y1_val), abs(y2), abs(y_mid), 1)
                            
                            # Normalized error - use adaptive threshold based on zoom
                            normalized_error = error / y_magnitude if y_magnitude > 0 else 0
                            should_subdivide = normalized_error > error_threshold
                            
                            # Also check for rapid slope change (indicates high frequency)
                            if not should_subdivide:
                                slope1 = (y_mid - y1_val) / (x_mid - x1) if (x_mid - x1) > 0 else 0
                                slope2 = (y2 - y_mid) / (x2 - x_mid) if (x2 - x_mid) > 0 else 0
                                slope_change = abs(slope2 - slope1)
                                # If slope changes significantly, subdivide (adaptive threshold)
                                if slope_change > slope_threshold:
                                    should_subdivide = True
                        else:
                            should_subdivide = True  # Always subdivide around discontinuities
                        
                        # Detect discontinuities - critical for functions like 1/tan(exp(x))
                        has_discontinuity = (y1_val is None) != (y2 is None) or (y_mid is None and (y1_val is not None or y2 is not None))
                        if has_discontinuity:
                            should_subdivide = True
                        
                        if should_subdivide:
                            # Function changes rapidly, has high curvature, or has discontinuities - subdivide
                            # Add valid points
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                            
                            # Add quarter points if they're valid
                            if y_q1 is not None and np.isfinite(y_q1):
                                points.append([float(x_q1), float(y_q1)])
                            if y_q3 is not None and np.isfinite(y_q3):
                                points.append([float(x_q3), float(y_q3)])
                            
                            # Recursively subdivide both halves
                            sample_adaptive(x1, x_mid, y1_val, depth + 1)
                            sample_adaptive(x_mid, x2, y_mid, depth + 1)
                        else:
                            # Function is smooth - just add midpoint if valid
                            if y_mid is not None and np.isfinite(y_mid):
                                points.append([float(x_mid), float(y_mid)])
                    except:
                        # If evaluation fails, try to subdivide anyway
                        x_mid = (x1 + x2) / 2
                        sample_adaptive(x1, x_mid, y1_val, depth + 1)
                        sample_adaptive(x_mid, x2, None, depth + 1)
                
                # Pixel-perfect initial sampling: one point per screen pixel column
                x_samples = np.linspace(x_min, x_max, initial_n)
                
                # For sliders, use ultra-fast path - minimal overhead
                if _is_slider_change:
                    # Ultra-fast path for sliders - no tracking, no logging, direct evaluation
                    # Skip caching overhead - direct evaluation is faster for small point counts
                    for x in x_samples:
                        try:
                            y = float(original_callable(x))
                            if np.isfinite(y):
                                points.append([float(x), y])
                        except:
                            pass  # Skip invalid points silently
                    # Immediate return for sliders - no adaptive sampling, no logging
                    # linspace is already sorted, so skip sort if possible
                    if len(points) > 0:
                        if len(points) > 1 and points[0][0] > points[-1][0]:
                            points.sort(key=lambda p: p[0])
                        points_list = [[float(p[0]), float(p[1])] for p in points]
                        return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                    else:
                        return _yudimath.plot_points([], x_min, x_max, color if color is not None else None)
                
                # Full path for non-slider executions
                initial_points = []
                valid_count = 0
                error_count = 0
                
                # First pass: batch evaluate all points using cached evaluation
                for x in x_samples:
                    y = evaluate_with_cache(x)
                    if y is not None:
                        points.append([float(x), y])
                        initial_points.append((x, y))
                        valid_count += 1
                    else:
                        initial_points.append((x, None))
                        error_count += 1
                
                print(f"[plot wrapper] Initial pixel-perfect sampling: {valid_count} valid, {error_count} errors out of {initial_n} points")
                print(f"[plot wrapper] Cache stats: {cache_hits} hits, {cache_misses} misses (hit rate: {cache_hits/(cache_hits+cache_misses)*100:.1f}%)" if (cache_hits + cache_misses) > 0 else "[plot wrapper] Cache stats: no evaluations yet")
                
                # If we got very few valid points, try fallback
                if valid_count < 2:
                    print(f"[plot wrapper] Only {valid_count} valid points found, trying fallback")
                    if len(points) > 0:
                        points.sort(key=lambda p: p[0])
                        points_list = [[float(p[0]), float(p[1])] for p in points]
                        return _yudimath.plot_points(points_list, x_min, x_max, color if color is not None else None)
                
                # Second pass: adaptive refinement between consecutive pixel samples
                # This ensures we capture all oscillations and discontinuities
                # Only for non-slider executions
                    # Only do second pass refinement for non-slider executions
                    # CRITICAL: When zoomed in, we need to be more aggressive with refinement
                    for i in range(len(initial_points) - 1):
                        x1, y1_val = initial_points[i]
                        x2, y2_val = initial_points[i + 1]
                        
                        # Calculate gap size in world coordinates
                        x_diff = x2 - x1
                        
                        # Always refine between pixel samples to catch rapid changes
                        # But be more aggressive when zoomed in (higher pixels_per_unit)
                        if _pixels_per_unit > 200:
                            # Extremely zoomed in - refine ALL gaps, no matter how small
                            sample_adaptive(x1, x2, y1_val, 0)
                        elif _pixels_per_unit > 100:
                            # Very zoomed in - refine even tiny gaps
                            if x_diff > pixel_size_x * 0.05:  # Refine if gap > 0.05 pixels (very small)
                                sample_adaptive(x1, x2, y1_val, 0)
                        elif _pixels_per_unit > 50:
                            # Moderately zoomed in
                            if x_diff > pixel_size_x * 0.2:  # Refine if gap > 0.2 pixels
                                sample_adaptive(x1, x2, y1_val, 0)
                        else:
                            # Normal zoom - refine if gap is significant
                            if x_diff > pixel_size_x * 1.0:  # Refine if gap > 1.0 pixels
                                sample_adaptive(x1, x2, y1_val, 0)
                
                # Sort points by x coordinate (adaptive sampling may add points out of order)
                points.sort(key=lambda p: p[0])
                
                print(f"[plot wrapper] Evaluated {len(points)} points from callable function")
                
                # Fallback: if no points were collected, try simple uniform sampling
                if len(points) == 0:
                    print(f"[plot wrapper] No points collected, trying fallback uniform sampling")
                    # Try a simpler approach: just evaluate at evenly spaced points
                    # Use a denser grid for fallback to increase chances of finding valid points
                    fallback_points = []
                    fallback_n = max(200, min(500, initial_n * 2))  # Use more points for fallback
                    error_count = 0
                    success_count = 0
                    last_error = None
                    last_success_x = None
                    
                    # Try with a denser grid
                    for x in np.linspace(x_min, x_max, fallback_n):
                        try:
                            y = float(original_callable(x))
                            if np.isfinite(y):
                                fallback_points.append([float(x), y])
                                success_count += 1
                                last_success_x = x
                            else:
                                error_count += 1
                        except ZeroDivisionError as e:
                            error_count += 1
                            last_error = f"ZeroDivisionError: {str(e)}"
                            continue
                        except (ValueError, OverflowError, TypeError) as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            continue
                        except Exception as e:
                            error_count += 1
                            last_error = f"{type(e).__name__}: {str(e)}"
                            # Only print first few errors to avoid spam
                            if error_count <= 3:
                                print(f"[plot wrapper] Fallback: Error at x={x}: {e}")
                            continue
                    
                    if len(fallback_points) > 0:
                        points = fallback_points
                        print(f"[plot wrapper] Fallback collected {len(points)} points (had {error_count} errors, last success at x={last_success_x})")
                    else:
                        # Try one more time with even denser sampling
                        print(f"[plot wrapper] Fallback failed, trying ultra-dense sampling")
                        ultra_dense_points = []
                        # Use very dense sampling for difficult functions
                        ultra_n = 5000  # Very dense
                        for x in np.linspace(x_min, x_max, ultra_n):
                            try:
                                y = float(original_callable(x))
                                if np.isfinite(y):
                                    ultra_dense_points.append([float(x), y])
                            except:
                                continue
                        
                        if len(ultra_dense_points) > 0:
                            points = ultra_dense_points
                            print(f"[plot wrapper] Ultra-dense sampling collected {len(points)} points")
                        else:
                            error_msg = f"plot() could not evaluate callable function at any points in range [{x_min}, {x_max}]"
                            if last_error:
                                error_msg += f". Last error: {last_error}"
                            error_msg += f". Tried {fallback_n} and {ultra_n} points."
                            raise ValueError(error_msg)
                
                # Convert points to a JavaScript-compatible format (list of lists)
                # Pyodide will handle the conversion, but we ensure it's a plain Python list
                points_list = [[float(p[0]), float(p[1])] for p in points]
                
                # Pass points directly to JavaScript - use plot_points function
                return __yudimath_plot_points(points_list, x_min, x_max, color if color is not None else None, n_points)
                    
            except Exception as e2:
                print(f"[plot wrapper] Point evaluation failed: {e2}")
                raise ValueError(f"plot() could not evaluate callable function. Error: {str(e2)}")
    
    # Call the underlying JavaScript function with all arguments
    # Use extracted expression if available, otherwise use original formula
    formula_to_use = extracted_expression if 'extracted_expression' in locals() and extracted_expression is not None else formula
    if color is not None and num_points is not None:
        return __yudimath_plot(formula_to_use, x_min, x_max, color, num_points)
    elif color is not None:
        return __yudimath_plot(formula_to_use, x_min, x_max, color)
    elif num_points is not None:
        return __yudimath_plot(formula_to_use, x_min, x_max, None, num_points)
    else:
        return __yudimath_plot(formula_to_use, x_min, x_max)

# Wrapper for plot_parametric() that handles keyword arguments and callables
def plot_parametric(x_func, y_func, t_min=None, t_max=None, color=None):
    # Handle both positional and keyword arguments
    if t_min is None or t_max is None:
        raise ValueError("plot_parametric() requires t_min and t_max arguments")
    
    # Check if x_func or y_func are callables
    x_is_callable = callable(x_func)
    y_is_callable = callable(y_func)
    
    # If both are strings, pass through to JavaScript
    if not x_is_callable and not y_is_callable:
        if color is not None:
            return __yudimath_plot_parametric(x_func, y_func, t_min, t_max, color)
        else:
            return __yudimath_plot_parametric(x_func, y_func, t_min, t_max)
    
    # If either is callable, we need to evaluate in Python
    # Save original callables
    original_x_func = x_func if x_is_callable else None
    original_y_func = y_func if y_is_callable else None
    
    # Try to extract expressions from callables (similar to plot())
    x_func_string = None
    y_func_string = None
    
    if x_is_callable:
        try:
            import inspect
            source = inspect.getsource(x_func)
            if 'lambda' in source:
                lambda_part = source.split('lambda', 1)[1]
                if ':' in lambda_part:
                    expr = lambda_part.split(':', 1)[1].strip()
                    expr = expr.rstrip(',').rstrip(')').rstrip().strip()
                    while (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
                        expr = expr[1:-1].strip()
                    expr = ' '.join(expr.split())
                    x_func_string = expr
                    x_func = expr  # Use extracted expression
        except:
            pass  # Will evaluate at points
    
    if y_is_callable:
        try:
            import inspect
            source = inspect.getsource(y_func)
            if 'lambda' in source:
                lambda_part = source.split('lambda', 1)[1]
                if ':' in lambda_part:
                    expr = lambda_part.split(':', 1)[1].strip()
                    expr = expr.rstrip(',').rstrip(')').rstrip().strip()
                    while (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'")):
                        expr = expr[1:-1].strip()
                    expr = ' '.join(expr.split())
                    y_func_string = expr
                    y_func = expr  # Use extracted expression
        except:
            pass  # Will evaluate at points
    
    # If we successfully extracted both expressions, use them
    if x_func_string is not None and y_func_string is not None:
        if color is not None:
            return __yudimath_plot_parametric(x_func_string, y_func_string, t_min, t_max, color)
        else:
            return __yudimath_plot_parametric(x_func_string, y_func_string, t_min, t_max)
    
    # Otherwise, evaluate callables at points
    # Use adaptive sampling similar to plot()
    try:
        import numpy as np
        t_range = t_max - t_min
        
        # First, estimate coordinate range by sampling multiple points across the range
        # This helps determine if we need more points for large coordinate values
        # Sample more points to better catch the maximum coordinate value
        estimated_max_coord = 1.0
        try:
            # Sample 20 points across the range for better estimation
            num_samples = 20
            sample_t = np.linspace(t_min, t_max, num_samples)
            for t_val in sample_t:
                try:
                    if x_is_callable and original_x_func is not None:
                        x_val = float(original_x_func(t_val))
                    else:
                        x_val = float(eval(x_func, {'t': t_val, 'np': np, 'math': __import__('math'), 'sin': np.sin, 'cos': np.cos, 'tan': np.tan, 'exp': np.exp, 'log': np.log, 'sqrt': np.sqrt, 'abs': abs}))
                    if y_is_callable and original_y_func is not None:
                        y_val = float(original_y_func(t_val))
                    else:
                        y_val = float(eval(y_func, {'t': t_val, 'np': np, 'math': __import__('math'), 'sin': np.sin, 'cos': np.cos, 'tan': np.tan, 'exp': np.exp, 'log': np.log, 'sqrt': np.sqrt, 'abs': abs}))
                    if np.isfinite(x_val) and np.isfinite(y_val):
                        estimated_max_coord = max(estimated_max_coord, abs(x_val), abs(y_val))
                except:
                    pass
        except:
            pass  # If sampling fails, use default
        
        # More aggressive scaling: use square root to avoid excessive points but still scale up
        # For coordinates around 100, this gives ~3x scaling instead of 10x
        # This balances quality and performance better
        if estimated_max_coord > 10:
            coordinate_scale = 1.0 + (estimated_max_coord - 10.0) / 30.0  # Linear scaling above 10
            coordinate_scale = min(coordinate_scale, 10.0)  # Cap at 10x to avoid excessive points
        else:
            coordinate_scale = 1.0
        
        # Calculate optimal number of points based on range, zoom, AND coordinate scale
        pixels_covered = t_range * _pixels_per_unit
        
        # Initial sampling: adapt to zoom level and coordinate scale
        if _is_slider_change:
            # Slider change - use minimal sampling
            points_per_pixel = 0.15
            initial_n = max(50, int(pixels_covered * points_per_pixel * coordinate_scale))
            initial_n = min(initial_n, 150)
        elif _pixels_per_unit > 200:
            points_per_pixel = 8.0
            initial_n = max(5000, int(pixels_covered * points_per_pixel * coordinate_scale))
            initial_n = min(initial_n, 30000)
        elif _pixels_per_unit > 100:
            points_per_pixel = 6.0
            initial_n = max(3000, int(pixels_covered * points_per_pixel * coordinate_scale))
            initial_n = min(initial_n, 25000)
        elif _pixels_per_unit > 50:
            points_per_pixel = 5.0
            initial_n = max(2000, int(pixels_covered * points_per_pixel * coordinate_scale))
            initial_n = min(initial_n, 15000)
        else:
            points_per_pixel = 4.0
            initial_n = max(1000, int(pixels_covered * points_per_pixel * coordinate_scale))
            initial_n = min(initial_n, 6000)
        
        # Evaluate functions at t values
        points = []
        t_samples = np.linspace(t_min, t_max, initial_n)
        
        # Memoization cache for function evaluations
        eval_cache_x = {}
        eval_cache_y = {}
        
        def evaluate_x_with_cache(t):
            t_key = round(t, 12)
            if t_key in eval_cache_x:
                return eval_cache_x[t_key]
            try:
                if x_is_callable and original_x_func is not None:
                    val = float(original_x_func(t))
                else:
                    # String expression - evaluate using eval (with t in namespace)
                    val = float(eval(x_func, {'t': t, 'np': np, 'math': __import__('math'), 'sin': np.sin, 'cos': np.cos, 'tan': np.tan, 'exp': np.exp, 'log': np.log, 'sqrt': np.sqrt, 'abs': abs}))
                if np.isfinite(val):
                    eval_cache_x[t_key] = val
                    return val
                else:
                    eval_cache_x[t_key] = None
                    return None
            except:
                eval_cache_x[t_key] = None
                return None
        
        def evaluate_y_with_cache(t):
            t_key = round(t, 12)
            if t_key in eval_cache_y:
                return eval_cache_y[t_key]
            try:
                if y_is_callable and original_y_func is not None:
                    val = float(original_y_func(t))
                else:
                    # String expression - evaluate using eval (with t in namespace)
                    val = float(eval(y_func, {'t': t, 'np': np, 'math': __import__('math'), 'sin': np.sin, 'cos': np.cos, 'tan': np.tan, 'exp': np.exp, 'log': np.log, 'sqrt': np.sqrt, 'abs': abs}))
                if np.isfinite(val):
                    eval_cache_y[t_key] = val
                    return val
                else:
                    eval_cache_y[t_key] = None
                    return None
            except:
                eval_cache_y[t_key] = None
                return None
        
        # Evaluate at all t samples
        for t in t_samples:
            x_val = evaluate_x_with_cache(t)
            y_val = evaluate_y_with_cache(t)
            if x_val is not None and y_val is not None:
                points.append([float(x_val), float(y_val)])
        
        if len(points) == 0:
            raise ValueError(f"plot_parametric() could not evaluate functions at any points in range [{t_min}, {t_max}]")
        
        # Convert to JavaScript-compatible format
        points_list = [[float(p[0]), float(p[1])] for p in points]
        
        # Pass points to JavaScript
        if color is not None:
            return __yudimath_plot_parametric_points(points_list, t_min, t_max, color)
        else:
            return __yudimath_plot_parametric_points(points_list, t_min, t_max)
            
    except Exception as e:
        print(f"[plot_parametric wrapper] Evaluation failed: {e}")
        raise ValueError(f"plot_parametric() could not evaluate functions. Error: {str(e)}")
`
      for (const name of functionNames) {
        pyodide.globals.set(`__yudimath_${name}`, jsFunctions[name])
      }
      pyodide.runPython(pythonCode)
      console.log('[pythonFunctions] Fallback injection successful:', functionNames)
    } catch (fallbackError: any) {
      console.error('[pythonFunctions] Fallback injection also failed:', fallbackError)
      throw fallbackError
    }
  }
}

