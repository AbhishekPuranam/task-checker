# Monitoring Setup Guide - Coroot Installation and Configuration

**For: Monitoring Team**  
**Date: October 30, 2025**  
**Application: Task Tracker System**

---

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Coroot Installation](#coroot-installation)
4. [Network Configuration](#network-configuration)
5. [Application Configuration](#application-configuration)
6. [Verification Steps](#verification-steps)
7. [Dashboard Setup](#dashboard-setup)
8. [Alerting Configuration](#alerting-configuration)
9. [Maintenance](#maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for the monitoring team to set up Coroot for monitoring the Task Tracker application. Coroot will collect telemetry data (traces, metrics, logs) from three Node.js microservices.

### Services to Monitor
- **Backend API** (`task-tracker-backend`) - Port 5000
- **Auth Service** (`task-tracker-auth-service`) - Port 5001
- **Authorizer Service** (`task-tracker-authorizer`) - Port 5002

### Telemetry Data
- **Traces**: Request flows, distributed tracing, latency analysis
- **Metrics**: CPU, memory, request rates, error rates, database performance
- **Logs**: Application logs (future integration)

---

## Prerequisites

### Hardware Requirements
- **CPU**: 2 cores minimum, 4 cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 50GB minimum (for telemetry data storage)
- **OS**: Linux (Ubuntu 20.04+, CentOS 8+, Debian 11+) or macOS

### Software Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+ (optional, for easier management)
- Network access from application servers to monitoring server
- Port 4318 (OTLP collector) and 8080 (Coroot UI) available

### Network Access
- Monitoring server must be reachable from application servers
- Firewall rules configured to allow:
  - Port **4318/tcp** - OpenTelemetry OTLP HTTP endpoint
  - Port **8080/tcp** - Coroot web UI (restrict to internal network)

---

## Coroot Installation

### Option 1: Docker Run (Quick Start)

```bash
# Create data directory
sudo mkdir -p /var/lib/coroot
sudo chown $(id -u):$(id -g) /var/lib/coroot

# Run Coroot container
docker run -d \
  --name coroot \
  --hostname coroot-server \
  -p 8080:8080 \
  -p 4318:4318 \
  -v /var/lib/coroot:/data \
  --restart unless-stopped \
  --memory 4g \
  --cpus 2 \
  ghcr.io/coroot/coroot:latest

# Verify container is running
docker ps | grep coroot

# Check logs
docker logs coroot
```

### Option 2: Docker Compose (Recommended)

Create `/opt/coroot/docker-compose.yml`:

```yaml
version: '3.8'

services:
  coroot:
    image: ghcr.io/coroot/coroot:latest
    container_name: coroot
    hostname: coroot-server
    restart: unless-stopped
    ports:
      - "8080:8080"   # Coroot UI
      - "4318:4318"   # OTLP HTTP receiver
    volumes:
      - coroot-data:/data
    environment:
      - COROOT_DISABLE_USAGE_STATISTICS=false
      - COROOT_PG_CONNECTION_STRING=  # Optional: external PostgreSQL
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  coroot-data:
    driver: local
```

Deploy:
```bash
# Create directory
sudo mkdir -p /opt/coroot
cd /opt/coroot

# Save docker-compose.yml (paste content above)
sudo nano docker-compose.yml

# Start Coroot
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Option 3: Kubernetes (For Production)

```yaml
# coroot-deployment.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coroot
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: coroot
  template:
    metadata:
      labels:
        app: coroot
    spec:
      containers:
      - name: coroot
        image: ghcr.io/coroot/coroot:latest
        ports:
        - containerPort: 8080
          name: ui
        - containerPort: 4318
          name: otlp-http
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 2000m
            memory: 4Gi
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: coroot-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: coroot
  namespace: monitoring
spec:
  type: LoadBalancer
  ports:
  - port: 8080
    targetPort: 8080
    name: ui
  - port: 4318
    targetPort: 4318
    name: otlp-http
  selector:
    app: coroot
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: coroot-pvc
  namespace: monitoring
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
```

Deploy:
```bash
kubectl apply -f coroot-deployment.yaml
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

---

## Network Configuration

### 1. Firewall Rules

#### Ubuntu/Debian (UFW)
```bash
# Allow OTLP collector from application servers
sudo ufw allow from <APP_SERVER_IP> to any port 4318 proto tcp comment "Coroot OTLP"

# Allow UI access from internal network
sudo ufw allow from 192.168.0.0/16 to any port 8080 proto tcp comment "Coroot UI"

# Verify rules
sudo ufw status numbered
```

#### CentOS/RHEL (firewalld)
```bash
# Add ports
sudo firewall-cmd --permanent --add-port=4318/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp

# Reload firewall
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-all
```

#### Cloud Provider Security Groups

**AWS**:
- Add inbound rule: Custom TCP, Port 4318, Source: Application Security Group
- Add inbound rule: Custom TCP, Port 8080, Source: Internal VPC CIDR

**Azure**:
- Add inbound rule: TCP/4318 from Application Subnet
- Add inbound rule: TCP/8080 from Management Subnet

**GCP**:
- Create firewall rule allowing tcp:4318 from application instances
- Create firewall rule allowing tcp:8080 from internal network

### 2. DNS Configuration (Optional)

Add DNS record for easier access:
```bash
# Add to DNS or /etc/hosts on application servers
echo "<MONITORING_SERVER_IP>  coroot.internal.company.com" | sudo tee -a /etc/hosts
```

### 3. Test Network Connectivity

From application server:
```bash
# Test OTLP endpoint
curl -v http://<MONITORING_SERVER_IP>:4318/v1/traces

# Test UI access
curl -I http://<MONITORING_SERVER_IP>:8080

# Test with telnet
telnet <MONITORING_SERVER_IP> 4318
telnet <MONITORING_SERVER_IP> 8080
```

---

## Application Configuration

### Environment Variables for Application Servers

Create or update `/path/to/task-tracker-app/.env`:

```bash
# OpenTelemetry Configuration
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://<MONITORING_SERVER_IP>:4318
OTEL_TRACES_ENABLED=true
OTEL_METRICS_ENABLED=true
OTEL_METRICS_INTERVAL=60000

# Node.js Environment
NODE_ENV=production
```

**Replace `<MONITORING_SERVER_IP>` with actual IP or hostname**

### Docker Compose Configuration

The application team should update `infrastructure/docker/docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - OTEL_ENABLED=true
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://<MONITORING_SERVER_IP>:4318
      - OTEL_SERVICE_NAME=task-tracker-backend
      - OTEL_TRACES_ENABLED=true
      - OTEL_METRICS_ENABLED=true
      - NODE_ENV=production

  auth-service:
    environment:
      - OTEL_ENABLED=true
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://<MONITORING_SERVER_IP>:4318
      - OTEL_SERVICE_NAME=task-tracker-auth-service
      - OTEL_TRACES_ENABLED=true
      - OTEL_METRICS_ENABLED=true

  authorizer:
    environment:
      - OTEL_ENABLED=true
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://<MONITORING_SERVER_IP>:4318
      - OTEL_SERVICE_NAME=task-tracker-authorizer
      - OTEL_TRACES_ENABLED=true
      - OTEL_METRICS_ENABLED=true
```

### Coordinate with Application Team

Provide the following information to the application team:

📋 **Configuration Details**
```
Coroot OTLP Endpoint: http://<MONITORING_SERVER_IP>:4318
Coroot UI URL: http://<MONITORING_SERVER_IP>:8080
Required Environment Variable: OTEL_EXPORTER_OTLP_ENDPOINT=http://<MONITORING_SERVER_IP>:4318
```

---

## Verification Steps

### 1. Verify Coroot is Running

```bash
# Check container status
docker ps | grep coroot

# Expected output:
# coroot    ghcr.io/coroot/coroot:latest    Up X minutes    0.0.0.0:4318->4318/tcp, 0.0.0.0:8080->8080/tcp

# Check logs for errors
docker logs coroot --tail 100

# Check resource usage
docker stats coroot --no-stream
```

### 2. Access Coroot UI

Open browser and navigate to:
```
http://<MONITORING_SERVER_IP>:8080
```

You should see the Coroot dashboard. Initially it will be empty until applications start sending data.

### 3. Test OTLP Endpoint

From monitoring server:
```bash
# Test OTLP HTTP endpoint
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "resourceSpans": [{
      "resource": {"attributes": []},
      "scopeSpans": [{
        "scope": {"name": "test"},
        "spans": []
      }]
    }]
  }'

# Expected: 200 OK or similar success response
```

### 4. Generate Test Traffic (After Application Configuration)

Request the application team to run test traffic:

```bash
# From application server
curl -X POST http://app-server/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"testpass"}'

curl http://app-server/api/projects
curl http://app-server/api/users
```

### 5. Verify Telemetry Data

In Coroot UI:

1. **Navigate to Services**
   - Should see: `task-tracker-backend`, `task-tracker-auth-service`, `task-tracker-authorizer`
   - Each service should show metrics: requests/sec, latency, error rate

2. **Check Traces**
   - Click on a service
   - View "Traces" tab
   - Should see individual request traces

3. **Check Metrics**
   - View CPU, memory, request rates
   - Should see real-time data updating

### 6. Verification Checklist

- [ ] Coroot container is running and healthy
- [ ] Port 4318 is accessible from application servers
- [ ] Port 8080 is accessible from internal network
- [ ] Coroot UI loads successfully
- [ ] All 3 services appear in Coroot
- [ ] Traces are being received
- [ ] Metrics are being received
- [ ] No errors in Coroot logs
- [ ] Resource usage is within limits (< 4GB RAM, < 2 CPU cores)

---

## Dashboard Setup

### 1. Create Service Health Dashboard

In Coroot UI:

1. Navigate to **Dashboards** → **Create Dashboard**
2. Add panels:

**Panel 1: Request Rate**
- Metric: `http.server.request.count`
- Aggregation: Rate per second
- Group by: `service.name`

**Panel 2: Latency (P95)**
- Metric: `http.server.duration`
- Aggregation: P95
- Group by: `service.name`

**Panel 3: Error Rate**
- Metric: `http.server.request.count`
- Filter: `http.status_code >= 400`
- Aggregation: Rate / Total Rate
- Group by: `service.name`

**Panel 4: CPU Usage**
- Metric: `system.cpu.utilization`
- Aggregation: Average
- Group by: `service.name`

**Panel 5: Memory Usage**
- Metric: `process.runtime.nodejs.memory.heap.used`
- Aggregation: Average
- Group by: `service.name`

3. Save dashboard as **"Task Tracker - Service Health"**

### 2. Create Database Performance Dashboard

**Panel 1: Query Count**
- Metric: `db.client.operation.count`
- Group by: `db.operation`, `db.collection.name`

**Panel 2: Slow Queries**
- Metric: `db.client.operation.duration`
- Filter: `duration > 100ms`
- Aggregation: Count

**Panel 3: Connection Pool**
- Metric: `db.client.connections.usage`
- Group by: `state` (idle, active)

### 3. Create Business Metrics Dashboard

**Panel 1: User Logins**
- Metric: Custom trace count
- Filter: `http.route = /api/auth/login`, `http.status_code = 200`
- Aggregation: Count per hour

**Panel 2: API Endpoints Usage**
- Metric: `http.server.request.count`
- Group by: `http.route`
- Top 10 endpoints

---

## Alerting Configuration

### 1. Configure Notification Channels

In Coroot UI → **Alerting** → **Notification Channels**:

**Email**:
```yaml
Type: Email
SMTP Host: smtp.company.com
SMTP Port: 587
From: monitoring@company.com
To: ops-team@company.com, dev-team@company.com
```

**Slack**:
```yaml
Type: Slack
Webhook URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
Channel: #monitoring-alerts
Username: Coroot
```

**PagerDuty**:
```yaml
Type: PagerDuty
Integration Key: <YOUR_INTEGRATION_KEY>
```

### 2. Create Alert Rules

#### High Error Rate Alert
```yaml
Name: High Error Rate - Task Tracker
Condition: http.server.error.rate > 5%
Duration: 5 minutes
Severity: Critical
Notification: Email, Slack, PagerDuty
Message: "Error rate for {{service.name}} is {{value}}%"
```

#### High Latency Alert
```yaml
Name: High Latency - Task Tracker
Condition: http.server.duration.p95 > 1000ms
Duration: 5 minutes
Severity: Warning
Notification: Email, Slack
Message: "P95 latency for {{service.name}} is {{value}}ms"
```

#### Service Down Alert
```yaml
Name: Service Unavailable - Task Tracker
Condition: http.server.request.count = 0
Duration: 2 minutes
Severity: Critical
Notification: Email, Slack, PagerDuty
Message: "Service {{service.name}} is not receiving requests"
```

#### High Memory Usage Alert
```yaml
Name: High Memory Usage
Condition: process.runtime.nodejs.memory.heap.used > 80% of limit
Duration: 10 minutes
Severity: Warning
Notification: Email, Slack
Message: "Memory usage for {{service.name}} is {{value}}%"
```

#### Database Slow Queries Alert
```yaml
Name: Database Slow Queries
Condition: db.client.operation.duration.p95 > 500ms
Duration: 5 minutes
Severity: Warning
Notification: Email
Message: "Slow database queries detected for {{service.name}}"
```

### 3. Test Alerts

```bash
# Trigger test alert
# From Coroot UI: Alerting → Test Notification

# Or generate load to trigger thresholds
ab -n 10000 -c 100 http://app-server/api/projects
```

---

## Maintenance

### Daily Tasks

```bash
# Check Coroot container health
docker ps | grep coroot
docker stats coroot --no-stream

# Check disk usage
df -h /var/lib/coroot
du -sh /var/lib/coroot/*

# Review logs for errors
docker logs coroot --since 24h | grep -i error
```

### Weekly Tasks

```bash
# Review telemetry data volume
docker exec coroot du -sh /data

# Check for updates
docker pull ghcr.io/coroot/coroot:latest

# Backup Coroot data (if needed)
tar -czf coroot-backup-$(date +%Y%m%d).tar.gz /var/lib/coroot/

# Review alert history
# Via Coroot UI: Alerting → Alert History
```

### Monthly Tasks

- Review and optimize alert rules based on false positives/negatives
- Archive old telemetry data if storage is limited
- Update Coroot to latest version
- Review dashboard effectiveness with teams
- Capacity planning for telemetry data growth

### Data Retention

Configure retention in Coroot:

```bash
# In docker-compose.yml or as environment variable
COROOT_DATA_RETENTION_DAYS=30  # Keep 30 days of data
```

Or manually clean old data:
```bash
# Find and remove data older than 30 days
docker exec coroot find /data -type f -mtime +30 -delete
```

### Backup Strategy

```bash
#!/bin/bash
# Automated backup script - /opt/coroot/backup.sh

BACKUP_DIR="/backup/coroot"
DATE=$(date +%Y%m%d)

# Create backup directory
mkdir -p $BACKUP_DIR

# Stop Coroot (optional, for consistent backup)
# docker-compose -f /opt/coroot/docker-compose.yml stop

# Backup data
tar -czf $BACKUP_DIR/coroot-data-$DATE.tar.gz /var/lib/coroot/

# Restart Coroot
# docker-compose -f /opt/coroot/docker-compose.yml start

# Keep only last 7 backups
find $BACKUP_DIR -name "coroot-data-*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/coroot-data-$DATE.tar.gz"
```

Add to crontab:
```bash
# Run backup daily at 2 AM
0 2 * * * /opt/coroot/backup.sh >> /var/log/coroot-backup.log 2>&1
```

---

## Troubleshooting

### Issue 1: Coroot Container Not Starting

**Symptoms**: Container exits immediately after starting

**Diagnosis**:
```bash
docker logs coroot
docker inspect coroot
```

**Solutions**:
1. Check port conflicts:
   ```bash
   sudo netstat -tlnp | grep -E '4318|8080'
   # Kill conflicting processes or change ports
   ```

2. Check volume permissions:
   ```bash
   sudo chown -R $(id -u):$(id -g) /var/lib/coroot
   ```

3. Check memory limits:
   ```bash
   free -h
   # Ensure at least 4GB available
   ```

### Issue 2: No Data Appearing in Coroot

**Symptoms**: Services not showing up, empty dashboards

**Diagnosis**:
```bash
# Check if OTLP endpoint is receiving data
docker logs coroot | grep -i "otlp\|trace\|metric"

# Test from application server
curl -v http://<MONITORING_SERVER_IP>:4318/v1/traces
```

**Solutions**:
1. Verify application configuration:
   ```bash
   # On application server
   docker exec backend-container env | grep OTEL
   ```

2. Check network connectivity:
   ```bash
   # From application server
   telnet <MONITORING_SERVER_IP> 4318
   ping <MONITORING_SERVER_IP>
   traceroute <MONITORING_SERVER_IP>
   ```

3. Check firewall rules:
   ```bash
   sudo ufw status
   sudo iptables -L -n | grep 4318
   ```

4. Verify application logs:
   ```bash
   docker logs backend-container | grep OpenTelemetry
   # Should see: "[OpenTelemetry] Initialized for service: task-tracker-backend"
   ```

### Issue 3: High Memory Usage

**Symptoms**: Coroot container using > 4GB RAM

**Diagnosis**:
```bash
docker stats coroot
```

**Solutions**:
1. Reduce data retention:
   ```bash
   # In docker-compose.yml
   COROOT_DATA_RETENTION_DAYS=7
   ```

2. Increase container memory limit:
   ```bash
   docker update --memory 6g coroot
   ```

3. Clean old data:
   ```bash
   docker exec coroot find /data -type f -mtime +7 -delete
   ```

### Issue 4: Slow UI Performance

**Symptoms**: Coroot UI is slow or unresponsive

**Solutions**:
1. Check CPU usage:
   ```bash
   docker stats coroot
   ```

2. Increase CPU allocation:
   ```bash
   docker update --cpus 4 coroot
   ```

3. Reduce query time ranges in dashboards (use last 1h instead of last 24h)

### Issue 5: Gaps in Telemetry Data

**Symptoms**: Missing data points, discontinuous graphs

**Diagnosis**:
```bash
# Check application logs for export failures
docker logs backend-container | grep -i "export\|otlp\|error"

# Check Coroot logs
docker logs coroot | grep -i error
```

**Solutions**:
1. Check network stability between app and monitoring server
2. Verify no network timeouts or packet loss
3. Increase export retry in application (modify tracing.js)

### Issue 6: Certificate/TLS Errors

**Symptoms**: TLS handshake errors in logs

**Solutions**:
1. Use HTTP instead of HTTPS for OTLP endpoint:
   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=http://<IP>:4318  # Not https
   ```

2. Or configure TLS properly with valid certificates

### Common Log Messages

**Normal**:
```
[OpenTelemetry] Initialized for service: task-tracker-backend
[OpenTelemetry] Exporting to: http://monitoring-server:4318
Received 150 spans
Received 45 metrics
```

**Errors to Watch**:
```
Failed to export traces: connect ECONNREFUSED
  → Check network connectivity and firewall

Error: OTLP exporter timeout
  → Increase timeout or check Coroot performance

MongoDB connection error
  → Application database issue, not monitoring
```

---

## Contact Information

**For Issues or Questions**:
- **Monitoring Team Lead**: [Name] - [email@company.com]
- **DevOps Team**: [devops@company.com]
- **Application Team**: [dev-team@company.com]

**Escalation**:
1. Check this troubleshooting guide
2. Review Coroot logs: `docker logs coroot`
3. Contact monitoring team lead
4. Escalate to DevOps if infrastructure issue

**Documentation**:
- Coroot Official Docs: https://coroot.com/docs
- OpenTelemetry Docs: https://opentelemetry.io/docs/
- Application Telemetry Docs: `/path/to/docs/TELEMETRY.md`

---

## Appendix

### A. Coroot UI Navigation

- **Home**: Overview of all services
- **Services**: Individual service details, traces, metrics
- **Infrastructure**: Host-level metrics
- **Dashboards**: Custom dashboards
- **Alerting**: Alert rules and history
- **Settings**: Configuration and integrations

### B. Useful Commands

```bash
# View Coroot version
docker exec coroot cat /etc/coroot/version

# Restart Coroot
docker restart coroot

# Update Coroot
docker pull ghcr.io/coroot/coroot:latest
docker-compose down
docker-compose up -d

# Export logs
docker logs coroot > coroot-logs-$(date +%Y%m%d).log

# Check listening ports
docker exec coroot netstat -tlnp

# Access Coroot shell
docker exec -it coroot sh
```

### C. Monitoring Metrics Reference

**HTTP Metrics**:
- `http.server.request.count` - Total requests
- `http.server.duration` - Request duration
- `http.server.active_requests` - Current active requests

**System Metrics**:
- `system.cpu.utilization` - CPU usage percentage
- `process.runtime.nodejs.memory.heap.used` - Heap memory
- `process.runtime.nodejs.event_loop.lag` - Event loop lag

**Database Metrics**:
- `db.client.operation.count` - Database operations
- `db.client.operation.duration` - Query duration
- `db.client.connections.usage` - Connection pool usage

### D. Sample Configuration Files

All sample configurations are provided in this document. Additional templates available at:
- `/opt/coroot/docker-compose.yml`
- Application `.env` file on app servers

---

**Document Version**: 1.0  
**Last Updated**: October 30, 2025  
**Next Review**: November 30, 2025
