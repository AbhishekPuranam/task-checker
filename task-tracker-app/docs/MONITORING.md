# Task Tracker - Monitoring and Logging Guide

## Overview

This guide covers the complete monitoring and logging infrastructure for the Task Tracker application, including:

- **Health Check Endpoints** - Granular service health monitoring
- **Uptime Kuma** - Uptime monitoring and alerting
- **OpenSearch + APM** - Centralized logging and performance monitoring
- **OpenTelemetry** - Distributed tracing

## Architecture

```
Application Services
    ↓
Health Endpoints (/health/*)
    ↓
┌─────────────┬─────────────┬─────────────┐
│  Uptime     │  OpenSearch │   APM       │
│  Kuma       │  Logs       │  Traces     │
└─────────────┴─────────────┴─────────────┘
```

## Health Check Endpoints

### Available Endpoints

| Endpoint | Purpose | Response Time | Checks |
|----------|---------|---------------|--------|
| `/health` | Basic health check | <100ms | API availability |
| `/health/detailed` | Comprehensive health | <2s | All dependencies |
| `/health/mongodb` | Database health | <500ms | MongoDB connection, latency, stats |
| `/health/redis` | Cache health | <200ms | Redis connection, memory |
| `/health/queues` | Background jobs | <1s | BullMQ queues, job counts |
| `/health/api` | API functionality | <2s | All models, query performance |

### Usage Examples

```bash
# Basic health check
curl http://62.72.56.99:5000/health

# Detailed health with all dependencies
curl http://62.72.56.99:5000/health/detailed

# MongoDB specific
curl http://62.72.56.99:5000/health/mongodb

# Redis specific
curl http://62.72.56.99:5000/health/redis

# BullMQ queues
curl http://62.72.56.99:5000/health/queues

# API endpoints
curl http://62.72.56.99:5000/health/api
```

### Response Formats

**Healthy Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "mongodb": {
      "status": "healthy",
      "latency": "15ms"
    },
    "redis": {
      "status": "healthy",
      "latency": "5ms"
    }
  }
}
```

**Degraded Response (200 OK):**
```json
{
  "status": "degraded",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "mongodb": {
      "status": "healthy"
    },
    "redis": {
      "status": "unhealthy",
      "error": "Connection timeout"
    }
  }
}
```

**Unhealthy Response (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "error": "MongoDB connection failed"
}
```

## Uptime Kuma Setup

### Access

- **URL:** http://62.72.56.99:3001
- **Username:** admin
- **Password:** Coreinme@789

### Automated Configuration

Run the configuration script to see monitor setup:

```bash
cd /opt/task-checker/task-tracker-app
node scripts/configure-uptime-monitors.js
```

Export JSON configuration:
```bash
node scripts/configure-uptime-monitors.js --json > monitors.json
```

### Manual Monitor Setup

#### 1. Overall Health Monitor

- **Name:** Task Tracker - Overall Health
- **Type:** HTTP(s)
- **URL:** http://tasktracker-app:5000/health/detailed
- **Interval:** 60 seconds
- **Max Retries:** 3
- **Retry Interval:** 60 seconds
- **Expected Status:** 200

#### 2. MongoDB Monitor

- **Name:** Task Tracker - MongoDB
- **Type:** HTTP(s)
- **URL:** http://tasktracker-app:5000/health/mongodb
- **Interval:** 60 seconds
- **Max Retries:** 3
- **Alert Threshold:** Critical (database failure affects all operations)

#### 3. Redis Monitor

- **Name:** Task Tracker - Redis Cache
- **Type:** HTTP(s)
- **URL:** http://tasktracker-app:5000/health/redis
- **Interval:** 60 seconds
- **Max Retries:** 3
- **Alert Threshold:** High (cache failure causes performance degradation)

#### 4. BullMQ Monitor

- **Name:** Task Tracker - BullMQ Queues
- **Type:** HTTP(s)
- **URL:** http://tasktracker-app:5000/health/queues
- **Interval:** 120 seconds
- **Max Retries:** 2
- **Alert Threshold:** Medium (queue issues affect background jobs)

#### 5. API Monitor

- **Name:** Task Tracker - API Endpoints
- **Type:** HTTP(s)
- **URL:** http://tasktracker-app:5000/health/api
- **Interval:** 120 seconds
- **Max Retries:** 2

#### 6. Admin Portal Monitor

- **Name:** Task Tracker - Admin Portal
- **Type:** HTTP(s)
- **URL:** http://62.72.56.99:3000
- **Interval:** 120 seconds
- **Max Retries:** 2
- **Alert Threshold:** High (user-facing interface)

### Notification Settings

Recommended notification channels:

1. **Email** - All monitors (immediate alerts)
2. **Slack/Discord** - Critical monitors only (MongoDB, Redis, Admin Portal)
3. **SMS** - Production-critical alerts (downtime > 5 minutes)

Notification rules:
- Send alert after 2 consecutive failures
- Send recovery notification
- Escalate after 5 minutes of downtime
- Send daily summary reports

## OpenSearch + APM Stack

### Deployment

```bash
cd /opt/task-checker/task-tracker-app
chmod +x infrastructure/docker/deploy-opensearch.sh
./infrastructure/docker/deploy-opensearch.sh
```

### Access

#### OpenSearch Dashboards
- **URL:** http://62.72.56.99:5601
- **Username:** admin
- **Password:** Admin@123456

#### OpenSearch API
- **URL:** http://62.72.56.99:9200
- **Username:** admin
- **Password:** Admin@123456

#### OpenTelemetry Collector
- **OTLP gRPC:** http://localhost:4317
- **OTLP HTTP:** http://localhost:4318
- **Health Check:** http://localhost:13133

#### APM Server
- **URL:** http://localhost:8200
- **Secret Token:** your-secret-token

### Index Patterns

Create these index patterns in OpenSearch Dashboards:

1. **logs-tasktracker-\*** - Application logs
2. **traces-tasktracker-\*** - Distributed traces
3. **apm-\*** - APM metrics and transactions

### Log Structure

All logs follow this structure:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "User login successful",
  "service": "auth-service",
  "container_name": "tasktracker-auth-1",
  "environment": "production",
  "userId": "12345",
  "action": "login",
  "duration": 150,
  "trace_id": "abc123..."
}
```

### Creating Visualizations

#### 1. Error Rate Dashboard

1. Go to OpenSearch Dashboards → Visualize
2. Create new visualization → Line Chart
3. Index pattern: `logs-tasktracker-*`
4. Y-axis: Count of documents where `level=ERROR`
5. X-axis: Date histogram (1 minute intervals)
6. Filter: Last 24 hours

#### 2. API Response Times

1. Create new visualization → Area Chart
2. Index pattern: `apm-*`
3. Y-axis: Average of `transaction.duration.us`
4. X-axis: Date histogram
5. Split series by: `transaction.name`

#### 3. Service Health Status

1. Create new visualization → Metric
2. Index pattern: `logs-tasktracker-*`
3. Aggregation: Count
4. Filters:
   - MongoDB status: `message:mongodb AND status:healthy`
   - Redis status: `message:redis AND status:healthy`
   - Queue status: `message:queue AND status:healthy`

### Querying Logs

Example queries in OpenSearch Dashboards:

```
# All errors in last hour
level:ERROR AND timestamp:[now-1h TO now]

# Slow API requests (>2 seconds)
service:backend-api AND duration:>2000

# Failed login attempts
action:login AND status:failed

# Background job failures
service:bullmq AND level:ERROR

# MongoDB connection issues
message:mongodb AND (error OR timeout OR failed)
```

## Application Integration

### Backend Service Logging

The backend services automatically send logs to OpenTelemetry:

```javascript
// Already configured in tracing.js
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');

// Traces sent to: http://otel-collector:4318/v1/traces
```

### Add Structured Logging

For enhanced logging, add to your backend services:

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { 
    service: 'backend-api',
    environment: process.env.NODE_ENV 
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.Http({
      host: 'otel-collector',
      port: 4318,
      path: '/v1/logs'
    })
  ]
});

// Usage
logger.info('User action completed', {
  userId: user.id,
  action: 'update_element',
  duration: 150
});
```

## Monitoring Best Practices

### 1. Alert Thresholds

| Service | Warning | Critical |
|---------|---------|----------|
| MongoDB | >100ms latency | Connection failed |
| Redis | >50ms latency | Connection failed |
| API | >2s response | >5s response |
| Queues | >20 failed jobs | >50 failed jobs |
| Disk | >80% usage | >95% usage |
| Memory | >80% usage | >95% usage |

### 2. Retention Policies

- **Logs:** 30 days (production), 7 days (development)
- **Traces:** 7 days
- **Metrics:** 90 days (aggregated after 30 days)
- **Health checks:** Real-time only

### 3. Regular Maintenance

Weekly tasks:
- Review error logs and trends
- Check queue health and clear stale jobs
- Verify all monitors are active
- Review alert notifications (false positives)

Monthly tasks:
- Update index lifecycle policies
- Archive old logs
- Review and update alert thresholds
- Performance tuning based on metrics

### 4. Incident Response

When alerts trigger:

1. **Check Overall Health:** `/health/detailed`
2. **Identify Component:** Use specific health endpoints
3. **Review Recent Logs:** OpenSearch Dashboards
4. **Check Related Services:** Uptime Kuma dashboard
5. **Verify Fix:** Monitor health endpoints

## Troubleshooting

### Health Endpoints Not Responding

```bash
# Check backend service
docker ps | grep tasktracker-app
docker logs docker-tasktracker-app-1

# Test locally inside container
docker exec docker-tasktracker-app-1 curl http://localhost:5000/health
```

### OpenSearch Not Starting

```bash
# Check vm.max_map_count
sysctl vm.max_map_count  # Should be 262144

# Set if needed
sudo sysctl -w vm.max_map_count=262144

# Check logs
docker logs opensearch
```

### No Logs Appearing

```bash
# Check Fluent Bit
docker logs fluent-bit

# Check OpenTelemetry Collector
docker logs otel-collector

# Verify connectivity
docker exec fluent-bit ping -c 3 opensearch
```

### High Memory Usage

```bash
# Check OpenSearch memory
curl -u admin:Admin@123456 http://localhost:9200/_cat/nodes?v

# Adjust JVM heap in docker-compose.opensearch.yml
OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
```

## Maintenance Commands

```bash
# Restart observability stack
docker-compose -f infrastructure/docker/docker-compose.opensearch.yml restart

# View logs
docker-compose -f infrastructure/docker/docker-compose.opensearch.yml logs -f

# Stop observability stack
docker-compose -f infrastructure/docker/docker-compose.opensearch.yml down

# Clean up old indices (keep last 30 days)
curl -u admin:Admin@123456 -X DELETE \
  "http://localhost:9200/logs-tasktracker-$(date -d '30 days ago' +%Y.%m.%d)"
```

## Performance Optimization

### 1. Index Management

```bash
# Create index lifecycle policy
curl -u admin:Admin@123456 -X PUT "http://localhost:9200/_ilm/policy/logs-policy" \
  -H 'Content-Type: application/json' \
  -d '{
    "policy": {
      "phases": {
        "hot": {
          "actions": {
            "rollover": {
              "max_age": "1d",
              "max_size": "50gb"
            }
          }
        },
        "delete": {
          "min_age": "30d",
          "actions": {
            "delete": {}
          }
        }
      }
    }
  }'
```

### 2. Query Optimization

- Use time-based filters for all queries
- Add specific field filters before full-text search
- Use aggregations instead of retrieving all documents
- Cache frequent queries

### 3. Resource Allocation

Recommended resources for production:

- **OpenSearch:** 2GB RAM, 2 CPU cores
- **Fluent Bit:** 256MB RAM, 0.5 CPU
- **OpenTelemetry:** 512MB RAM, 1 CPU
- **APM Server:** 512MB RAM, 1 CPU

## Security

### 1. Access Control

- Change default passwords immediately
- Use strong passwords (20+ characters)
- Enable TLS for production
- Restrict network access (firewall rules)

### 2. API Keys

Generate API keys for service-to-service communication:

```bash
curl -u admin:Admin@123456 -X POST "http://localhost:9200/_security/api_key" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "backend-api-key",
    "role_descriptors": {
      "writer": {
        "cluster": ["monitor"],
        "index": [
          {
            "names": ["logs-*", "traces-*"],
            "privileges": ["write", "create_index"]
          }
        ]
      }
    }
  }'
```

### 3. Audit Logging

Enable audit logging for security events:

```yaml
# Add to docker-compose.opensearch.yml
environment:
  - plugins.security.audit.type=internal_opensearch
  - plugins.security.audit.config.disabled_rest_categories=NONE
```

## Support

For issues or questions:

1. Check logs: `docker-compose logs [service-name]`
2. Review health endpoints: `/health/detailed`
3. Check OpenSearch Dashboards for errors
4. Review Uptime Kuma for downtime patterns
5. Contact DevOps team with detailed error information
