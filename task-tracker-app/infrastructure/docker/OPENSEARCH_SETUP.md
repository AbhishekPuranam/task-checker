# OpenSearch Monitoring Setup

This setup provides comprehensive log monitoring with **separate index patterns and dashboards** for each microservice using OpenSearch, Vector, and OpenSearch Dashboards.

## Architecture

```
Docker Containers → Vector Log Collector → OpenSearch → OpenSearch Dashboards
```

### Components

1. **OpenSearch** - Search and analytics engine for logs
2. **OpenSearch Dashboards** - Visualization and analytics UI
3. **Vector** - High-performance log collector and router

## Features

✅ **Separate index per service** - Each service has its own index pattern
✅ **Individual dashboards** - Dedicated dashboard for each microservice
✅ **Combined overview** - Single dashboard showing all services
✅ **Automatic log parsing** - JSON log parsing and field extraction
✅ **Log level detection** - Automatic error/warn/info classification
✅ **Time-based indices** - Daily index rotation for better performance

## Services Monitored

### Backend Microservices
- `auth-service` - Authentication & Authorization
- `excel-service` - Excel upload & batch processing
- `project-service` - Project management
- `subproject-service` - SubProject management
- `structural-elements-service` - Structural elements (3 replicas)
- `jobs-service` - Job management (3 replicas)
- `metrics-service` - Reports & analytics

### Infrastructure Services
- `mongodb` - Database
- `redis` - Cache & BullMQ
- `traefik` - Reverse proxy
- `vault` - Secret management
- `uptime-kuma` - Uptime monitoring

## Index Patterns

Each service has its own index pattern:

```
logs-auth-service-*
logs-excel-service-*
logs-project-service-*
logs-subproject-service-*
logs-structural-elements-service-*
logs-jobs-service-*
logs-metrics-service-*
logs-mongodb-*
logs-redis-*
logs-traefik-*
logs-vault-*
logs-uptime-kuma-*
```

Indices are created daily with format: `logs-{service}-YYYY.MM.DD`

## Deployment

### 1. Deploy OpenSearch Stack

```bash
cd /opt/task-checker/task-tracker-app/infrastructure/docker
chmod +x deploy-opensearch.sh
./deploy-opensearch.sh
```

This will:
- Start OpenSearch, OpenSearch Dashboards, and Vector
- Wait for services to be healthy
- Create index patterns for each service
- Create individual dashboards for each service
- Create a combined overview dashboard

### 2. Verify Deployment

```bash
# Check service status
docker compose -f docker-compose.opensearch.yml ps

# Check OpenSearch health
curl -u admin:Admin@123456 http://localhost:9200/_cluster/health

# Check indices
curl -u admin:Admin@123456 http://localhost:9200/_cat/indices/logs-*

# View Vector logs
docker compose -f docker-compose.opensearch.yml logs -f vector
```

### 3. Access Dashboards

Open your browser and navigate to:
```
http://localhost:5601
```

Or for production:
```
http://62.72.56.99:5601
```

**Credentials:**
- Username: `admin`
- Password: `Admin@123456`

## Using OpenSearch Dashboards

### View Service-Specific Logs

1. Go to **Dashboards** in the left menu
2. Select the dashboard for your service (e.g., "auth-service Logs Dashboard")
3. Adjust time range as needed

### Search Logs

1. Go to **Discover** in the left menu
2. Select the index pattern for your service
3. Use the search bar with KQL (Kibana Query Language):

```
# Find errors in auth service
level: "error"

# Find specific message
message: *login*

# Combine conditions
level: "error" AND service_name: "auth-service"

# Time range
timestamp >= "2025-11-09T00:00:00"
```

### Create Custom Visualizations

1. Go to **Visualize** in the left menu
2. Click **Create visualization**
3. Select visualization type (line chart, pie chart, etc.)
4. Select your index pattern
5. Configure metrics and buckets
6. Save and add to dashboard

### Common Queries

```
# All errors across services
level: "error"

# Specific service logs
service_name: "excel-service"

# Multiple services
service_name: ("auth-service" OR "project-service")

# Message contains keyword
message: *upload* OR message: *batch*

# Exclude info logs
NOT level: "info"

# Time-based
timestamp >= now-1h
```

## Vector Configuration

Vector routes logs based on container name to separate indices:

- Collects logs from Docker containers
- Enriches with timestamp, service name, and log level
- Parses JSON logs automatically
- Routes to service-specific indices in OpenSearch

Configuration file: `vector/vector.toml`

## Index Management

### Index Retention

Indices are created daily. To manage retention:

```bash
# Delete old indices (older than 30 days)
curl -X DELETE -u admin:Admin@123456 \
  "http://localhost:9200/logs-*-$(date -d '30 days ago' +%Y.%m.%d)"

# Create Index State Management policy (via Dashboards UI)
# Go to Index Management → State management policies
```

### Index Stats

```bash
# View all indices
curl -u admin:Admin@123456 http://localhost:9200/_cat/indices/logs-*?v

# View specific service indices
curl -u admin:Admin@123456 http://localhost:9200/_cat/indices/logs-auth-service-*?v

# Index size
curl -u admin:Admin@123456 http://localhost:9200/_cat/indices/logs-*?v&h=index,store.size
```

## Troubleshooting

### No Logs Appearing

1. Check Vector is running:
```bash
docker compose -f docker-compose.opensearch.yml logs vector
```

2. Verify container names match Vector config:
```bash
docker ps --format "{{.Names}}"
```

3. Check OpenSearch connectivity:
```bash
curl -u admin:Admin@123456 http://localhost:9200/_cluster/health
```

### Index Pattern Not Found

Run the setup script manually:
```bash
./setup-opensearch-dashboards.sh
```

### High Memory Usage

Adjust OpenSearch JVM settings in `docker-compose.opensearch.yml`:
```yaml
environment:
  - "OPENSEARCH_JAVA_OPTS=-Xms1g -Xmx1g"  # Reduce from 2g to 1g
```

### Vector Not Collecting Logs

1. Check Vector has access to Docker socket:
```bash
docker compose -f docker-compose.opensearch.yml exec vector ls -la /var/run/docker.sock
```

2. Enable debug logging in `vector/vector.toml`:
```toml
[sinks.console]
type = "console"
inputs = ["enrich"]
encoding.codec = "json"
```

## Maintenance

### Backup

```bash
# Backup OpenSearch data
docker run --rm \
  -v tasktracker-opensearch-data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/opensearch-backup-$(date +%Y%m%d).tar.gz /data
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.opensearch.yml restart

# Restart specific service
docker compose -f docker-compose.opensearch.yml restart opensearch
docker compose -f docker-compose.opensearch.yml restart vector
```

### Update Configuration

After updating `vector/vector.toml`:
```bash
docker compose -f docker-compose.opensearch.yml restart vector
```

## Production Deployment

### On Production Server

```bash
# SSH to production
ssh root@62.72.56.99

# Navigate to project
cd /opt/task-checker/task-tracker-app

# Pull latest changes
git pull origin main

# Navigate to infrastructure
cd infrastructure/docker

# Deploy
./deploy-opensearch.sh
```

### Secure Access

For production, consider:

1. **Firewall rules** - Restrict ports 9200 and 5601
2. **Strong passwords** - Change default admin password
3. **TLS/SSL** - Enable HTTPS
4. **Authentication** - Configure proper user roles

## Monitoring Metrics

Track these metrics in OpenSearch:

- **Log volume per service** - Logs/minute
- **Error rate** - Errors/total logs
- **Response times** - From Traefik logs
- **Resource usage** - From container logs
- **Job queue status** - From BullMQ logs

## Integration with Existing Services

The OpenSearch stack runs independently alongside your microservices. Vector automatically collects logs from:

- All containers in `docker-compose.microservices.yml`
- Log files in `/opt/task-checker/task-tracker-app/logs/`

No changes needed to existing services!

## Support

For issues or questions:
- Check logs: `docker compose -f docker-compose.opensearch.yml logs`
- OpenSearch docs: https://opensearch.org/docs/
- Vector docs: https://vector.dev/docs/
