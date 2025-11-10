# Uptime Kuma Production Setup Instructions

## Run these commands on production server (root@62.72.56.99)

```bash
# 1. SSH into production server
ssh root@62.72.56.99

# 2. Navigate to project directory
cd /opt/task-checker/task-tracker-app

# 3. Pull latest changes
git pull origin main

# 4. Make script executable
chmod +x scripts/setup-uptime-kuma-production.sh

# 5. Run the setup script
./scripts/setup-uptime-kuma-production.sh
```

## What the script does:

1. **Installs axios** in the Uptime Kuma container (needed for JWT auth)
2. **Creates monitoring script** inside the container with proper configuration
3. **Obtains JWT token** from your auth service using admin credentials
4. **Deletes all existing monitors** (the broken ones)
5. **Creates new monitors** with:
   - Docker network hostnames (tasktracker-mongodb, tasktracker-redis, etc.)
   - JWT authentication headers for protected endpoints
   - Accepted status codes: 200-299, 401 (401 is OK for auth-protected services)
   - 60-second check intervals
   - Proper health check endpoints

## Monitors that will be created:

### Infrastructure (3)
- 🔒 Vault - uses container name `tasktracker-vault:8200`
- 🗄️ MongoDB - uses container name `tasktracker-mongodb:27017`
- ⚡ Redis - uses container name `tasktracker-redis:6379`

### Backend Services (7)
- 🔐 Auth Service - with JWT token
- 📊 Excel Service - with JWT token
- 📁 Project Service - with JWT token
- 📋 SubProject Service - with JWT token
- 🏗️ Structural Elements Service - with JWT token
- ⚙️ Jobs Service - with JWT token
- 📈 Metrics Service - with JWT token

### Frontend Services (2)
- 🖥️ Admin Portal
- 👷 Engineer Portal

### Monitoring Tools (3)
- 🔍 OpenSearch - uses container name `tasktracker-opensearch:9200`
- 📊 OpenSearch Dashboards - uses container name `tasktracker-dashboards:5601`
- 🌐 Traefik Dashboard - uses container name `tasktracker-traefik:8080`

### Public Endpoints (2)
- 🌍 Main Website
- 🔑 Login Page

## After running:

All monitors should show **UP** status because:
- ✅ No more localhost connection refused errors
- ✅ 401 errors are accepted as valid (service is responding, just needs auth)
- ✅ JWT tokens are included in requests where needed
- ✅ All using correct Docker network hostnames

## Access:
**URL**: http://62.72.56.99:3001  
**Username**: admin  
**Password**: Coreinme@789
