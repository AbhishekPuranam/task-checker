# Jaeger Distributed Tracing Setup

Access: https://projects.sapcindia.com/admin/jaeger

## Quick Deploy

```bash
chmod +x deploy-jaeger.sh
./deploy-jaeger.sh
```

## Manual Deployment

```bash
docker compose -f docker-compose.yml -f docker-compose.jaeger.yml up -d
```

## Architecture

- **Jaeger All-in-One**: Combined collector, query service, and UI
- **OTLP Receiver**: OpenTelemetry Protocol support (gRPC and HTTP)
- **Storage**: In-memory (for production, consider using Cassandra, Elasticsearch, or BadgerDB)

## Endpoints

- **UI**: https://projects.sapcindia.com/admin/jaeger
- **OTLP gRPC**: localhost:4317
- **OTLP HTTP**: localhost:4318
- **Health Check**: http://localhost:14269/
- **Metrics**: http://localhost:14269/metrics

## Application Configuration

Update your Node.js applications with these environment variables:

```bash
# OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_SERVICE_NAME=tasktracker-backend
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
```

## Stop Jaeger

```bash
docker compose -f docker-compose.yml -f docker-compose.jaeger.yml down
```

## Production Considerations

For production environments with high volume:

1. **Storage Backend**: Replace in-memory storage with:
   - Elasticsearch for better search capabilities
   - Cassandra for scalability
   - BadgerDB for embedded deployment

2. **Separate Components**: Split all-in-one into separate services:
   - Jaeger Collector (for ingestion)
   - Jaeger Query (for UI and API)
   - Jaeger Agent (optional, for client-side batching)

3. **Sampling**: Configure sampling strategies to reduce trace volume

Example production setup with Elasticsearch:

```yaml
jaeger-collector:
  image: jaegertracing/jaeger-collector:1.52
  environment:
    - SPAN_STORAGE_TYPE=elasticsearch
    - ES_SERVER_URLS=http://elasticsearch:9200

jaeger-query:
  image: jaegertracing/jaeger-query:1.52
  environment:
    - SPAN_STORAGE_TYPE=elasticsearch
    - ES_SERVER_URLS=http://elasticsearch:9200
```

## Monitoring

View Jaeger metrics:
```bash
curl http://localhost:14269/metrics
```

Check health:
```bash
curl http://localhost:14269/
```

## Troubleshooting

1. **Check logs**:
   ```bash
   docker logs tasktracker-jaeger
   ```

2. **Verify OTLP endpoint**:
   ```bash
   curl http://localhost:14269/
   ```

3. **Test trace submission**:
   ```bash
   # Install OpenTelemetry CLI tool and send a test trace
   ```

## Migration from SigNoz

Jaeger is fully compatible with OpenTelemetry exporters. No application code changes needed, just update the OTLP endpoint configuration.

Advantages:
- Simpler architecture (single container vs multiple)
- Lower resource usage
- Faster startup time
- Active CNCF project with strong community support
