# Incident Prevention Strategy

## Problem Statement
Container restart issues have occurred **4 times**, causing production outages during customer demos. Root cause: Docker secret mounts lost on container recreation without proper docker-compose configuration.

## Recent Incident (Nov 9, 2025)

### Issues Encountered
1. **Service Crashes**: project-service, subproject-service, metrics-service crash loop with `ENOENT: /run/secrets/jwt_secret`
2. **Login Page 404**: No Traefik route for `/login` or `/` paths
3. **Security Vulnerability**: Credentials sent via GET in URL
4. **Wrong Redirect**: Login redirected to `/admin` instead of `/admin/projects`

### Root Cause Analysis
- **Primary**: Missing `jwt_secret` in Docker Compose secrets list for 3 services
- **Secondary**: Incomplete Traefik routing configuration for auth endpoints
- **Tertiary**: Frontend form submission not using POST method

## Prevention Checklist

### 1. Pre-Deployment Validation

Create validation script: `/scripts/pre-deploy-check.sh`

```bash
#!/bin/bash
set -e

echo "🔍 Running pre-deployment validation..."

# Check all services have required secrets
SERVICES=(
  "auth-service:jwt_secret,session_secret,mongodb_password,redis_password"
  "project-service:jwt_secret,mongodb_password,redis_password"
  "subproject-service:jwt_secret,mongodb_password,redis_password"
  "metrics-service:jwt_secret,mongodb_password,redis_password"
  "excel-service:jwt_secret,mongodb_password,redis_password"
  "jobs-service:jwt_secret,mongodb_password,redis_password"
  "structural-elements-service:jwt_secret,mongodb_password,redis_password"
)

for SERVICE_DEF in "${SERVICES[@]}"; do
  SERVICE=$(echo "$SERVICE_DEF" | cut -d: -f1)
  REQUIRED_SECRETS=$(echo "$SERVICE_DEF" | cut -d: -f2 | tr ',' ' ')
  
  echo "Checking $SERVICE..."
  for SECRET in $REQUIRED_SECRETS; do
    if ! grep -q "$SECRET" infrastructure/docker/docker-compose.microservices.yml | grep -A 20 "$SERVICE:" | grep -q "- $SECRET"; then
      echo "❌ ERROR: $SERVICE missing secret: $SECRET"
      exit 1
    fi
  done
  echo "✅ $SERVICE secrets validated"
done

# Verify all secret files exist
echo "Checking secret files..."
SECRETS_DIR="infrastructure/docker/secrets"
REQUIRED_FILES=("jwt_secret" "mongodb_password" "redis_password" "session_secret" "vault_token")

for FILE in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$SECRETS_DIR/$FILE" ]; then
    echo "❌ ERROR: Missing secret file: $FILE"
    exit 1
  fi
  echo "✅ Secret file exists: $FILE"
done

# Validate docker-compose syntax
echo "Validating docker-compose syntax..."
docker compose -f infrastructure/docker/docker-compose.microservices.yml config > /dev/null
echo "✅ Docker Compose syntax valid"

# Check Traefik routing priorities
echo "Checking Traefik routing priorities..."
# Add priority validation logic here

echo "✅ All pre-deployment checks passed"
```

### 2. Service Documentation Template

Create README for each service in `/services-microservices/<service-name>/README.md`:

```markdown
# <Service Name>

## Required Secrets
- `jwt_secret` - JWT signing key (shared across all services)
- `mongodb_password` - MongoDB authentication
- `redis_password` - Redis cache authentication
- `session_secret` - Session cookie signing (auth-service only)

## Environment Variables
- `PORT` - Service port (default: XXXX)
- `NODE_ENV` - Environment (production/development)
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string

## Docker Compose Configuration
```yaml
services:
  <service-name>:
    secrets:
      - jwt_secret
      - mongodb_password
      - redis_password
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret
      MONGODB_PASSWORD_FILE: /run/secrets/mongodb_password
      REDIS_PASSWORD_FILE: /run/secrets/redis_password
```

## Health Check
- Endpoint: `/api/<service>/health`
- Expected Response: `{ "status": "ok" }`

## Common Issues
1. **Service crashes on restart**: Check secrets are mounted in docker-compose.yml
2. **Authentication failures**: Verify JWT_SECRET_FILE path and content
3. **Database connection errors**: Check MONGODB_PASSWORD_FILE content
```

### 3. Monitoring & Alerts

#### OpenSearch Alert Rules
Create alerts in OpenSearch Dashboards:

**Service Restart Loop Alert**
```json
{
  "name": "Service Restart Loop Detection",
  "condition": {
    "query": "level:error AND (ENOENT OR \"no such file\")",
    "threshold": 5,
    "timeframe": "5m"
  },
  "action": {
    "webhook": "https://your-slack-webhook-url",
    "message": "⚠️ Service crash loop detected - check Docker secrets"
  }
}
```

**Authentication Failure Alert**
```json
{
  "name": "High Authentication Failure Rate",
  "condition": {
    "query": "service:auth-service AND status:401",
    "threshold": 10,
    "timeframe": "5m"
  },
  "action": {
    "webhook": "https://your-slack-webhook-url",
    "message": "🔐 High authentication failure rate detected"
  }
}
```

#### Container Health Monitoring
Add to `/scripts/monitor-services.sh`:

```bash
#!/bin/bash

# Check container restart counts
SERVICES=$(docker compose -f infrastructure/docker/docker-compose.microservices.yml ps --format json | jq -r '.Name')

for SERVICE in $SERVICES; do
  RESTARTS=$(docker inspect $SERVICE --format='{{.RestartCount}}')
  if [ "$RESTARTS" -gt 3 ]; then
    echo "⚠️ WARNING: $SERVICE has restarted $RESTARTS times"
    docker logs $SERVICE --tail=50
  fi
done
```

### 4. Deployment Process Update

Update `/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# 1. Run pre-deployment checks
./scripts/pre-deploy-check.sh

# 2. Pull latest changes
git pull origin main

# 3. Build containers
cd infrastructure/docker
docker compose -f docker-compose.microservices.yml build

# 4. Deploy with zero-downtime
docker compose -f docker-compose.microservices.yml up -d --no-deps --build

# 5. Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# 6. Verify all services are running
./scripts/verify-deployment.sh

# 7. Run smoke tests
echo "🧪 Running smoke tests..."
./scripts/smoke-tests.sh

echo "✅ Deployment complete"
```

### 5. Smoke Test Suite

Create `/scripts/smoke-tests.sh`:

```bash
#!/bin/bash
set -e

BASE_URL="https://projects.sapcindia.com"

# Test login page
echo "Testing login page..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/login")
if [ "$STATUS" != "200" ]; then
  echo "❌ Login page failed: HTTP $STATUS"
  exit 1
fi
echo "✅ Login page accessible"

# Test API health endpoints
SERVICES=("auth" "project" "subproject" "metrics" "jobs" "structural-elements" "excel")
for SERVICE in "${SERVICES[@]}"; do
  echo "Testing $SERVICE health..."
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/$SERVICE/health")
  if [ "$STATUS" != "200" ]; then
    echo "❌ $SERVICE health check failed: HTTP $STATUS"
    exit 1
  fi
  echo "✅ $SERVICE healthy"
done

# Test authentication
echo "Testing authentication..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"nsharma","password":"sapcindia@123"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Authentication failed"
  exit 1
fi
echo "✅ Authentication working"

echo "✅ All smoke tests passed"
```

### 6. Docker Compose Best Practices

#### Always Define All Required Secrets
```yaml
services:
  service-name:
    secrets:
      - jwt_secret        # ALWAYS include for auth
      - mongodb_password  # ALWAYS include for DB access
      - redis_password    # ALWAYS include for cache access
```

#### Use Explicit Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:6000/api/auth/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

#### Define Restart Policies
```yaml
restart: unless-stopped  # Prevent infinite restart loops
```

### 7. Incident Response Playbook

#### When Service Crashes on Restart

**Step 1: Check Container Logs**
```bash
docker logs <container-name> --tail=100
```

**Step 2: Verify Secrets Are Mounted**
```bash
docker exec <container-name> ls -la /run/secrets/
```

**Step 3: Check Docker Compose Configuration**
```bash
grep -A 10 "<service-name>:" infrastructure/docker/docker-compose.microservices.yml | grep secrets
```

**Step 4: Verify Secret Files Exist**
```bash
ls -la infrastructure/docker/secrets/
```

**Step 5: Fix and Redeploy**
```bash
# Add missing secrets to docker-compose.yml
# Rebuild and restart
docker compose -f infrastructure/docker/docker-compose.microservices.yml up -d --no-deps --build <service-name>
```

### 8. Traefik Routing Best Practices

#### Always Set Explicit Priorities
```yaml
labels:
  - "traefik.http.routers.auth-login.rule=PathPrefix(`/login`)"
  - "traefik.http.routers.auth-login.priority=40"  # Higher priority for specific paths
  
  - "traefik.http.routers.auth-root.rule=Path(`/`)"
  - "traefik.http.routers.auth-root.priority=30"   # Lower priority for general paths
```

#### Test Routing After Changes
```bash
# Check which router matches
curl -v https://projects.sapcindia.com/login 2>&1 | grep "< HTTP"
curl -v https://projects.sapcindia.com/ 2>&1 | grep "< HTTP"
```

### 9. Security Checklist

- [ ] All forms use POST method (never GET for credentials)
- [ ] Forms have `action="javascript:void(0)"` to prevent default submission
- [ ] JWT tokens stored in localStorage/sessionStorage (not cookies for now)
- [ ] Helmet CSP configured correctly for inline scripts
- [ ] All API endpoints use HTTPS
- [ ] Secrets never logged or exposed in error messages

### 10. Testing Checklist

Before every deployment:
- [ ] Run pre-deployment validation script
- [ ] Build all containers successfully
- [ ] Run smoke tests on staging/local
- [ ] Test login flow (including redirect)
- [ ] Verify all service health endpoints
- [ ] Check container logs for errors
- [ ] Verify secrets are mounted correctly

## Lessons Learned

1. **Docker Secrets Are Not Persistent**: Secrets must be explicitly defined in docker-compose.yml, not just mounted once
2. **Traefik Routing Order Matters**: Use explicit priorities to avoid conflicts
3. **Form Submission Defaults to GET**: Always specify POST method and prevent default
4. **CSP Blocks Inline Scripts**: Configure Helmet explicitly for login pages
5. **Test After Every Change**: Use automated tools (Playwright) to verify complete flows

## Action Items

- [ ] Create all prevention scripts (`pre-deploy-check.sh`, `smoke-tests.sh`, `monitor-services.sh`)
- [ ] Add README.md to each microservice
- [ ] Configure OpenSearch alerts for crash loops and auth failures
- [ ] Update main deployment script with validation steps
- [ ] Document this incident in team knowledge base
- [ ] Schedule monthly review of this prevention strategy
