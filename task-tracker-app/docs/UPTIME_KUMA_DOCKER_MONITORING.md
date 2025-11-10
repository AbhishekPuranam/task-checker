# Uptime Kuma Docker Container Monitoring Setup

## Overview

This guide explains how to configure Uptime Kuma to monitor Docker containers directly instead of just HTTP endpoints. Docker container monitoring provides more reliable health checks by monitoring the container runtime status.

## Features

- **Direct Container Monitoring**: Monitors Docker container running status
- **Automatic Discovery**: Uses Docker socket to access container information
- **Comprehensive Coverage**: Monitors all microservices, infrastructure, and UI containers
- **Scaled Service Support**: Handles services with multiple replicas
- **Self-Monitoring**: Uptime Kuma monitors itself

## Prerequisites

1. Uptime Kuma running at `http://62.72.56.99:3001`
2. Login credentials: `admin / Coreinme@789`
3. Docker socket access for Uptime Kuma container
4. Node.js installed (for running configuration script)

## Quick Start

### Automated Setup (Recommended)

Run the automated setup script on the production server:

```bash
ssh root@62.72.56.99
cd /opt/task-checker/task-tracker-app/scripts
./setup-uptime-docker-monitoring.sh
```

This script will:
1. Verify Docker socket is mounted in Uptime Kuma
2. Redeploy Uptime Kuma if needed
3. Configure all Docker container monitors
4. Verify setup completion

### Manual Setup

If you prefer manual setup or need to troubleshoot:

#### Step 1: Update Docker Compose

Ensure Uptime Kuma has Docker socket access in `docker-compose.microservices.yml`:

```yaml
uptime-kuma:
  image: louislam/uptime-kuma:1
  container_name: uptime-kuma
  restart: unless-stopped
  volumes:
    - uptime_kuma_data:/app/data
    - /var/run/docker.sock:/var/run/docker.sock:ro  # Required for Docker monitoring
  ports:
    - "3001:3001"
  networks:
    - tasktracker-network
```

#### Step 2: Redeploy Uptime Kuma

```bash
cd /opt/task-checker/task-tracker-app/infrastructure/docker
docker-compose -f docker-compose.microservices.yml up -d uptime-kuma
```

#### Step 3: Verify Docker Socket Access

```bash
docker exec uptime-kuma test -S /var/run/docker.sock && echo "✅ Docker socket accessible"
```

#### Step 4: Configure Monitors

```bash
cd /opt/task-checker/task-tracker-app/scripts
node configure-uptime-docker-monitors.js
```

## Monitored Containers

### Infrastructure Services (3 containers)
- `tasktracker-vault` - HashiCorp Vault
- `tasktracker-mongodb` - MongoDB database
- `tasktracker-redis` - Redis cache and queue

### Microservices (5 containers)
- `tasktracker-auth-service` - Authentication
- `tasktracker-excel-service` - Excel processing
- `tasktracker-project-service` - Project management
- `tasktracker-subproject-service` - SubProject management
- `tasktracker-metrics-service` - Metrics and reports

### Scaled Services (4 service groups)
- `structural-elements-service` - Multiple replicas
- `jobs-service` - Multiple replicas
- `tasktracker-admin` - Admin UI (2 replicas)
- `tasktracker-engineer` - Engineer UI (2 replicas)

### System Services (2 containers)
- `tasktracker-traefik` - Reverse proxy
- `uptime-kuma` - Self-monitoring

**Total: ~14 individual containers + scaled replicas**

## Monitor Configuration

Each Docker monitor is configured with:

- **Type**: `docker` (container monitoring)
- **Interval**: 60 seconds
- **Max Retries**: 3
- **Retry Interval**: 60 seconds
- **Docker Host**: Local Docker socket

## Scaled Services Handling

For services with multiple replicas (e.g., `structural-elements-service_1`, `structural-elements-service_2`, `structural-elements-service_3`):

- Monitor uses the base service name
- Tracks the first available replica
- All replicas share load balancing through Traefik

## Accessing Uptime Kuma

1. **URL**: http://62.72.56.99:3001
2. **Username**: admin
3. **Password**: Coreinme@789

## Monitoring Dashboard

After setup, your Uptime Kuma dashboard will show:

- 🐳 Container status (Running/Stopped)
- ⏱️ Uptime percentage
- 📊 Response time graphs
- 🔔 Alert history
- 📈 Status statistics

## Troubleshooting

### Issue: Docker socket not accessible

**Error**: `ENOENT: no such file or directory, stat '/var/run/docker.sock'`

**Solution**:
```bash
# 1. Check if socket exists on host
ls -la /var/run/docker.sock

# 2. Verify docker-compose mount
docker inspect uptime-kuma | grep -A 5 Mounts

# 3. Restart container with correct mount
cd /opt/task-checker/task-tracker-app/infrastructure/docker
docker-compose -f docker-compose.microservices.yml up -d uptime-kuma
```

### Issue: Permission denied accessing Docker socket

**Error**: `Error: connect EACCES /var/run/docker.sock`

**Solution**:
```bash
# Check socket permissions
ls -la /var/run/docker.sock

# Should show: srw-rw---- 1 root docker

# Add Uptime Kuma to docker group (if needed)
docker exec -it uptime-kuma sh -c "ls -la /var/run/docker.sock"
```

### Issue: Cannot find container

**Error**: Monitor shows "Container not found"

**Solution**:
```bash
# List all containers
docker ps -a --format "{{.Names}}"

# Verify container name matches exactly
# For scaled services, use base name without replica number
```

### Issue: Monitors not appearing

**Solution**:
1. Check Uptime Kuma logs: `docker logs uptime-kuma`
2. Verify you're logged in as admin
3. Try refreshing the page
4. Re-run configuration script

## Maintenance

### Adding New Containers

1. Update `scripts/configure-uptime-docker-monitors.js`
2. Add container configuration to `DOCKER_MONITORS` array
3. Run: `node configure-uptime-docker-monitors.js`

### Removing Monitors

1. Open Uptime Kuma dashboard
2. Click on monitor to remove
3. Click "Delete" button
4. Confirm deletion

### Updating Monitor Settings

1. Open Uptime Kuma dashboard
2. Click on monitor to edit
3. Modify settings (interval, retries, etc.)
4. Save changes

## Benefits of Docker Monitoring

### vs HTTP Monitoring

| Feature | Docker Monitoring | HTTP Monitoring |
|---------|------------------|-----------------|
| Container status | ✅ Direct | ❌ Indirect |
| Stopped containers | ✅ Detected | ❌ Timeout only |
| Startup time | ✅ Immediate | ⏱️ After health check |
| Resource usage | ✅ Available | ❌ Not available |
| Restart detection | ✅ Instant | ⏱️ Delayed |

### Advantages

1. **Faster Detection**: Immediately knows if container stopped
2. **No Network Overhead**: No HTTP requests needed
3. **Startup Monitoring**: Tracks container from start
4. **Resource Visibility**: Can access container stats
5. **Restart Tracking**: Detects container restarts instantly

## Integration with Existing Monitoring

This Docker monitoring **complements** existing HTTP/endpoint monitoring:

- **Docker monitors**: Container runtime health
- **HTTP monitors**: Application/service availability
- **Port monitors**: Network connectivity

**Recommendation**: Keep both Docker and HTTP monitors for comprehensive coverage.

## Scripts Reference

### `configure-uptime-docker-monitors.js`
Configures Docker container monitors via Uptime Kuma API.

**Usage**:
```bash
node scripts/configure-uptime-docker-monitors.js
```

**Features**:
- Auto-detects or creates Docker host
- Creates monitors for all containers
- Skips existing monitors
- Provides detailed progress output

### `setup-uptime-docker-monitoring.sh`
Automated setup script that handles complete configuration.

**Usage**:
```bash
./scripts/setup-uptime-docker-monitoring.sh
```

**Features**:
- Verifies Docker socket mount
- Redeploys if needed
- Runs configuration script
- Validates setup

## Security Considerations

### Docker Socket Access

The Docker socket (`/var/run/docker.sock`) provides **full Docker API access**:

- ⚠️ **Read-only mount**: Uses `:ro` flag for safety
- ✅ **Container isolation**: Only Uptime Kuma has access
- 🔒 **Network security**: Not exposed externally
- 🛡️ **Monitoring only**: No container manipulation

### Best Practices

1. Keep Docker socket mount read-only (`:ro`)
2. Don't expose Uptime Kuma port externally without authentication
3. Use strong admin password
4. Regularly update Uptime Kuma image
5. Monitor Uptime Kuma logs for suspicious activity

## Future Enhancements

Potential improvements:

1. **Container Stats**: Add resource usage monitoring
2. **Log Monitoring**: Check container logs for errors
3. **Health Check Integration**: Use Docker HEALTHCHECK status
4. **Auto-scaling Detection**: Track replica count changes
5. **Alert Rules**: Custom alerting based on container events

## Support

For issues or questions:

1. Check Uptime Kuma logs: `docker logs uptime-kuma`
2. Verify Docker socket access
3. Review configuration script output
4. Check container status: `docker ps -a`

## References

- [Uptime Kuma Documentation](https://github.com/louislam/uptime-kuma)
- [Docker Monitoring Guide](https://docs.docker.com/config/containers/runmetrics/)
- [Project Deployment Documentation](../docs/DEPLOYMENT.md)
