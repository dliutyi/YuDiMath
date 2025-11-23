import GridStepSelector from './GridStepSelector'

interface ToolbarProps {
  gridStep: number
  onGridStepChange: (step: number) => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onExport: () => void
  onImport: () => void
  onClear: () => void
}

const MIN_ZOOM = 5.0
const MAX_ZOOM = 500.0

export default function Toolbar({
  gridStep,
  onGridStepChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onExport,
  onImport,
  onClear,
}: ToolbarProps) {
  const formatZoom = (value: number): string => {
    return value.toFixed(1)
  }

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    e.currentTarget.blur()
    action()
  }

  const handleButtonMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add('active-touch')
  }

  const handleButtonMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('active-touch')
    e.currentTarget.blur()
  }

  const handleButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('active-touch')
    e.currentTarget.blur()
  }

  const handleButtonTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add('active-touch')
  }

  const handleButtonTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.blur()
    setTimeout(() => {
      e.currentTarget.classList.remove('active-touch')
    }, 150)
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-panel-bg/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl p-3 flex items-center gap-4">
        {/* Grid Step Selector */}
        <div className="flex items-center gap-2">
          <GridStepSelector gridStep={gridStep} onGridStepChange={onGridStepChange} />
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-border/50" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary whitespace-nowrap">Zoom:</span>
          <button
            onClick={(e) => handleButtonClick(e, onZoomOut)}
            onMouseDown={handleButtonMouseDown}
            onMouseUp={handleButtonMouseUp}
            onMouseLeave={handleButtonMouseLeave}
            onTouchStart={handleButtonTouchStart}
            onTouchEnd={handleButtonTouchEnd}
            disabled={zoom <= MIN_ZOOM}
            className="relative px-3 py-2 rounded-lg transition-all duration-200 touch-manipulation bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-hover/50 hover:border-border hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Zoom Out"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <span className="text-sm font-mono text-text-primary min-w-[4rem] text-center">
            {formatZoom(zoom)}x
          </span>
          <button
            onClick={(e) => handleButtonClick(e, onZoomIn)}
            onMouseDown={handleButtonMouseDown}
            onMouseUp={handleButtonMouseUp}
            onMouseLeave={handleButtonMouseLeave}
            onTouchStart={handleButtonTouchStart}
            onTouchEnd={handleButtonTouchEnd}
            disabled={zoom >= MAX_ZOOM}
            className="relative px-3 py-2 rounded-lg transition-all duration-200 touch-manipulation bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-hover/50 hover:border-border hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Zoom In"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            onClick={(e) => handleButtonClick(e, onZoomReset)}
            onMouseDown={handleButtonMouseDown}
            onMouseUp={handleButtonMouseUp}
            onMouseLeave={handleButtonMouseLeave}
            onTouchStart={handleButtonTouchStart}
            onTouchEnd={handleButtonTouchEnd}
            className="relative px-3 py-2 rounded-lg transition-all duration-200 touch-manipulation bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-hover/50 hover:border-border hover:shadow-md"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Reset Zoom"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-border/50" />

        {/* Workspace Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => handleButtonClick(e, onExport)}
            onMouseDown={handleButtonMouseDown}
            onMouseUp={handleButtonMouseUp}
            onMouseLeave={handleButtonMouseLeave}
            onTouchStart={handleButtonTouchStart}
            onTouchEnd={handleButtonTouchEnd}
            className="relative px-3 py-2 rounded-lg transition-all duration-200 touch-manipulation bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-hover/50 hover:border-border hover:shadow-md group"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Export Workspace"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-700/50 z-20">
              Export Workspace
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900/95"></span>
            </span>
          </button>
          <button
            onClick={(e) => handleButtonClick(e, onImport)}
            onMouseDown={handleButtonMouseDown}
            onMouseUp={handleButtonMouseUp}
            onMouseLeave={handleButtonMouseLeave}
            onTouchStart={handleButtonTouchStart}
            onTouchEnd={handleButtonTouchEnd}
            className="relative px-3 py-2 rounded-lg transition-all duration-200 touch-manipulation bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-hover/50 hover:border-border hover:shadow-md group"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Import Workspace"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-700/50 z-20">
              Import Workspace
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900/95"></span>
            </span>
          </button>
          <button
            onClick={(e) => handleButtonClick(e, onClear)}
            onMouseDown={handleButtonMouseDown}
            onMouseUp={handleButtonMouseUp}
            onMouseLeave={handleButtonMouseLeave}
            onTouchStart={handleButtonTouchStart}
            onTouchEnd={handleButtonTouchEnd}
            className="relative px-3 py-2 rounded-lg transition-all duration-200 touch-manipulation bg-bg-primary/50 border border-border/50 text-text-primary hover:bg-red-500/20 hover:border-red-500/50 hover:shadow-md group"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Clear Workspace"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-700/50 z-20">
              Clear Workspace
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900/95"></span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

