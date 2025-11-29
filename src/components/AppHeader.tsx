/**
 * App Header Component
 * Displays the application title and subtitle in the top-left corner
 */
export default function AppHeader() {
  return (
    <div className="absolute top-4 left-4 z-10 bg-panel-bg/90 backdrop-blur-sm border border-border rounded-lg px-4 py-2 shadow-lg">
      <h1 className="text-xl font-bold text-text-primary">YuDiMath</h1>
      <p className="text-xs text-text-secondary">Linear Algebra & Calculus Visualizer</p>
    </div>
  )
}

