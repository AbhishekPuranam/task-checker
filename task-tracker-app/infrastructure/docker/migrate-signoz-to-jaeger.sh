#!/bin/bash
# Migration Script: Remove SigNoz and Deploy Jaeger
# This script removes SigNoz from production and replaces it with Jaeger

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Migration: SigNoz → Jaeger                         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# Change to infrastructure directory
cd "$(dirname "$0")"

echo -e "${YELLOW}⚠️  This will:${NC}"
echo "   1. Stop and remove SigNoz containers"
echo "   2. Remove SigNoz volumes (data will be lost)"
echo "   3. Deploy Jaeger for distributed tracing"
echo "   4. Update application configuration"
echo ""
read -p "Continue? (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${BLUE}Step 1: Stopping SigNoz services...${NC}"
# Stop SigNoz if it's running
if docker compose -f docker-compose.yml -f docker-compose.signoz.yml ps | grep -q signoz; then
    docker compose -f docker-compose.yml -f docker-compose.signoz.yml down
    echo -e "${GREEN}✓ SigNoz services stopped${NC}"
else
    echo -e "${YELLOW}⚠️  SigNoz services not running${NC}"
fi

echo ""
echo -e "${BLUE}Step 2: Removing SigNoz volumes...${NC}"
# Remove SigNoz volumes
docker volume rm docker_clickhouse_data 2>/dev/null || echo -e "${YELLOW}⚠️  ClickHouse volume not found${NC}"
echo -e "${GREEN}✓ SigNoz volumes removed${NC}"

echo ""
echo -e "${BLUE}Step 3: Pulling Jaeger image...${NC}"
docker compose -f docker-compose.yml -f docker-compose.jaeger.yml pull jaeger
echo -e "${GREEN}✓ Jaeger image pulled${NC}"

echo ""
echo -e "${BLUE}Step 4: Starting services with Jaeger...${NC}"
docker compose -f docker-compose.yml -f docker-compose.jaeger.yml up -d
echo -e "${GREEN}✓ Services started with Jaeger${NC}"

echo ""
echo -e "${BLUE}Step 5: Waiting for Jaeger to be healthy...${NC}"
sleep 15

# Check Jaeger health
if docker exec tasktracker-jaeger wget --spider -q http://localhost:14269/; then
    echo -e "${GREEN}✓ Jaeger is healthy${NC}"
else
    echo -e "${RED}✗ Jaeger health check failed${NC}"
    echo -e "${YELLOW}⚠️  Check logs: docker logs tasktracker-jaeger${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✓ Migration completed successfully!                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Jaeger Access:${NC}"
echo "   UI: https://projects.sapcindia.com/admin/jaeger"
echo "   Health: http://localhost:14269/"
echo "   OTLP gRPC: localhost:4317"
echo "   OTLP HTTP: localhost:4318"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "   View logs: docker logs tasktracker-jaeger"
echo "   Check status: docker ps | grep jaeger"
echo "   View traces: Open https://projects.sapcindia.com/admin/jaeger"
echo ""
echo -e "${YELLOW}Note: Old SigNoz trace data has been removed.${NC}"
echo -e "${YELLOW}New traces will appear in Jaeger within a few minutes.${NC}"
