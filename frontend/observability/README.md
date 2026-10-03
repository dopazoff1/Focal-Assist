# Focal Observability

Local Grafana stack for frontend and backend analysis:

- Grafana: dashboards and log search
- Prometheus: Spring Boot metrics from `/actuator/prometheus`
- Loki: centralized logs
- Alloy: collects frontend/backend `.log` files and matching Docker container logs

## Start

From `C:\Users\asus\focal\focal-assist`:

```powershell
docker compose -f .\observability\docker-compose.yml up -d
```

Open:

- Grafana: http://localhost:3000, login `admin` / `admin`
- Prometheus: http://localhost:9090
- Loki ready check: http://localhost:3100/ready
- Alloy pipeline UI: http://localhost:12345

If the backend repo moves, set `BACKEND_REPO` before starting:

```powershell
$env:BACKEND_REPO = 'C:/Users/asus/eclipse-workspace/focal-assist-api'
docker compose -f .\observability\docker-compose.yml up -d
```

## Run Apps With Logs

Frontend:

```powershell
cd C:\Users\asus\focal\focal-assist
npm run start:dev 2>&1 | Tee-Object -FilePath .\logs\frontend-4200.log
```

Backend:

```powershell
cd C:\Users\asus\eclipse-workspace\focal-assist-api
.\mvnw.cmd spring-boot:run 2>&1 | Tee-Object -FilePath .\backend-run.log
```

## Useful Grafana Queries

Backend request activity:

```logql
{app="focal-assist-api"} |= "http_request"
```

Frontend logs:

```logql
{component="frontend"}
```

Errors and warnings:

```logql
{component=~"frontend|backend"} |~ "(?i)(error|exception|failed|warn)"
```

Request correlation:

1. Open browser DevTools.
2. Click an API call in the Network tab.
3. Copy its `X-Request-Id` request header.
4. Search that value in Grafana Explore with Loki.

## Verify Backend Metrics

After restarting the backend:

```powershell
Invoke-WebRequest http://localhost:8080/actuator/prometheus
```

Prometheus should show target `focal-assist-api` as `UP` at:

```text
http://localhost:9090/targets
```
