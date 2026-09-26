# Creditplusfocalassist

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.2.

## Development server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

`npm start` uses `proxy.conf.json` so frontend calls to `/api/*` and `/auth/*` are forwarded to `http://localhost:8080`.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Docker

Two Docker images are provided:

- `Dockerfile.web`: static Angular app served by nginx on port `80`
- `Dockerfile.ssr`: Angular SSR app served by Node on port `4000`

`Dockerfile.web` proxies `/api/*` and `/auth/*` to `BACKEND_UPSTREAM`.
Default: `http://host.docker.internal:8080`.

Build locally:

```bash
docker build -f Dockerfile.web -t focalassist-web:latest .
docker build -f Dockerfile.ssr -t focalassist-ssr:latest .
```

Run locally:

```bash
docker run --rm -p 4200:80 focalassist-web:latest
docker run --rm -p 4000:4000 focalassist-ssr:latest
```

For a host backend on port `8080`, keep the default `BACKEND_UPSTREAM`.
For a backend container, set `BACKEND_UPSTREAM=http://<backend-service-name>:8080`.

Or with compose:

```bash
docker compose up --build
```

Local compose serves the web image on `http://localhost:4200`.
For OCI or another production VM, copy `.env.oci.example` to `.env` and set `WEB_PORT=80`.

For full OCI deployment with the backend from `creditplus-api`, use:

```bash
docker compose -f docker-compose.oci.yml up -d --build
```

For a single-VM deployment that also runs MySQL in Docker, use:

```bash
docker compose --env-file .env.vm -f docker-compose.vm.yml up -d --build
```

OCI deployment notes are in `docs/oracle-cloud-free-tier-deployment.md`.

## Public Access (Expose Your Local Machine)

Fastest option is Cloudflare Tunnel (no router port-forwarding required):

```bash
# 1) Run backend on port 8080
# 2) Run frontend on port 4200
npm start

# 3) Start public tunnel (from project root)
tools/cloudflared.exe tunnel --url http://localhost:4200
```

Cloudflare prints a public `https://...trycloudflare.com` URL you can share.

GitHub Actions workflow `.github/workflows/docker-publish.yml` publishes both images to GHCR:

- `ghcr.io/<owner>/creditplus-focal-web`
- `ghcr.io/<owner>/creditplus-focal-ssr`

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
