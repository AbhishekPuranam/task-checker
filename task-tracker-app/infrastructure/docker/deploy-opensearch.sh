#!/bin/bash

# Deploy OpenSearch with Vector Log Collection
# Creates separate indices and dashboards for each service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$SCRIPT_DIR"

echo "🚀 Deploying OpenSearch with Vector Log Collection..."
echo ""

# Step 1: Deploy OpenSearch stack
echo "📦 Step 1: Deploying OpenSearch and Dashboards..."
cd "$DOCKER_DIR"
docker compose -f docker-compose.opensearch.yml up -d

echo ""
echo "⏳ Waiting for OpenSearch to be healthy..."
sleep 30

# Check OpenSearch health
until curl -s -k -u admin:Admin@123456 http://localhost:9200/_cluster/health > /dev/null 2>&1; do
    echo "Waiting for OpenSearch..."
    sleep 10
done

echo "✅ OpenSearch is healthy!"

# Step 2: Setup index patterns
echo ""
echo "📊 Step 2: Creating index patterns and templates..."
cd "$DOCKER_DIR/scripts"
chmod +x setup-opensearch-indices.sh
./setup-opensearch-indices.sh

# Step 3: Create dashboards
echo ""
echo "🎨 Step 3: Creating service dashboards..."
chmod +x create-opensearch-dashboards.sh
./create-opensearch-dashboards.sh

# Step 4: Show status
echo ""
echo "📊 Step 4: OpenSearch Stack Status..."
cd "$DOCKER_DIR"
docker compose -f docker-compose.opensearch.yml ps

echo ""
echo "✅ OpenSearch deployment complete!"
echo ""
echo "🌐 Access Points:"
echo "   - OpenSearch: http://localhost:9200"
echo "   - OpenSearch Dashboards: http://localhost:5601"
echo "   - Username: admin"
echo "   - Password: Admin@123456"
echo ""
