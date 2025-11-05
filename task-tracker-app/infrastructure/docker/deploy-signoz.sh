#!/bin/bash
# Deploy SigNoz APM to production

set -e

echo "🚀 Deploying SigNoz APM..."

# Deploy to production
ssh root@62.72.56.99 << 'ENDSSH'
cd /opt/task-checker/task-tracker-app/infrastructure/docker

# Pull latest changes
git pull origin main

# Start SigNoz services
docker compose -f docker-compose.yml -f docker-compose.signoz.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for SigNoz services to be healthy..."
sleep 30

# Check SigNoz services
docker ps | grep signoz

echo "✅ SigNoz deployed successfully!"
echo "📊 Access SigNoz at: https://projects.sapcindia.com/admin/signoz"
ENDSSH

echo "✅ Deployment complete!"
