# Hashtag Billionaire Admin

Admin panel for Hashtag Billionaire: products, variants, categories, orders,
payments, supplier imports (S&S, SAGE, SanMar, OttoCap), users and admins.

Built with Vite, React 18, TypeScript, Tailwind CSS with shadcn/ui, and Ant Design.

## Setup

Requires Node.js and npm.

```sh
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:8080
```

`.env.example` documents every variable. `VITE_API_BASE_URL` is required; the
dev server and build stop with an error if it is missing. Every `VITE_` value
is compiled into the browser bundle, so never put a secret in `.env`.

## Scripts

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start the dev server on port 8080         |
| `npm run build`     | Production build into `dist/`             |
| `npm run build:dev` | Build with development mode settings      |
| `npm run preview`   | Serve the production build locally        |
| `npm run lint`      | Lint with oxlint (config: `.oxlintrc.json`) |

## Project layout

```
src/
  components/      Layout, sidebar, header, auth screens
    ui/            shadcn/ui components in use
  config/env.ts    All environment values, read once
  lib/session.ts   Sign-in state (token, role) and password rules
  pages/           One folder per screen
  services/Api/    Backend calls, one module per area
    interceptors.ts  Adds the admin token and handles 401s
  utils/           Shared helpers (pricing, image copying)
```
