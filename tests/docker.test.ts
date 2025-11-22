import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Docker Configuration', () => {
  const dockerDir = join(process.cwd(), 'docker')
  const rootDir = process.cwd()

  it('Dockerfile exists', () => {
    const dockerfilePath = join(dockerDir, 'Dockerfile')
    expect(existsSync(dockerfilePath)).toBe(true)
  })

  it('Dockerfile.dev exists', () => {
    const dockerfilePath = join(dockerDir, 'Dockerfile.dev')
    expect(existsSync(dockerfilePath)).toBe(true)
  })

  it('docker-compose.yml exists', () => {
    const composePath = join(dockerDir, 'docker-compose.yml')
    expect(existsSync(composePath)).toBe(true)
  })

  it('docker-compose.dev.yml exists', () => {
    const composePath = join(dockerDir, 'docker-compose.dev.yml')
    expect(existsSync(composePath)).toBe(true)
  })

  it('nginx.conf exists', () => {
    const nginxPath = join(dockerDir, 'nginx.conf')
    expect(existsSync(nginxPath)).toBe(true)
  })

  it('.dockerignore exists', () => {
    const dockerignorePath = join(rootDir, '.dockerignore')
    expect(existsSync(dockerignorePath)).toBe(true)
  })

  it('Dockerfile uses multi-stage build', () => {
    const dockerfilePath = join(dockerDir, 'Dockerfile')
    const content = readFileSync(dockerfilePath, 'utf-8')
    expect(content).toContain('FROM node:18-alpine AS build')
    expect(content).toContain('FROM nginx:alpine')
  })

  it('Dockerfile exposes port 80', () => {
    const dockerfilePath = join(dockerDir, 'Dockerfile')
    const content = readFileSync(dockerfilePath, 'utf-8')
    expect(content).toContain('EXPOSE 80')
  })

  it('docker-compose.yml maps port 3000:80', () => {
    const composePath = join(dockerDir, 'docker-compose.yml')
    const content = readFileSync(composePath, 'utf-8')
    expect(content).toContain('"3000:80"')
  })

  it('nginx.conf configures SPA routing', () => {
    const nginxPath = join(dockerDir, 'nginx.conf')
    const content = readFileSync(nginxPath, 'utf-8')
    expect(content).toContain('try_files $uri $uri/ /index.html')
  })

  it('.dockerignore excludes node_modules', () => {
    const dockerignorePath = join(rootDir, '.dockerignore')
    const content = readFileSync(dockerignorePath, 'utf-8')
    expect(content).toContain('node_modules')
  })
})

