#!/bin/bash

###########################################
# Uptime Kuma Docker Container Monitoring Setup
# 
# This script:
# 1. Updates docker-compose to mount Docker socket
# 2. Rebuilds and redeploys Uptime Kuma
# 3. Configures Docker container monitors
###########################################

set -e

echo "🚀 Starting Uptime Kuma Docker Monitoring Setup"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DOCKER_DIR="/opt/task-checker/task-tracker-app/infrastructure/docker"
SCRIPT_DIR="/opt/task-checker/task-tracker-app/scripts"
UPTIME_KUMA_URL="http://62.72.56.99:3001"

echo -e "${BLUE}📋 Step 1: Checking Docker socket mount${NC}"
if docker exec uptime-kuma test -S /var/run/docker.sock 2>/dev/null; then
    echo -e "${GREEN}✅ Docker socket is already mounted${NC}"
else
    echo -e "${YELLOW}⚠️  Docker socket not mounted, redeploying Uptime Kuma...${NC}"
    
    echo -e "${BLUE}📦 Step 2: Redeploying Uptime Kuma with Docker socket${NC}"
    cd "$DOCKER_DIR"
    docker-compose -f docker-compose.microservices.yml up -d uptime-kuma
    
    echo -e "${BLUE}⏳ Waiting for Uptime Kuma to be ready (30 seconds)...${NC}"
    sleep 30
fi

echo -e "${BLUE}🔍 Step 3: Verifying Uptime Kuma is accessible${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$UPTIME_KUMA_URL" | grep -q "200\|302"; then
    echo -e "${GREEN}✅ Uptime Kuma is accessible${NC}"
else
    echo -e "${RED}❌ Uptime Kuma is not accessible at $UPTIME_KUMA_URL${NC}"
    exit 1
fi

echo -e "${BLUE}🐋 Step 4: Verifying Docker socket access${NC}"
if docker exec uptime-kuma test -S /var/run/docker.sock; then
    echo -e "${GREEN}✅ Uptime Kuma can access Docker socket${NC}"
else
    echo -e "${RED}❌ Uptime Kuma cannot access Docker socket${NC}"
    echo -e "${YELLOW}💡 This may require container restart or permission changes${NC}"
    exit 1
fi

echo -e "${BLUE}📊 Step 5: Configuring Docker container monitors${NC}"
cd "$SCRIPT_DIR"

if [ ! -f "configure-uptime-docker-monitors.js" ]; then
    echo -e "${RED}❌ Script not found: configure-uptime-docker-monitors.js${NC}"
    exit 1
fi

# Run the configuration script
node configure-uptime-docker-monitors.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker monitoring setup complete!${NC}"
else
    echo -e "${RED}❌ Failed to configure monitors${NC}"
    exit 1
fi

echo ""
echo "=============================================="
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "📊 Monitoring Information:"
echo "   • Uptime Kuma URL: $UPTIME_KUMA_URL"
echo "   • Username: admin"
echo "   • Password: Coreinme@789"
echo ""
echo "🐳 Docker Container Monitors Created:"
echo "   • Infrastructure: Vault, MongoDB, Redis"
echo "   • Microservices: Auth, Excel, Project, SubProject, Metrics"
echo "   • Scaled Services: Structural Elements, Jobs, Admin, Engineer"
echo "   • Monitoring: Traefik, Uptime Kuma (self-monitor)"
echo ""
echo "💡 Tips:"
echo "   • Container monitors check if containers are running"
echo "   • Monitors run every 60 seconds"
echo "   • For scaled services, first replica is monitored"
echo "   • Check Uptime Kuma dashboard for real-time status"
echo ""
