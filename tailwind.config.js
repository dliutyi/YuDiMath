/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme color palette
        'bg-primary': '#0f172a',      // slate-900 - Background
        'grid-line': '#334155',      // slate-700 - Grid Lines
        'axis': '#64748b',           // slate-500 - Axes
        'primary': '#3b82f6',        // blue-500 - Primary
        'secondary': '#8b5cf6',      // purple-500 - Secondary
        'success': '#10b981',        // emerald-500 - Success
        'warning': '#f59e0b',        // amber-500 - Warning
        'error': '#ef4444',          // red-500 - Error
        'text-primary': '#f1f5f9',   // slate-100 - Text Primary
        'text-secondary': '#cbd5e1', // slate-300 - Text Secondary
        'panel-bg': '#1e293b',       // slate-800 - Panel Background
        'border': '#334155',         // slate-700 - Border
        'hover': '#475569',          // slate-600 - Hover
      },
    },
  },
  plugins: [],
}

