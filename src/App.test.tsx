import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the application', () => {
    render(<App />)
    expect(screen.getByText('YuDiMath')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(<App />)
    expect(screen.getByText('Linear Algebra & Calculus Visualizer')).toBeInTheDocument()
  })

  it('renders success message', () => {
    render(<App />)
    expect(screen.getByText('Project initialized successfully!')).toBeInTheDocument()
  })
})

