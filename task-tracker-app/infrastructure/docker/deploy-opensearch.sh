#!/bin/bash

# ============================================
# OpenSearch Deployment Script
# Deploys OpenSearch with Vector log collection
# ============================================

set -e

cd "$(dirname "$0")"

echo "============================================"
echo "OpenSearch Deployment"
echo "============================================"
echo ""

# Check if network exists
if ! docker network inspect tasktracker-network >/dev/null 2>&1; then
    echo "Creating tasktracker-network..."
    docker network create tasktracker-network
    echo "✓ Network created"
else
    echo "✓ Network already exists"
fi
echo ""

# Deploy OpenSearch stack
echo "Deploying OpenSearch stack..."
docker compose -f docker-compose.opensearch.yml up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 30

# Check service health
echo ""
echo "Checking service health..."

# Check OpenSearch
echo -n "OpenSearch: "
if curl -s -u admin:Admin@123456 http://localhost:9200/_cluster/health > /dev/null 2>&1; then
    echo "✓ Healthy"
else
    echo "✗ Not responding"
fi

# Check OpenSearch Dashboards
echo -n "OpenSearch Dashboards: "
if curl -s http://localhost:5601/api/status > /dev/null 2>&1; then
    echo "✓ Healthy"
else
    echo "✗ Not responding"
fi

# Check Vector
echo -n "Vector: "
if docker ps | grep -q tasktracker-vector; then
    echo "✓ Running"
else
    echo "✗ Not running"
fi

echo ""
echo "============================================"
echo "Setting up Index Patterns and Dashboards..."
echo "============================================"
echo ""

# Wait a bit more for dashboards to be fully ready
sleep 10

# Run setup script
if [ -f "./setup-opensearch-dashboards.sh" ]; then
    chmod +x ./setup-opensearch-dashboards.sh
    ./setup-opensearch-dashboards.sh
else
    echo "Warning: setup-opensearch-dashboards.sh not found"
fi

echo ""
echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo ""
echo "Services:"
echo "  OpenSearch:           http://localhost:9200"
echo "  OpenSearch Dashboards: http://localhost:5601"
echo ""
echo "Credentials:"
echo "  Username: admin"
echo "  Password: Admin@123456"
echo ""
echo "Index Patterns:"
echo "  - logs-auth-service-*"
echo "  - logs-excel-service-*"
echo "  - logs-project-service-*"
echo "  - logs-subproject-service-*"
echo "  - logs-structural-elements-service-*"
echo "  - logs-jobs-service-*"
echo "  - logs-metrics-service-*"
echo "  - logs-mongodb-*"
echo "  - logs-redis-*"
echo "  - logs-traefik-*"
echo "  - logs-vault-*"
echo "  - logs-uptime-kuma-*"
echo ""
echo "View logs:"
echo "  docker compose -f docker-compose.opensearch.yml logs -f"
echo ""
echo "============================================"
