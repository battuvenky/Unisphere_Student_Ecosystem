# UniSphere

## Live Preview

[https://unisphere-drab.vercel.app/](https://unisphere-drab.vercel.app/)

## Overview

UniSphere is a student ecosystem platform built for campus productivity, collaboration, and engagement. The application combines workspace modules, real-time interactions, and role-based experiences in a single unified interface.

## Core Capabilities

- Authentication flows for sign up and login
- Modular workspace features (tasks, notes, resources, mentorship, groups, analytics, and more)
- Real-time communication signals powered by Socket.IO
- API-first structure with dedicated routes for each domain
- Local JSON-backed data storage for rapid development

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Socket.IO
- Zod

## Project Structure

```text
unisphere/
	data/                   Local JSON data files
	public/                 Static assets
	src/
		app/                  App Router pages and API routes
			(workspace)/        Authenticated workspace modules
			api/                Backend route handlers
			login/              Login page
			signup/             Signup page
		components/           Shared and module-specific UI components
		lib/                  Business logic, stores, auth, realtime utilities
	server.js               Custom Next.js + Socket.IO server
```

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

By default, the app runs at [http://localhost:3400](http://localhost:3400).

## Available Scripts

- `npm run dev`: Start development server using `server.js`
- `npm run build`: Build production assets
- `npm run start`: Start production server (`node server.js --prod`)
- `npm run lint`: Run ESLint checks

## Runtime Configuration

The server supports these environment variables:

- `PORT` (default: `3400`)
- `HOSTNAME` (default: `0.0.0.0`)
- `JWT_SECRET` (recommended), or `AUTH_SECRET` / `NEXTAUTH_SECRET` as alternatives for auth token signing

## Real-Time Events

Socket.IO is configured with `/socket.io` and supports websocket with polling fallback. Current event channels include:

- `realtime:ready`
- `user:join`
- `connections:typing`

## Deployment

This project is production-ready for platforms that support Next.js server workloads.

Recommended steps:

1. Build with `npm run build`
2. Start with `npm run start`
3. Configure `PORT` and `HOSTNAME` in your hosting environment
4. Ensure websocket upgrades are enabled for Socket.IO

## Contributing

1. Create a feature branch
2. Keep changes scoped to clear modules
3. Run lint checks before pushing
4. Open a pull request with a short testing summary

## License

No license file is currently defined in this repository.
