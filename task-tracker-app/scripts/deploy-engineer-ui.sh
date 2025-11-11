#!/bin/bash

# Deploy Engineer UI Only - No other services affected
# This script rebuilds and restarts only the engineer containers

set -e

echo "🚀 Engineer UI Deployment Script"
echo "================================="
echo ""

# Check if we're on production server
if [ "$HOSTNAME" = "server" ] || [ "$HOSTNAME" = "localhost" ]; then
  echo "📍 Running on production server"
  CD_PATH="/opt/task-checker/task-tracker-app/infrastructure/docker"
else
  echo "📍 Running locally - will SSH to production"
  CD_PATH="/opt/task-checker/task-tracker-app/infrastructure/docker"
fi

echo ""
echo "Step 1: Building Engineer UI containers..."
echo "============================================"

if [ "$HOSTNAME" = "server" ] || [ "$HOSTNAME" = "localhost" ]; then
  cd $CD_PATH
  docker compose -f docker-compose.microservices.yml build tasktracker-engineer
else
  ssh root@62.72.56.99 "cd $CD_PATH && docker compose -f docker-compose.microservices.yml build tasktracker-engineer"
fi

echo "✅ Engineer UI built successfully!"
echo ""

echo "Step 2: Restarting Engineer UI containers..."
echo "============================================="

if [ "$HOSTNAME" = "server" ] || [ "$HOSTNAME" = "localhost" ]; then
  cd $CD_PATH
  docker compose -f docker-compose.microservices.yml up -d tasktracker-engineer
else
  ssh root@62.72.56.99 "cd $CD_PATH && docker compose -f docker-compose.microservices.yml up -d tasktracker-engineer"
fi

echo "✅ Engineer UI restarted successfully!"
echo ""

echo "Step 3: Checking container status..."
echo "====================================="

if [ "$HOSTNAME" = "server" ] || [ "$HOSTNAME" = "localhost" ]; then
  docker ps | grep tasktracker-engineer
else
  ssh root@62.72.56.99 "docker ps | grep tasktracker-engineer"
fi

echo ""
echo "Step 4: Checking logs..."
echo "========================"

if [ "$HOSTNAME" = "server" ] || [ "$HOSTNAME" = "localhost" ]; then
  docker compose -f docker-compose.microservices.yml logs --tail=20 tasktracker-engineer
else
  ssh root@62.72.56.99 "cd $CD_PATH && docker compose -f docker-compose.microservices.yml logs --tail=20 tasktracker-engineer"
fi

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo ""
echo "Engineer UI containers (docker-tasktracker-engineer-1 and docker-tasktracker-engineer-2) have been updated."
echo "All other services remain unchanged."
echo ""
echo "🌐 Test the new UI at: https://projects.sapcindia.com/engineer"
echo "🔐 Login credentials: engineer / engineer@123"
echo ""
echo "📊 Expected Features:"
echo "  ✓ Three tabs: Pending, Complete, No Clearance"
echo "  ✓ Configurable grouping (Grid, Level, Fire Proofing Type)"
echo "  ✓ Configurable sub-grouping (Fire Proofing Type, Job Title)"
echo "  ✓ Search across job names and structural elements"
echo "  ✓ Race track visualization showing progress"
echo "  ✓ Metrics for elements and SQM (pending/completed)"
echo ""
