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

## Deploying

Every push to `main` puts the panel live through the
[Deploy workflow](.github/workflows/deploy.yml), usually within two minutes:

1. **Build:** `npm ci`, lint, type-check and `npm run build`. If any step fails,
   nothing is deployed.
2. **Deploy:** uploads the build to a new folder on the server, then switches the
   site to it in one step, so nobody sees a half-copied site. If `ADMIN_URL` is
   set, it then checks that the panel serves the new build.

Pushes that change only Markdown files don't deploy. To deploy without a push,
open Actions > Deploy > Run workflow. The build's `VITE_` values are set in the
workflow's Build step, not read from `.env`.

### On the server

`<DEPLOY_PATH>-releases/` holds the last five builds, named by time and commit,
and its `current` link points to the live one. `DEPLOY_PATH` itself is a link to
`current`, so the web server has to follow links (in Apache, `Options
FollowSymLinks`, which is on by default); the setup script checks this.
`before-ci` is the build that was live before deploys were automated, and it's
never removed. Don't build on the server: the next deploy replaces whatever is
there.

### Rolling back

- **From GitHub:** open the Deploy run of the commit you want back and choose
  Re-run all jobs. It rebuilds that commit and deploys it.
- **On the server, at once:** as root or the deploy user, point `current` at an
  earlier build:

  ```sh
  cd <DEPLOY_PATH>-releases && ls        # builds are named <time>-<commit>
  ln -sfn <build> .current.tmp && mv -Tf .current.tmp current
  ```

The next push deploys as usual.

### Settings

In GitHub, under Settings > Environments > `production`, allow only the `main`
branch under Deployment branches, and add these secrets:

| Secret            | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| `DEPLOY_HOST`     | The server's address                                             |
| `DEPLOY_USER`     | `deploy`                                                         |
| `DEPLOY_PATH`     | The folder the web server serves for the panel, such as `/var/www/admin/dist` |
| `DEPLOY_SSH_KEY`  | The deploy key's private half                                    |
| `DEPLOY_HOST_KEY` | The server's `/etc/ssh/ssh_host_ed25519_key.pub`                 |
| `ADMIN_URL`       | Optional. The panel's address, checked after each deploy         |
| `DEPLOY_PORT`     | Optional. The SSH port, if it isn't 22                           |

### One-time server setup

1. Make a key pair for deploys, without a passphrase:
   `ssh-keygen -t ed25519 -N "" -C github-actions-deploy -f deploy_key`
2. Copy `scripts/setup-deploy-server.sh` to the server and run it as root, with
   the folder the web server serves for the panel, the contents of
   `deploy_key.pub`, and the panel's address:

   ```sh
   bash setup-deploy-server.sh /var/www/admin/dist 'ssh-ed25519 AAAA... github-actions-deploy' https://admin.example.com
   ```

   It changes nothing unless the panel's address serves that folder, which it
   checks by asking the server's own web server. It adds a `deploy` user that
   can sign in only with the key and moves the live build into
   `<folder>-releases`. Then it checks that the site follows a switch between
   builds, and puts the folder back if it doesn't. At the end it prints the
   values for the secrets. Running it again is safe.
3. Add the secrets, with the contents of `deploy_key` as `DEPLOY_SSH_KEY`. Then
   delete both key files.
