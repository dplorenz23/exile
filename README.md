## Local Development Setup

### Prerequisites

Install:

- Git
- Node.js LTS (includes npm)
- Visual Studio Code

Recommended VS Code extensions:

- ESLint
- Prettier - Code formatter

### Clone and Install

Clone the repository:

```bash
git clone <EXILE_REPOSITORY_URL>
cd exile
```

Terminology:
- Client - App.tsx - ../exile
- Server - index.ts - ../exile/server

Install client dependencies:
```bash
npm install
```

Install server dependencies:
```bash
cd server
npm install
```

### Run EXiLE

From server:
```bash
npm run dev
```

From client (open a second cmd prompt):
```bash
npm run dev -- --host
```

The client side will display 2 URL's, the local URL and the Network URL.
- Open the Local URL to play on the host computer.
- Other computers on the same LAN can connect using the Network URL.

