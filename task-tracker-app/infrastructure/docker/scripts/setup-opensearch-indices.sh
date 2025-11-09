#!/bin/bash

# OpenSearch Index Patterns and Dashboards Setup Script
# This script creates separate index patterns and dashboards for each service

set -e

OPENSEARCH_URL="${OPENSEARCH_URL:-http://localhost:9200}"
OPENSEARCH_USER="${OPENSEARCH_USER:-admin}"
OPENSEARCH_PASSWORD="${OPENSEARCH_PASSWORD:-Admin@123456}"
DASHBOARDS_URL="${DASHBOARDS_URL:-http://localhost:5601}"

echo "🚀 Setting up OpenSearch Index Patterns and Dashboards..."
echo "OpenSearch URL: $OPENSEARCH_URL"
echo "Dashboards URL: $DASHBOARDS_URL"

# Wait for OpenSearch to be ready
echo "⏳ Waiting for OpenSearch to be ready..."
until curl -s -k -u "$OPENSEARCH_USER:$OPENSEARCH_PASSWORD" "$OPENSEARCH_URL/_cluster/health" > /dev/null; do
    echo "Waiting for OpenSearch..."
    sleep 5
done
echo "✅ OpenSearch is ready!"

# Wait for OpenSearch Dashboards to be ready
echo "⏳ Waiting for OpenSearch Dashboards to be ready..."
until curl -s "$DASHBOARDS_URL/api/status" > /dev/null; do
    echo "Waiting for OpenSearch Dashboards..."
    sleep 5
done
echo "✅ OpenSearch Dashboards is ready!"

# Array of services
services=(
    "auth-service"
    "excel-service"
    "project-service"
    "subproject-service"
    "structural-elements-service"
    "jobs-service"
    "metrics-service"
    "admin-ui"
    "engineer-ui"
    "mongodb"
    "redis"
    "traefik"
    "vault"
    "uptime-kuma"
    "other"
)

# Function to create index pattern
create_index_pattern() {
    local service=$1
    local index_pattern="logs-${service}-*"
    local pattern_id="logs-${service}"
    
    echo "📊 Creating index pattern for $service..."
    
    curl -X POST "$DASHBOARDS_URL/api/saved_objects/index-pattern/$pattern_id" \
        -H 'Content-Type: application/json' \
        -H 'osd-xsrf: true' \
        -d "{
            \"attributes\": {
                \"title\": \"$index_pattern\",
                \"timeFieldName\": \"@timestamp\"
            }
        }" > /dev/null 2>&1 || echo "  ⚠️  Index pattern may already exist"
    
    echo "  ✅ Index pattern created: $index_pattern"
}

# Function to create index template
create_index_template() {
    local service=$1
    local template_name="logs-${service}-template"
    local index_pattern="logs-${service}-*"
    
    echo "📋 Creating index template for $service..."
    
    curl -X PUT "$OPENSEARCH_URL/_index_template/$template_name" \
        -H 'Content-Type: application/json' \
        -u "$OPENSEARCH_USER:$OPENSEARCH_PASSWORD" \
        -d "{
            \"index_patterns\": [\"$index_pattern\"],
            \"template\": {
                \"settings\": {
                    \"number_of_shards\": 1,
                    \"number_of_replicas\": 0,
                    \"index.refresh_interval\": \"5s\"
                },
                \"mappings\": {
                    \"properties\": {
                        \"@timestamp\": { \"type\": \"date\" },
                        \"message\": { \"type\": \"text\" },
                        \"service_name\": { \"type\": \"keyword\" },
                        \"container_name\": { \"type\": \"keyword\" },
                        \"log_level\": { \"type\": \"keyword\" },
                        \"environment\": { \"type\": \"keyword\" },
                        \"host\": { \"type\": \"keyword\" },
                        \"source_type\": { \"type\": \"keyword\" }
                    }
                }
            },
            \"priority\": 100
        }" > /dev/null 2>&1
    
    echo "  ✅ Index template created: $template_name"
}

# Create index templates for all services
echo ""
echo "🔧 Creating index templates..."
for service in "${services[@]}"; do
    create_index_template "$service"
done

echo ""
echo "⏳ Waiting 10 seconds for templates to propagate..."
sleep 10

# Create index patterns for all services
echo ""
echo "🔧 Creating index patterns..."
for service in "${services[@]}"; do
    create_index_pattern "$service"
done

# Create a combined index pattern for all services
echo ""
echo "📊 Creating combined index pattern for all services..."
curl -X POST "$DASHBOARDS_URL/api/saved_objects/index-pattern/logs-all-services" \
    -H 'Content-Type: application/json' \
    -H 'osd-xsrf: true' \
    -d '{
        "attributes": {
            "title": "logs-*",
            "timeFieldName": "@timestamp"
        }
    }' > /dev/null 2>&1 || echo "  ⚠️  Combined index pattern may already exist"

echo "  ✅ Combined index pattern created: logs-*"

# Set default index pattern
echo ""
echo "🔧 Setting default index pattern..."
curl -X POST "$DASHBOARDS_URL/api/opensearch-dashboards/settings/defaultIndex" \
    -H 'Content-Type: application/json' \
    -H 'osd-xsrf: true' \
    -d '{
        "value": "logs-all-services"
    }' > /dev/null 2>&1

echo "  ✅ Default index pattern set"

echo ""
echo "✅ OpenSearch setup complete!"
echo ""
echo "📊 Index Patterns Created:"
for service in "${services[@]}"; do
    echo "   - logs-${service}-*"
done
echo "   - logs-* (combined)"
echo ""
echo "🌐 Access OpenSearch Dashboards at: $DASHBOARDS_URL"
echo "   Username: $OPENSEARCH_USER"
echo "   Password: $OPENSEARCH_PASSWORD"
echo ""
echo "💡 Tips:"
echo "   - Navigate to 'Discover' to view logs"
echo "   - Use the index pattern dropdown to switch between services"
echo "   - Create visualizations and dashboards for each service"
echo ""
