# Oracle Cloud Free Tier Deployment

This repo is the Angular frontend. It does not contain the backend service or a tracked SQL schema. The frontend expects these backend routes:

- `/api/*`
- `/auth/*`

The Docker nginx image proxies those routes to `BACKEND_UPSTREAM`, which defaults to `http://host.docker.internal:8080`.

## Recommended Free Tier Shape

Use:

- OCI Ampere A1 compute for the application VM.
- OCI MySQL HeatWave Always Free for the database, because the only SQL dump found locally is a MariaDB/MySQL phpMyAdmin export.
- A private database subnet or NSG rule that allows MySQL only from the application VM.

Current Oracle pages to verify before creating resources:

- OCI Always Free resources: https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Oracle Cloud Free Tier overview: https://www.oracle.com/cloud/free/
- MySQL HeatWave Free Tier: https://www.oracle.com/mysql/free/

As of June 30, 2026, Oracle documents Always Free A1 as 2 OCPUs and 12 GB memory total for Always Free tenancies. Keep the VM at or under that limit unless the tenancy is upgraded and billing is expected.

## Required Inputs

You still need these before a complete deployment:

- Backend source repo or deployable artifact.
- Backend production environment variables.
- Real database schema/data export, preferably `db/creditplus_db.sql`.
- OCI account, SSH key, and optional domain name.

Do not rely on `.angular/cache/21.0.2/creditplus-focal/creditplus_db (2).sql` as the production source of truth. It is build cache, not a tracked database artifact.

## OCI Network

Create:

- One public subnet for the VM.
- One private subnet for MySQL, or a security group limiting MySQL access to the VM.
- VM ingress: `22/tcp` from your IP, `80/tcp` and `443/tcp` from the internet.
- No public ingress for backend port `8080` or MySQL port `3306`.

## Database

Create an OCI MySQL HeatWave Always Free DB system.

Import the SQL from your VM after you have a real export:

```bash
mysql -h <mysql-private-ip> -u <admin-user> -p -e "CREATE DATABASE IF NOT EXISTS creditplus_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -h <mysql-private-ip> -u <admin-user> -p creditplus_db < db/creditplus_db.sql
```

If the backend is not MySQL-compatible, use the backend's migration tool instead of importing the phpMyAdmin dump directly.

## VM Setup

On the OCI VM, install Docker and Compose. For Ubuntu images:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker compose version
```

Clone or copy both projects as sibling directories:

```bash
sudo mkdir -p /opt/creditplus
sudo chown "$USER":"$USER" /opt/creditplus
cd /opt/creditplus
git clone <frontend-repo-url> creditplus-focal
git clone <backend-repo-url> creditplus-api
cd creditplus-focal
cp .env.oci.example .env
```

Prepare the backend environment:

```bash
cd /opt/creditplus/creditplus-api
cp .env.oci.example .env.oci
```

Edit `/opt/creditplus/creditplus-api/.env.oci` and set the MySQL, JWT, public URL, and optional integration secrets.

Start frontend and backend together:

```bash
cd /opt/creditplus/creditplus-focal
docker compose -f docker-compose.oci.yml up -d --build
docker compose -f docker-compose.oci.yml logs -f
```

The frontend should now answer on:

```text
http://<vm-public-ip>/
```

## Backend

The backend container reads environment values from `/opt/creditplus/creditplus-api/.env.oci`.
At minimum set:

```bash
SPRING_DATASOURCE_URL=jdbc:mysql://<mysql-private-ip>:3306/creditplus_db
SPRING_DATASOURCE_USERNAME=<db-user>
SPRING_DATASOURCE_PASSWORD=<db-password>
SERVER_PORT=8080
SECURITY_JWT_SECRET=<long-random-secret>
```

Keep backend port `8080` private. The public browser traffic should enter through nginx on ports `80` and `443`, then nginx forwards `/api/*` and `/auth/*`.

## TLS

After the app works by IP, attach a domain and terminate HTTPS on the VM. The simplest path is Caddy or nginx plus Certbot on the host, forwarding to the frontend container on an internal port.

Example with Caddy:

```text
app.example.com {
  reverse_proxy 127.0.0.1:80
}
```

If Caddy binds public port `80`, set `WEB_PORT=8081` for the frontend container and proxy to `127.0.0.1:8081`.

## Image Publishing

The GitHub Actions workflow publishes multi-architecture images for:

- `ghcr.io/<owner>/creditplus-focal-web`
- `ghcr.io/<owner>/creditplus-focal-ssr`

Multi-architecture publishing matters because OCI A1 is Arm-based. You can also build directly on the VM with `docker compose up -d --build`.
