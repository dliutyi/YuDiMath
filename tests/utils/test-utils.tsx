import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

/**
 * Custom render function that wraps components with providers if needed
 * This can be extended later for context providers, etc.
 */
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { ...options })

// Re-export everything from React Testing Library
export * from '@testing-library/react'
export { customRender as render }

