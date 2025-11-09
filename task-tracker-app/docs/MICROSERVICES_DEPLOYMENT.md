# Microservices Deployment Guide

## Architecture Overview

This system is now decomposed into **13 independent services**:

### Backend Microservices (7 services)
1. **Auth Service** (Port 6000) - Authentication & Authorization
2. **Excel Service** (Port 6001) - Batch Excel import with BullMQ
3. **Project Service** (Port 6002) - Project aggregation and management
4. **SubProject Service** (Port 6003) - SubProject CRUD and grouping
5. **Structural Elements Service** (Port 6004-6006) - 3 replicas for high load
6. **Jobs Service** (Port 6007-6009) - 3 replicas for high load
7. **Metrics Service** (Port 6010) - Reports and analytics

### Frontend Services (2 services)
8. **Admin UI** (Port 3002) - 2 replicas
9. **Engineer UI** (Port 3001) - 2 replicas

### Infrastructure Services (4 services)
10. **MongoDB** (Port 27017) - Database with replica set
11. **Redis** (Port 6379) - Cache and BullMQ queue
12. **Traefik** (Port 80/443) - API Gateway and Load Balancer
13. **Uptime Kuma** - Service monitoring

## Business Logic Flow

### Admin Workflow (Drill-Down)
```
Admin Login
    ↓
Project Dashboard (Project Service)
   - View all projects
   - Aggregate metrics from all subprojects
   - Element status: No Job, Active, Complete, No Clearance
   - Job status: Pending, Completed, No Clearance
    ↓
SubProject View (SubProject Service)
   - View subproject metrics
   - Element grouping by parameters
   - SQM tracking per section
   - Excel export by status
    ↓
Element Details (Structural Elements Service)
   - View individual elements
   - Status: No Job, Active, Complete, No Clearance
   - Surface area (SQM) details
   - Associated fireproofing workflow
    ↓
Job Details (Jobs Service)
   - View job status: Pending, Completed, No Clearance
   - Update job status → triggers metric recalculation
   - 4 fireproofing workflows with predefined jobs
```

### Data Flow
```
Excel Upload (Excel Service)
    ↓
BullMQ Processing (Background)
    ↓
Create Structural Elements (Structural Elements Service)
    ↓
Assign Fireproofing Workflow
    ↓
Auto-create Jobs (Jobs Service)
   - Cement Fire Proofing: 7 jobs
   - Gypsum Fire Proofing: 7 jobs
   - Intumescent Coatings: 9 jobs
   - Refinery Fire Proofing: 12 jobs
    ↓
Update Metrics (Metrics Service)
    ↓
Aggregate to SubProject (SubProject Service)
    ↓
Aggregate to Project (Project Service)
```

## Pre-Deployment Checklist

### 1. Shared Dependencies Setup
```bash
# All microservices use shared models/middleware/utils
cd /opt/task-checker/task-tracker-app
ls -la shared/
# Should contain: models/, middleware/, utils/
```

### 2. Docker Secrets
Ensure secrets exist in `infrastructure/docker/secrets/`:
- `mongodb_password`
- `redis_password`
- `jwt_secret`
- `session_secret`
- `vault_token`

### 3. Update Imports in Microservices
Each microservice needs to reference shared resources:
```javascript
// Update imports in all service files
const User = require('../shared/models/User');
const { auth } = require('../shared/middleware/auth');
const { addExcelJob } = require('../shared/utils/queue');
```

## Deployment Steps

### Step 1: Backup Current System
```bash
ssh root@62.72.56.99
cd /opt/task-checker/task-tracker-app/infrastructure/docker
docker compose down
# Backup MongoDB and Redis
docker run --rm -v tasktracker_mongodb_data:/data -v /root/backup:/backup alpine tar czf /backup/mongodb-$(date +%Y%m%d).tar.gz /data
docker run --rm -v tasktracker_redis_data:/data -v /root/backup:/backup alpine tar czf /backup/redis-$(date +%Y%m%d).tar.gz /data
```

### Step 2: Pull Latest Code
```bash
cd /opt/task-checker/task-tracker-app
git pull origin main
```

### Step 3: Build All Microservices
```bash
cd /opt/task-checker/task-tracker-app/infrastructure/docker

# Build all services
docker compose -f docker-compose.microservices.yml build

# Or build individually
docker compose -f docker-compose.microservices.yml build auth-service
docker compose -f docker-compose.microservices.yml build excel-service
docker compose -f docker-compose.microservices.yml build project-service
docker compose -f docker-compose.microservices.yml build subproject-service
docker compose -f docker-compose.microservices.yml build structural-elements-service
docker compose -f docker-compose.microservices.yml build jobs-service
docker compose -f docker-compose.microservices.yml build metrics-service
docker compose -f docker-compose.microservices.yml build tasktracker-admin
docker compose -f docker-compose.microservices.yml build tasktracker-engineer
```

### Step 4: Start Infrastructure Services First
```bash
# Start MongoDB, Redis, Vault first
docker compose -f docker-compose.microservices.yml up -d mongodb redis vault

# Wait for MongoDB replica set initialization (40 seconds)
sleep 45

# Verify MongoDB is healthy
docker compose -f docker-compose.microservices.yml ps mongodb
```

### Step 5: Start Backend Microservices
```bash
# Start all backend services
docker compose -f docker-compose.microservices.yml up -d \
  auth-service \
  excel-service \
  project-service \
  subproject-service \
  structural-elements-service \
  jobs-service \
  metrics-service

# Wait for services to be healthy
sleep 30
```

### Step 6: Start Frontend Services
```bash
docker compose -f docker-compose.microservices.yml up -d \
  tasktracker-admin \
  tasktracker-engineer
```

### Step 7: Start Traefik and Monitoring
```bash
docker compose -f docker-compose.microservices.yml up -d traefik uptime-kuma
```

### Step 8: Verify All Services
```bash
# Check all services are running
docker compose -f docker-compose.microservices.yml ps

# Check logs for errors
docker compose -f docker-compose.microservices.yml logs auth-service
docker compose -f docker-compose.microservices.yml logs excel-service
docker compose -f docker-compose.microservices.yml logs structural-elements-service
docker compose -f docker-compose.microservices.yml logs jobs-service

# Test health endpoints
curl http://localhost:6000/health  # Auth
curl http://localhost:6001/health  # Excel
curl http://localhost:6002/health  # Project
curl http://localhost:6003/health  # SubProject
curl http://localhost:6004/health  # Structural Elements
curl http://localhost:6007/health  # Jobs
curl http://localhost:6010/health  # Metrics
```

## Post-Deployment Verification

### 1. Test API Gateway (Traefik)
```bash
# Via Traefik (should route correctly)
curl https://projects.sapcindia.com/api/auth/health
curl https://projects.sapcindia.com/api/excel/health
curl https://projects.sapcindia.com/api/projects
curl https://projects.sapcindia.com/api/subprojects
curl https://projects.sapcindia.com/api/structural-elements
curl https://projects.sapcindia.com/api/jobs
curl https://projects.sapcindia.com/api/reports
```

### 2. Test UI Access
```bash
# Admin UI
curl https://projects.sapcindia.com/admin

# Engineer UI
curl https://projects.sapcindia.com/engineer
```

### 3. Monitor Service Health
- Access Uptime Kuma: http://62.72.56.99:3001
- Access Traefik Dashboard: https://traefik.projects.sapcindia.com
- Check OpenSearch logs for errors

### 4. Test Critical Workflows
1. **Login Flow** - Test authentication via Auth Service
2. **Excel Upload** - Upload small Excel file (~100 rows)
3. **View Projects** - Check Project Service aggregation
4. **Drill to SubProject** - Verify SubProject metrics
5. **View Elements** - Check Structural Elements listing
6. **Update Job** - Test job status update and metric recalculation

## Scaling

### Scale High-Load Services
```bash
# Scale Structural Elements to 5 replicas
docker compose -f docker-compose.microservices.yml up -d --scale structural-elements-service=5

# Scale Jobs Service to 5 replicas
docker compose -f docker-compose.microservices.yml up -d --scale jobs-service=5

# Scale UI services
docker compose -f docker-compose.microservices.yml up -d --scale tasktracker-admin=3
docker compose -f docker-compose.microservices.yml up -d --scale tasktracker-engineer=3
```

## Rollback Plan

If microservices deployment fails:
```bash
cd /opt/task-checker/task-tracker-app/infrastructure/docker

# Stop microservices
docker compose -f docker-compose.microservices.yml down

# Restore old monolithic setup
docker compose -f docker-compose.yml up -d
```

## Performance Monitoring

### Key Metrics to Watch
1. **Response Times**: Each service should respond < 200ms
2. **Error Rates**: Should be < 1%
3. **Memory Usage**: Monitor each service's RAM
4. **CPU Usage**: Watch Structural Elements & Jobs services
5. **Queue Depth**: Monitor Redis BullMQ queues
6. **Database Connections**: Monitor MongoDB connection pool

### Resource Limits
```
Structural Elements (3x): 0.75 CPU, 768MB RAM each = 2.25 CPU, 2.3GB RAM
Jobs Service (3x): 0.75 CPU, 768MB RAM each = 2.25 CPU, 2.3GB RAM
Excel Service: 1.5 CPU, 2GB RAM
Others: 0.25-0.5 CPU, 256-512MB RAM each
Total: ~7-8 CPU, 8-10GB RAM
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose -f docker-compose.microservices.yml logs [service-name]

# Check dependencies
docker compose -f docker-compose.microservices.yml ps mongodb redis

# Restart specific service
docker compose -f docker-compose.microservices.yml restart [service-name]
```

### Database Connection Issues
```bash
# Verify MongoDB replica set
docker exec tasktracker-mongodb mongosh -u admin -p [password] --eval "rs.status()"

# Check MongoDB logs
docker logs tasktracker-mongodb
```

### Routing Issues
```bash
# Check Traefik configuration
docker logs tasktracker-traefik

# Verify labels
docker inspect [service-name] | grep traefik
```

## Maintenance

### Update Single Service
```bash
cd /opt/task-checker/task-tracker-app
git pull

cd infrastructure/docker
docker compose -f docker-compose.microservices.yml build [service-name]
docker compose -f docker-compose.microservices.yml up -d [service-name]
```

### Database Maintenance
```bash
# MongoDB backup (weekly)
docker exec tasktracker-mongodb mongodump --out /backup

# Redis backup (daily)
docker exec tasktracker-redis redis-cli --rdb /data/dump.rdb SAVE
```

## Success Criteria

✅ All 13 services running healthy
✅ Traefik routing correctly to all services
✅ Admin can drill down: Project → SubProject → Element → Job
✅ Excel upload processes successfully via BullMQ
✅ Job status updates trigger metric recalculation
✅ Response times < 200ms
✅ No memory leaks or CPU spikes
✅ Logs flowing to OpenSearch
✅ Uptime Kuma monitoring all services

## Support

For issues during deployment:
1. Check logs: `docker compose -f docker-compose.microservices.yml logs [service]`
2. Verify health endpoints
3. Check OpenSearch for application logs
4. Review Traefik dashboard for routing issues
5. Monitor resource usage: `docker stats`
