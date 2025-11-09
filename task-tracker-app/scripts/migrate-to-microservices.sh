#!/bin/bash

# Microservices Migration Script
# This script helps transition from monolithic to microservices architecture

set -e

echo "🔄 Task Tracker - Monolithic to Microservices Migration"
echo "========================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REMOTE_HOST="root@62.72.56.99"
REMOTE_PATH="/opt/task-checker/task-tracker-app"
LOCAL_PATH="/Users/apuranam/Documents/GitHub/task-checker/task-tracker-app"

echo "📋 Pre-Migration Checklist"
echo "-------------------------"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the task-tracker-app directory${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Running from correct directory${NC}"

# Check if shared directory exists
if [ ! -d "shared/models" ]; then
    echo -e "${RED}❌ Error: Shared models directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Shared directory structure exists${NC}"

# Check if microservices directory exists
if [ ! -d "services-microservices" ]; then
    echo -e "${RED}❌ Error: Microservices directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Microservices directory exists${NC}"

# Check if docker-compose.microservices.yml exists
if [ ! -f "infrastructure/docker/docker-compose.microservices.yml" ]; then
    echo -e "${RED}❌ Error: Microservices docker-compose file not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Microservices docker-compose configuration exists${NC}"

echo ""
echo "🎯 Migration Steps"
echo "-------------------------"

# Step 1: Commit changes
echo -e "${YELLOW}Step 1: Committing changes to Git...${NC}"
git add .
git commit -m "feat: microservices architecture implementation

- Split monolithic backend into 7 microservices
- Added Traefik API gateway for routing and load balancing  
- Implemented 3 replicas each for Structural Elements and Jobs services
- Created shared models/middleware/utils for all services
- Updated docker-compose with microservices configuration
- Added comprehensive deployment documentation

Services:
- Auth Service (6000): Authentication & Authorization
- Excel Service (6001): Batch processing with BullMQ
- Project Service (6002): Project aggregation
- SubProject Service (6003): SubProject management
- Structural Elements Service (6004-6006): 3 replicas
- Jobs Service (6007-6009): 3 replicas
- Metrics Service (6010): Reports & Analytics

Infrastructure remains unchanged (MongoDB, Redis, Monitoring)"

echo -e "${GREEN}✅ Changes committed${NC}"

# Step 2: Push to GitHub
echo -e "${YELLOW}Step 2: Pushing to GitHub...${NC}"
git push origin main

echo -e "${GREEN}✅ Pushed to GitHub${NC}"

# Step 3: Pull on production server
echo -e "${YELLOW}Step 3: Pulling latest code on production server...${NC}"
ssh $REMOTE_HOST "cd $REMOTE_PATH && git pull origin main"

echo -e "${GREEN}✅ Code pulled on production${NC}"

# Step 4: Backup current system
echo -e "${YELLOW}Step 4: Creating backup of current system...${NC}"
ssh $REMOTE_HOST "cd $REMOTE_PATH/infrastructure/docker && \
    mkdir -p /root/backups/\$(date +%Y%m%d_%H%M%S) && \
    docker compose ps > /root/backups/\$(date +%Y%m%d_%H%M%S)/running-services.txt && \
    docker compose config > /root/backups/\$(date +%Y%m%d_%H%M%S)/current-compose.yml"

echo -e "${GREEN}✅ Backup created${NC}"

# Step 5: Test build locally (optional)
echo ""
read -p "Do you want to test build microservices locally first? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Building microservices locally...${NC}"
    cd infrastructure/docker
    docker compose -f docker-compose.microservices.yml build
    echo -e "${GREEN}✅ Local build successful${NC}"
    cd ../..
fi

# Step 6: Deploy to production
echo ""
echo -e "${YELLOW}⚠️  WARNING: About to deploy microservices to production${NC}"
echo "This will:"
echo "  - Stop current monolithic services"
echo "  - Build new microservice containers"
echo "  - Start 13 independent services"
echo "  - Configure Traefik load balancing"
echo ""
read -p "Continue with production deployment? (yes/no) " -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

echo -e "${YELLOW}Step 6: Deploying microservices to production...${NC}"

# Build on production
echo "Building services..."
ssh $REMOTE_HOST "cd $REMOTE_PATH/infrastructure/docker && \
    docker compose -f docker-compose.microservices.yml build"

echo -e "${GREEN}✅ Services built${NC}"

# Start infrastructure first
echo "Starting infrastructure services (MongoDB, Redis, Vault)..."
ssh $REMOTE_HOST "cd $REMOTE_PATH/infrastructure/docker && \
    docker compose -f docker-compose.microservices.yml up -d mongodb redis vault"

echo "Waiting for MongoDB replica set initialization (45 seconds)..."
sleep 45

# Start backend microservices
echo "Starting backend microservices..."
ssh $REMOTE_HOST "cd $REMOTE_PATH/infrastructure/docker && \
    docker compose -f docker-compose.microservices.yml up -d \
    auth-service \
    excel-service \
    project-service \
    subproject-service \
    structural-elements-service \
    jobs-service \
    metrics-service"

echo "Waiting for backend services to be healthy (30 seconds)..."
sleep 30

# Start frontend services
echo "Starting frontend services..."
ssh $REMOTE_HOST "cd $REMOTE_PATH/infrastructure/docker && \
    docker compose -f docker-compose.microservices.yml up -d \
    tasktracker-admin \
    tasktracker-engineer"

# Start Traefik and monitoring
echo "Starting Traefik and monitoring..."
ssh $REMOTE_HOST "cd $REMOTE_PATH/infrastructure/docker && \
    docker compose -f docker-compose.microservices.yml up -d traefik uptime-kuma"

echo -e "${GREEN}✅ All services started${NC}"

# Step 7: Verify deployment
echo ""
echo -e "${YELLOW}Step 7: Verifying deployment...${NC}"

echo "Checking service status..."
ssh $REMOTE_HOST "cd $REMOTE_PATH/infrastructure/docker && \
    docker compose -f docker-compose.microservices.yml ps"

# Check health endpoints
echo ""
echo "Testing health endpoints..."
SERVICES=("auth-service:6000" "excel-service:6001" "project-service:6002" "subproject-service:6003" "structural-elements-service:6004" "jobs-service:6007" "metrics-service:6010")

for service in "${SERVICES[@]}"; do
    IFS=':' read -r name port <<< "$service"
    echo -n "Testing $name... "
    if ssh $REMOTE_HOST "curl -s http://localhost:$port/health > /dev/null"; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${RED}❌${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 Migration Complete!${NC}"
echo ""
echo "📊 Post-Deployment Steps:"
echo "1. Monitor logs: ssh $REMOTE_HOST 'cd $REMOTE_PATH/infrastructure/docker && docker compose -f docker-compose.microservices.yml logs -f'"
echo "2. Check Traefik dashboard: https://traefik.projects.sapcindia.com"
echo "3. Test application: https://projects.sapcindia.com"
echo "4. Monitor Uptime Kuma: http://62.72.56.99:3001"
echo "5. Check OpenSearch logs for any errors"
echo ""
echo "📖 Full deployment guide: docs/MICROSERVICES_DEPLOYMENT.md"
echo ""
echo -e "${YELLOW}⚠️  If you encounter issues, rollback with:${NC}"
echo "ssh $REMOTE_HOST 'cd $REMOTE_PATH/infrastructure/docker && docker compose -f docker-compose.microservices.yml down && docker compose -f docker-compose.yml up -d'"
