# DevOps Deployment Guide - Task Tracker Application

**Document Version**: 1.0  
**Date**: October 31, 2025  
**Target Audience**: DevOps Engineers, System Administrators  
**Priority**: Production Deployment Reference

---

## 📋 Table of Contents
1. [Data Persistence Strategy](#data-persistence-strategy)
2. [Production Deployment](#production-deployment)
3. [Volume Management](#volume-management)
4. [Container Recovery](#container-recovery)
5. [Monitoring & Health Checks](#monitoring--health-checks)

---

## 🔒 Data Persistence Strategy

### Critical: MongoDB Data is Already Persistent ✅

**Your MongoDB data will NOT be lost when containers crash or restart.**

#### Current Configuration

**File**: `infrastructure/docker/docker-compose.yml`

```yaml
mongodb:
  image: mongo:7.0
  volumes:
    - mongodb_data:/data/db  # ← Persistent volume
    
volumes:
  mongodb_data:
    driver: local  # ← Stored on VM disk
```

**What This Means:**
- ✅ Data persists through container **restarts**
- ✅ Data persists through container **crashes**
- ✅ Data persists through `docker-compose down`
- ✅ Data persists through **system reboots**
- ✅ Data persists through Docker **service restarts**

**Data Storage Location:**
```bash
# Physical location on VM
/var/lib/docker/volumes/mongodb_data/_data

# Verify location
docker volume inspect mongodb_data | grep Mountpoint
```

**Data is ONLY Lost When:**
- ❌ You explicitly run `docker-compose down -v` (the `-v` removes volumes)
- ❌ You manually delete the volume: `docker volume rm mongodb_data`
- ❌ VM disk fails (hardware failure)

---

### Recommended: Bind Mounts for Production

**For better control and easier backups, use bind mounts:**

**Advantages:**
1. **Direct access** to data files
2. **Easier backups** - just copy the directory
3. **Visible to admin** - no hidden Docker volumes
4. **Easier migration** - move folder to new server
5. **Standard Linux permissions** apply

#### Setup Instructions

**Step 1: Create directories on VM**
```bash
# Create data directories
sudo mkdir -p /opt/tasktracker/data/mongodb
sudo mkdir -p /opt/tasktracker/data/redis
sudo mkdir -p /opt/tasktracker/uploads
sudo mkdir -p /opt/tasktracker/logs
sudo mkdir -p /opt/tasktracker/backups

# Set ownership (999 = MongoDB/Redis user inside container)
sudo chown -R 999:999 /opt/tasktracker/data/mongodb
sudo chown -R 999:999 /opt/tasktracker/data/redis
sudo chown -R $USER:$USER /opt/tasktracker/uploads
sudo chown -R $USER:$USER /opt/tasktracker/logs
sudo chown -R $USER:$USER /opt/tasktracker/backups

# Set permissions
sudo chmod -R 755 /opt/tasktracker/data
sudo chmod -R 755 /opt/tasktracker/uploads

# Verify
ls -la /opt/tasktracker/data/
```

**Step 2: Update docker-compose.yml**

**File**: `infrastructure/docker/docker-compose.yml`

```yaml
services:
  mongodb:
    image: mongo:7.0
    container_name: tasktracker-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_PASSWORD}  # From .env
    volumes:
      # BIND MOUNT - data stored at /opt/tasktracker/data/mongodb
      - /opt/tasktracker/data/mongodb:/data/db
      - /opt/tasktracker/logs/mongodb:/var/log/mongodb
      - ../../scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - tasktracker-network

  redis:
    image: redis:7-alpine
    container_name: tasktracker-redis
    restart: unless-stopped
    volumes:
      # BIND MOUNT - data stored at /opt/tasktracker/data/redis
      - /opt/tasktracker/data/redis:/data
    networks:
      - tasktracker-network

  tasktracker-app:
    # ... other config ...
    volumes:
      # BIND MOUNT - uploads stored at /opt/tasktracker/uploads
      - /opt/tasktracker/uploads:/app/uploads
      - /opt/tasktracker/logs:/app/logs

# Remove named volumes section (no longer needed)
# volumes:
#   mongodb_data:
#   redis_data:
```

**Step 3: Migrate existing data (if already running)**

```bash
# Stop containers
cd /path/to/task-tracker-app
docker-compose -f infrastructure/docker/docker-compose.yml down

# Copy data from Docker volume to bind mount
sudo docker run --rm \
  -v mongodb_data:/source \
  -v /opt/tasktracker/data/mongodb:/target \
  alpine sh -c "cp -a /source/. /target/"

# Fix permissions
sudo chown -R 999:999 /opt/tasktracker/data/mongodb

# Update docker-compose.yml (as shown above)

# Start with new bind mounts
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# Verify data is intact
docker exec -it tasktracker-mongodb mongosh -u admin -p password123 --eval "db.adminCommand('listDatabases')"

# Old volume can be removed
docker volume rm mongodb_data
```

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

```bash
# 1. Create data directories
sudo mkdir -p /opt/tasktracker/data/{mongodb,redis}
sudo mkdir -p /opt/tasktracker/{uploads,logs,backups}

# 2. Set permissions
sudo chown -R 999:999 /opt/tasktracker/data/mongodb
sudo chown -R 999:999 /opt/tasktracker/data/redis

# 3. Clone repository
git clone https://github.com/AbhishekPuranam/task-checker.git
cd task-checker/task-tracker-app

# 4. Create .env file
cat > .env <<EOF
NODE_ENV=production
MONGODB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
REDIS_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
EOF

# 5. Update docker-compose.yml with bind mounts (see above)

# 6. Start services
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# 7. Verify all containers running
docker-compose -f infrastructure/docker/docker-compose.yml ps

# 8. Check MongoDB data directory
ls -la /opt/tasktracker/data/mongodb
```

### Deployment Commands

```bash
# Start production environment
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# View logs
docker-compose -f infrastructure/docker/docker-compose.yml logs -f

# Check status
docker-compose -f infrastructure/docker/docker-compose.yml ps

# Restart specific service
docker-compose -f infrastructure/docker/docker-compose.yml restart backend

# Stop all (data is preserved)
docker-compose -f infrastructure/docker/docker-compose.yml down
```

---

## 💾 Volume Management

### View Data Locations

```bash
# MongoDB data
ls -lah /opt/tasktracker/data/mongodb/

# Redis data
ls -lah /opt/tasktracker/data/redis/

# Uploaded files
ls -lah /opt/tasktracker/uploads/

# Application logs
ls -lah /opt/tasktracker/logs/
```

### Check Disk Usage

```bash
# Check data directory size
du -sh /opt/tasktracker/data/*

# MongoDB specific
du -sh /opt/tasktracker/data/mongodb

# Total usage
df -h /opt/tasktracker
```

### Simple Backup (With Bind Mounts)

```bash
# Backup MongoDB data (while running)
sudo tar czf /opt/tasktracker/backups/mongodb-$(date +%Y%m%d-%H%M%S).tar.gz \
  -C /opt/tasktracker/data mongodb

# Backup uploads
sudo tar czf /opt/tasktracker/backups/uploads-$(date +%Y%m%d-%H%M%S).tar.gz \
  -C /opt/tasktracker uploads

# Full backup (recommended to stop containers first)
docker-compose -f infrastructure/docker/docker-compose.yml down
sudo tar czf /opt/tasktracker/backups/full-backup-$(date +%Y%m%d).tar.gz \
  -C /opt/tasktracker data uploads
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

### Restore from Backup

```bash
# Stop containers
docker-compose -f infrastructure/docker/docker-compose.yml down

# Restore data
sudo tar xzf /opt/tasktracker/backups/mongodb-20251031-120000.tar.gz \
  -C /opt/tasktracker/data

# Fix permissions
sudo chown -R 999:999 /opt/tasktracker/data/mongodb

# Start containers
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# Verify
docker logs tasktracker-mongodb
```

---

## 🔄 Container Recovery

### Scenario 1: Container Crashes

**Automatic Recovery (already configured):**
```yaml
restart: unless-stopped  # Container auto-restarts on crash
```

**Manual restart:**
```bash
# Restart crashed container
docker-compose -f infrastructure/docker/docker-compose.yml restart mongodb

# Check logs for crash reason
docker logs tasktracker-mongodb --tail 100
```

**Data is safe** - bind mount ensures data survives crash.

### Scenario 2: System Reboot

**Containers auto-start after reboot:**
```bash
# Enable Docker to start on boot (Ubuntu/systemd)
sudo systemctl enable docker

# Containers will auto-start due to "restart: unless-stopped"
```

**Verify after reboot:**
```bash
docker ps
ls -la /opt/tasktracker/data/mongodb  # Data still there
```

### Scenario 3: Accidental Container Deletion

```bash
# Even if you delete the container
docker rm -f tasktracker-mongodb

# Data is SAFE in /opt/tasktracker/data/mongodb

# Just restart the stack
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# Data is automatically reattached
```

### Scenario 4: Docker Service Restart

```bash
# Restart Docker service
sudo systemctl restart docker

# Data persists at /opt/tasktracker/data/mongodb

# Restart containers
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

---

## 📊 Monitoring & Health Checks

### Container Health

```bash
# Check all containers
docker-compose -f infrastructure/docker/docker-compose.yml ps

# Expected output:
# NAME                    STATUS         PORTS
# tasktracker-mongodb     Up 2 hours     27017/tcp
# tasktracker-redis       Up 2 hours     6379/tcp
# tasktracker-app         Up 2 hours     5000/tcp
```

### Data Integrity Checks

```bash
# MongoDB health
docker exec tasktracker-mongodb mongosh -u admin -p password123 \
  --authenticationDatabase admin \
  --eval "db.adminCommand('ping')"

# Check database size
docker exec tasktracker-mongodb mongosh -u admin -p password123 \
  --authenticationDatabase admin \
  --eval "db.stats()"

# Count records
docker exec tasktracker-mongodb mongosh -u admin -p password123 \
  --authenticationDatabase admin \
  --eval "use tasktracker; db.users.countDocuments()"
```

### Disk Space Monitoring

```bash
# Monitor data directory
watch -n 5 'du -sh /opt/tasktracker/data/*'

# Alert if > 80% full
df -h /opt/tasktracker | awk 'NR==2 {if ($5+0 > 80) print "WARNING: Disk usage at " $5}'
```

### Automated Health Check Script

**Create**: `/opt/tasktracker/scripts/health-check.sh`
```bash
#!/bin/bash

echo "=== Task Tracker Health Check ==="
echo "Date: $(date)"
echo ""

# Check containers
echo "1. Container Status:"
docker-compose -f /path/to/infrastructure/docker/docker-compose.yml ps

# Check MongoDB
echo ""
echo "2. MongoDB Connection:"
docker exec tasktracker-mongodb mongosh -u admin -p password123 \
  --authenticationDatabase admin \
  --quiet --eval "db.adminCommand('ping')" && echo "✅ MongoDB OK" || echo "❌ MongoDB FAILED"

# Check Redis
echo ""
echo "3. Redis Connection:"
docker exec tasktracker-redis redis-cli ping && echo "✅ Redis OK" || echo "❌ Redis FAILED"

# Check disk space
echo ""
echo "4. Disk Usage:"
df -h /opt/tasktracker

# Check data size
echo ""
echo "5. Data Directory Sizes:"
du -sh /opt/tasktracker/data/*

echo ""
echo "=== Health Check Complete ==="
```

**Run it:**
```bash
chmod +x /opt/tasktracker/scripts/health-check.sh
/opt/tasktracker/scripts/health-check.sh

# Add to cron (every 5 minutes)
*/5 * * * * /opt/tasktracker/scripts/health-check.sh >> /var/log/tasktracker-health.log 2>&1
```

---

## 🔧 Troubleshooting

### MongoDB Won't Start

```bash
# Check logs
docker logs tasktracker-mongodb --tail 50

# Common issues:
# 1. Permission denied
sudo chown -R 999:999 /opt/tasktracker/data/mongodb

# 2. Port in use
sudo lsof -i :27017
sudo kill -9 <PID>

# 3. Corrupted data
# Restore from backup (see above)
```

### Data Directory Empty After Restart

```bash
# Verify mount in container
docker inspect tasktracker-mongodb | grep -A 10 Mounts

# Should show:
# "Source": "/opt/tasktracker/data/mongodb",
# "Destination": "/data/db"

# If not, check docker-compose.yml volumes section
```

### Out of Disk Space

```bash
# Find large files
sudo du -ah /opt/tasktracker | sort -hr | head -20

# Clean old backups
find /opt/tasktracker/backups -name "*.tar.gz" -mtime +30 -delete

# Clean Docker images/containers
docker system prune -a
```

---

## 📚 Quick Reference

### Directory Structure
```
/opt/tasktracker/
├── data/
│   ├── mongodb/          ← MongoDB database files (persistent)
│   └── redis/            ← Redis data (persistent)
├── uploads/              ← User uploads (persistent)
├── logs/                 ← Application logs
└── backups/              ← Backup storage
```

### Key Commands
```bash
# View MongoDB files directly
ls -la /opt/tasktracker/data/mongodb/

# Backup MongoDB
sudo tar czf backup.tar.gz -C /opt/tasktracker/data mongodb

# Restore MongoDB
sudo tar xzf backup.tar.gz -C /opt/tasktracker/data

# Check data size
du -sh /opt/tasktracker/data/mongodb

# Check disk space
df -h /opt/tasktracker
```

### Important Files
- `infrastructure/docker/docker-compose.yml` - Container configuration
- `/opt/tasktracker/data/mongodb/` - MongoDB data directory
- `/opt/tasktracker/uploads/` - User-uploaded files
- `.env` - Environment variables (secrets)

---

## ✅ Production Checklist

### Initial Setup
- [x] Create `/opt/tasktracker/data/mongodb` directory
- [x] Set permissions (chown 999:999)
- [x] Update docker-compose.yml with bind mounts
- [x] Configure .env with strong passwords
- [ ] Test backup/restore procedure
- [ ] Setup monitoring/health checks
- [ ] Configure firewall rules
- [ ] Setup SSL/TLS

### Regular Maintenance
- [ ] Weekly backups (automated)
- [ ] Monthly disk space check
- [ ] Monthly security updates
- [ ] Test restore procedure quarterly

---

**Document Control**
- **Author**: DevOps Team
- **Last Updated**: October 31, 2025
- **Version**: 1.0
- **Next Review**: December 31, 2025
