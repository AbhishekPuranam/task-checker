# OpenTelemetry Configuration for Coroot Monitoring

## Overview

This document describes the OpenTelemetry instrumentation setup for the Task Tracker application. All Node.js services are configured to export traces and metrics to Coroot for comprehensive observability.

## Instrumented Services

1. **Backend API** (`task-tracker-backend`)
   - All HTTP requests/responses
   - Express routes and middleware
   - MongoDB queries
   - Redis operations
   - Socket.IO events
   - File system operations
   - DNS lookups

2. **Auth Service** (`task-tracker-auth-service`)
   - Authentication endpoints
   - MongoDB user queries
   - JWT token operations

3. **Authorizer Service** (`task-tracker-authorizer`)
   - Authorization requests
   - Token validation
   - MongoDB lookups

## Telemetry Data Collected

### Traces
- **HTTP Requests**: Method, path, status code, duration, client IP, user agent
- **Database Queries**: Operation type, collection, query duration, document count
- **Express Routes**: Route patterns, middleware execution time
- **Redis Operations**: Commands, key patterns, latency
- **Custom Spans**: Business logic execution times

### Metrics
- **Request Metrics**: Request count, duration, error rate
- **Database Metrics**: Query count, slow queries, connection pool status
- **System Metrics**: CPU usage, memory usage, event loop lag
- **Custom Metrics**: Business KPIs, queue depths, cache hit rates

## Environment Variables

Configure OpenTelemetry behavior using these environment variables:

### Required
```bash
# Coroot collector endpoint (required for production)
OTEL_EXPORTER_OTLP_ENDPOINT=http://coroot-server:4318
```

### Optional
```bash
# Enable/disable telemetry (default: enabled)
OTEL_ENABLED=true

# Service name override (defaults set per service)
OTEL_SERVICE_NAME=task-tracker-backend

# Enable/disable traces (default: enabled)
OTEL_TRACES_ENABLED=true

# Enable/disable metrics (default: enabled)
OTEL_METRICS_ENABLED=true

# Metrics export interval in milliseconds (default: 60000)
OTEL_METRICS_INTERVAL=60000

# Deployment environment
NODE_ENV=production
```

## Docker Compose Configuration

### Development Environment

Add to `.env` file:
```bash
# OpenTelemetry Configuration
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://coroot-collector:4318
OTEL_TRACES_ENABLED=true
OTEL_METRICS_ENABLED=true
OTEL_METRICS_INTERVAL=60000
```

Add to `docker-compose.dev.yml`:
```yaml
services:
  backend:
    environment:
      - OTEL_ENABLED=${OTEL_ENABLED:-true}
      - OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT}
      - OTEL_SERVICE_NAME=task-tracker-backend
      - OTEL_TRACES_ENABLED=${OTEL_TRACES_ENABLED:-true}
      - OTEL_METRICS_ENABLED=${OTEL_METRICS_ENABLED:-true}
      - NODE_ENV=development

  auth-service:
    environment:
      - OTEL_ENABLED=${OTEL_ENABLED:-true}
      - OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT}
      - OTEL_SERVICE_NAME=task-tracker-auth-service
      - OTEL_TRACES_ENABLED=${OTEL_TRACES_ENABLED:-true}
      - OTEL_METRICS_ENABLED=${OTEL_METRICS_ENABLED:-true}

  authorizer:
    environment:
      - OTEL_ENABLED=${OTEL_ENABLED:-true}
      - OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT}
      - OTEL_SERVICE_NAME=task-tracker-authorizer
      - OTEL_TRACES_ENABLED=${OTEL_TRACES_ENABLED:-true}
      - OTEL_METRICS_ENABLED=${OTEL_METRICS_ENABLED:-true}
```

## Coroot Setup

### Install Coroot on Monitoring Server

```bash
# Using Docker
docker run -d \
  --name coroot \
  -p 8080:8080 \
  -p 4318:4318 \
  -v coroot-data:/data \
  --restart unless-stopped \
  ghcr.io/coroot/coroot
```

### Configure Coroot Collector

The Coroot collector listens on port 4318 for OTLP HTTP data. Ensure this port is accessible from your application servers.

### Network Configuration

If Coroot is on a separate machine:

1. **Open firewall port 4318** on the monitoring server
2. **Update OTEL_EXPORTER_OTLP_ENDPOINT** to point to the monitoring server:
   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=http://monitoring-server-ip:4318
   ```

### Docker Network Bridge (if needed)

If running Coroot and applications on the same Docker host but different compose files:

```bash
# Create shared network
docker network create monitoring-network

# Add to application docker-compose.yml
networks:
  default:
    external:
      name: monitoring-network

# Add to Coroot docker-compose.yml
networks:
  default:
    external:
      name: monitoring-network
```

## Testing Telemetry

### 1. Verify OpenTelemetry Initialization

Check service logs for initialization messages:

```bash
# Backend API
docker logs tasktracker-app-dev | grep OpenTelemetry

# Expected output:
# [OpenTelemetry] Initialized for service: task-tracker-backend
# [OpenTelemetry] Exporting to: http://coroot-collector:4318
# [OpenTelemetry] Traces: enabled
# [OpenTelemetry] Metrics: enabled
```

### 2. Generate Test Traffic

```bash
# Generate authentication requests
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Generate API requests
curl http://localhost/api/projects
curl http://localhost/api/users
```

### 3. Verify Data in Coroot

1. Open Coroot UI: `http://monitoring-server-ip:8080`
2. Navigate to **Services** view
3. Verify services appear:
   - `task-tracker-backend`
   - `task-tracker-auth-service`
   - `task-tracker-authorizer`
4. Check traces and metrics are being received

## Custom Instrumentation

### Adding Custom Spans

```javascript
const { trace } = require('@opentelemetry/api');

async function processBusinessLogic() {
  const tracer = trace.getTracer('task-tracker-backend');
  const span = tracer.startSpan('process-business-logic');
  
  try {
    span.setAttribute('user.id', userId);
    span.setAttribute('operation', 'create-project');
    
    // Your business logic here
    const result = await doSomething();
    
    span.setStatus({ code: 0 }); // SUCCESS
    return result;
  } catch (error) {
    span.setStatus({ code: 2, message: error.message }); // ERROR
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

### Adding Custom Metrics

```javascript
const { metrics } = require('@opentelemetry/api');

const meter = metrics.getMeter('task-tracker-backend');

// Counter for business events
const projectCounter = meter.createCounter('projects.created', {
  description: 'Number of projects created',
});

// Histogram for durations
const uploadDuration = meter.createHistogram('upload.duration', {
  description: 'Excel upload processing time',
  unit: 'ms',
});

// Usage
projectCounter.add(1, { user_role: 'admin' });
uploadDuration.record(performanceNow() - startTime, { file_type: 'excel' });
```

## Performance Impact

OpenTelemetry instrumentation has minimal performance overhead:

- **CPU**: < 2% additional CPU usage
- **Memory**: ~20-30MB per service
- **Latency**: < 1ms added to request processing
- **Network**: ~1KB per trace, ~0.5KB per metric export

### Optimize for Production

1. **Sample traces** to reduce volume:
   ```javascript
   // In tracing.js
   const { TraceIdRatioBasedSampler } = require('@opentelemetry/sdk-trace-node');
   
   const sdk = new NodeSDK({
     // ... other config
     spanProcessor: new BatchSpanProcessor(traceExporter),
     sampler: new TraceIdRatioBasedSampler(0.1), // Sample 10% of traces
   });
   ```

2. **Adjust metric interval** for less frequent exports:
   ```bash
   OTEL_METRICS_INTERVAL=300000  # 5 minutes
   ```

3. **Disable in development** if needed:
   ```bash
   OTEL_ENABLED=false
   ```

## Troubleshooting

### No Data in Coroot

1. **Check service logs** for initialization errors:
   ```bash
   docker logs tasktracker-app-dev 2>&1 | grep -i "opentelemetry\|error"
   ```

2. **Verify network connectivity**:
   ```bash
   # From application container
   docker exec tasktracker-app-dev curl -v http://coroot-collector:4318/v1/traces
   ```

3. **Check Coroot collector logs**:
   ```bash
   docker logs coroot
   ```

4. **Verify environment variables**:
   ```bash
   docker exec tasktracker-app-dev env | grep OTEL
   ```

### High Memory Usage

If OpenTelemetry causes memory issues:

1. Reduce batch sizes:
   ```javascript
   // In tracing.js
   const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-node');
   
   new BatchSpanProcessor(traceExporter, {
     maxQueueSize: 100,
     maxExportBatchSize: 10,
   })
   ```

2. Increase metric interval:
   ```bash
   OTEL_METRICS_INTERVAL=120000  # 2 minutes
   ```

### Traces Not Appearing

1. **Verify trace export** is enabled:
   ```bash
   OTEL_TRACES_ENABLED=true
   ```

2. **Check for sampling** - ensure critical paths aren't being sampled out

3. **Verify OTLP endpoint** is correct and reachable

## Security Considerations

### Authentication (if needed)

Add authentication headers to exporters:

```javascript
// In tracing.js
const traceExporter = new OTLPTraceExporter({
  url: `${OTEL_ENDPOINT}/v1/traces`,
  headers: {
    'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`,
  },
});
```

### TLS/SSL

For production, use HTTPS endpoints:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://coroot-server:4318
```

### Sensitive Data

Avoid logging sensitive data in spans:
- Passwords, API keys, tokens
- Personal identifiable information (PII)
- Credit card numbers

The current configuration filters out sensitive headers automatically.

## Production Deployment Checklist

- [ ] Install npm packages: `npm install` in all service directories
- [ ] Set `OTEL_EXPORTER_OTLP_ENDPOINT` to Coroot server address
- [ ] Configure firewall to allow port 4318 from app servers to monitoring server
- [ ] Set `NODE_ENV=production`
- [ ] Configure trace sampling for high-traffic endpoints
- [ ] Test telemetry connectivity before full deployment
- [ ] Set up Coroot dashboards and alerts
- [ ] Document Coroot access for team
- [ ] Configure backup/retention for telemetry data
- [ ] Set up log aggregation alongside metrics

## Coroot Dashboard Examples

### Service Health Dashboard
- Request rate (requests/sec)
- Error rate (%)
- P50, P95, P99 latency
- CPU and memory usage
- Active database connections

### Database Performance
- Query count by collection
- Slow queries (> 100ms)
- Connection pool utilization
- Query error rate

### Business Metrics
- User logins per hour
- Projects created per day
- File uploads success rate
- Task completion rate

## Support and Resources

- **Coroot Documentation**: https://coroot.com/docs
- **OpenTelemetry Docs**: https://opentelemetry.io/docs/
- **Node.js Instrumentation**: https://opentelemetry.io/docs/instrumentation/js/

## Next Steps

1. Install dependencies: `npm install` in each service directory
2. Configure environment variables in `.env` or docker-compose
3. Deploy Coroot on monitoring server
4. Start services and verify telemetry in Coroot UI
5. Create custom dashboards for your key metrics
6. Set up alerts for critical thresholds
