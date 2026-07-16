# ml-tools

This repository contains a React front-end application built with Vite, Tailwind CSS, and a set of UI components. The front-end source code lives in the frontend folder.

## Front-end setup after cloning

### Prerequisites

Make sure you have the following installed on your machine:

- Node.js 18 or newer
- npm (included with Node.js) or pnpm

### Install dependencies

From the project root, change into the front-end directory and install dependencies:

```bash
git clone <repository-url>
cd ml-tools
cd frontend
npm install
```

If you prefer pnpm, you can use:

```bash
pnpm install
```

### Run the development server

Start the Vite development server:

```bash
npm run dev
```

Or with pnpm:

```bash
pnpm dev
```

Vite will print a local URL in the terminal, usually:

```text
http://localhost:5173/
```

Open that address in your browser to view the app.

### Build for production

To create a production build, run:

```bash
npm run build
```

The production files will be generated in the frontend/dist folder.

### Front-end structure overview

- frontend/src/main.tsx: application entry point
- frontend/src/app/: main app layout and React components
- frontend/src/app/components/ui/: shared UI component library
- frontend/vite.config.ts: Vite configuration
- frontend/package.json: scripts and dependencies