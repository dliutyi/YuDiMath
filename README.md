# YuDiMath

A modern, interactive web application for visualizing linear algebra and calculus concepts using an infinite Cartesian coordinate system.

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker (for containerized development)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Run tests:
```bash
npm test
```

### Docker

See `docker/` directory for Docker configuration (to be set up in Step 1.3).

## Project Structure

```
yudimath/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   ├── styles/
│   └── main.tsx
├── tests/
│   ├── unit/
│   └── setup.ts
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
└── package.json
```

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Vitest
- PyScript (to be configured)

