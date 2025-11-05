# SigNoz APM Setup

Access: https://projects.sapcindia.com/admin/signoz

## Deploy

```bash
chmod +x deploy-signoz.sh
./deploy-signoz.sh
```

## Manual Deploy

```bash
cd /opt/task-checker/task-tracker-app/infrastructure/docker
docker compose -f docker-compose.yml -f docker-compose.signoz.yml up -d
```

## Services

- **Frontend**: SigNoz UI at /admin/signoz
- **Query Service**: Metrics & traces API
- **ClickHouse**: Time-series database
- **OTel Collector**: Receives telemetry on ports 4317 (gRPC) and 4318 (HTTP)
- **AlertManager**: Alert routing

## Features

- Distributed tracing (HTTP, MongoDB, Redis)
- Metrics (CPU, memory, network, custom)
- Logs aggregation
- Service maps & dependencies
- Performance monitoring
- Error tracking

## Backend Integration

All services auto-instrumented via OpenTelemetry:
- task-tracker-backend (3 replicas)
- task-tracker-auth

## Stop SigNoz

```bash
docker compose -f docker-compose.yml -f docker-compose.signoz.yml down
```
