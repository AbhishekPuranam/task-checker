#!/bin/bash

# ============================================
# OpenSearch Index Patterns & Dashboards Setup
# Creates separate index patterns and dashboards for each service
# ============================================

set -e

OPENSEARCH_HOST="${OPENSEARCH_HOST:-localhost}"
OPENSEARCH_PORT="${OPENSEARCH_PORT:-9200}"
OPENSEARCH_USER="${OPENSEARCH_USER:-admin}"
OPENSEARCH_PASSWORD="${OPENSEARCH_PASSWORD:-Admin@123456}"
OPENSEARCH_DASHBOARDS_HOST="${OPENSEARCH_DASHBOARDS_HOST:-localhost}"
OPENSEARCH_DASHBOARDS_PORT="${OPENSEARCH_DASHBOARDS_PORT:-5601}"

BASE_URL="http://${OPENSEARCH_HOST}:${OPENSEARCH_PORT}"
DASHBOARDS_URL="http://${OPENSEARCH_DASHBOARDS_HOST}:${OPENSEARCH_DASHBOARDS_PORT}"

echo "============================================"
echo "OpenSearch Index Patterns & Dashboards Setup"
echo "============================================"
echo ""

# Wait for OpenSearch to be ready
echo "Waiting for OpenSearch to be ready..."
until curl -s -u "${OPENSEARCH_USER}:${OPENSEARCH_PASSWORD}" "${BASE_URL}/_cluster/health" > /dev/null 2>&1; do
    echo "Waiting for OpenSearch..."
    sleep 5
done
echo "✓ OpenSearch is ready"
echo ""

# Wait for OpenSearch Dashboards to be ready
echo "Waiting for OpenSearch Dashboards to be ready..."
until curl -s "${DASHBOARDS_URL}/api/status" > /dev/null 2>&1; do
    echo "Waiting for OpenSearch Dashboards..."
    sleep 5
done
echo "✓ OpenSearch Dashboards is ready"
echo ""

# Define services
SERVICES=(
    "auth-service"
    "excel-service"
    "project-service"
    "subproject-service"
    "structural-elements-service"
    "jobs-service"
    "metrics-service"
    "mongodb"
    "redis"
    "traefik"
    "vault"
    "uptime-kuma"
)

# Create Index Patterns
echo "============================================"
echo "Creating Index Patterns"
echo "============================================"
echo ""

for SERVICE in "${SERVICES[@]}"; do
    INDEX_PATTERN="logs-${SERVICE}-*"
    
    echo "Creating index pattern: ${INDEX_PATTERN}"
    
    # Create index pattern via OpenSearch Dashboards API
    curl -X POST "${DASHBOARDS_URL}/api/saved_objects/index-pattern/${INDEX_PATTERN}" \
        -H "osd-xsrf: true" \
        -H "Content-Type: application/json" \
        -d "{
            \"attributes\": {
                \"title\": \"${INDEX_PATTERN}\",
                \"timeFieldName\": \"timestamp\"
            }
        }" 2>/dev/null || echo "  (may already exist)"
    
    echo "✓ Index pattern created: ${INDEX_PATTERN}"
    echo ""
done

# Create Index Templates for better field mapping
echo "============================================"
echo "Creating Index Templates"
echo "============================================"
echo ""

for SERVICE in "${SERVICES[@]}"; do
    INDEX_PATTERN="logs-${SERVICE}-*"
    
    echo "Creating index template for: ${INDEX_PATTERN}"
    
    curl -X PUT "${BASE_URL}/_index_template/logs-${SERVICE}-template" \
        -u "${OPENSEARCH_USER}:${OPENSEARCH_PASSWORD}" \
        -H "Content-Type: application/json" \
        -d "{
            \"index_patterns\": [\"${INDEX_PATTERN}\"],
            \"template\": {
                \"settings\": {
                    \"number_of_shards\": 1,
                    \"number_of_replicas\": 1,
                    \"index.refresh_interval\": \"5s\"
                },
                \"mappings\": {
                    \"properties\": {
                        \"timestamp\": {
                            \"type\": \"date\"
                        },
                        \"message\": {
                            \"type\": \"text\",
                            \"fields\": {
                                \"keyword\": {
                                    \"type\": \"keyword\",
                                    \"ignore_above\": 256
                                }
                            }
                        },
                        \"level\": {
                            \"type\": \"keyword\"
                        },
                        \"service_name\": {
                            \"type\": \"keyword\"
                        },
                        \"container_name\": {
                            \"type\": \"keyword\"
                        },
                        \"environment\": {
                            \"type\": \"keyword\"
                        },
                        \"host\": {
                            \"type\": \"keyword\"
                        },
                        \"source_type\": {
                            \"type\": \"keyword\"
                        }
                    }
                }
            },
            \"priority\": 100
        }" 2>/dev/null
    
    echo "✓ Index template created for: ${INDEX_PATTERN}"
    echo ""
done

# Create Dashboards
echo "============================================"
echo "Creating Dashboards"
echo "============================================"
echo ""

for SERVICE in "${SERVICES[@]}"; do
    INDEX_PATTERN="logs-${SERVICE}-*"
    DASHBOARD_TITLE="${SERVICE} Logs Dashboard"
    
    echo "Creating dashboard: ${DASHBOARD_TITLE}"
    
    # Create a simple dashboard with visualizations
    DASHBOARD_ID="dashboard-${SERVICE}"
    
    curl -X POST "${DASHBOARDS_URL}/api/saved_objects/dashboard/${DASHBOARD_ID}" \
        -H "osd-xsrf: true" \
        -H "Content-Type: application/json" \
        -d "{
            \"attributes\": {
                \"title\": \"${DASHBOARD_TITLE}\",
                \"description\": \"Log monitoring dashboard for ${SERVICE}\",
                \"panelsJSON\": \"[]\",
                \"optionsJSON\": \"{\\\"darkTheme\\\":false}\",
                \"version\": 1,
                \"timeRestore\": true,
                \"timeTo\": \"now\",
                \"timeFrom\": \"now-15m\",
                \"kibanaSavedObjectMeta\": {
                    \"searchSourceJSON\": \"{\\\"query\\\":{\\\"language\\\":\\\"kuery\\\",\\\"query\\\":\\\"\\\"},\\\"filter\\\":[]}\"
                }
            }
        }" 2>/dev/null || echo "  (may already exist)"
    
    echo "✓ Dashboard created: ${DASHBOARD_TITLE}"
    echo ""
done

# Create a Combined Overview Dashboard
echo "Creating combined overview dashboard..."

curl -X POST "${DASHBOARDS_URL}/api/saved_objects/dashboard/dashboard-overview" \
    -H "osd-xsrf: true" \
    -H "Content-Type: application/json" \
    -d '{
        "attributes": {
            "title": "All Services Overview Dashboard",
            "description": "Overview of all microservices logs",
            "panelsJSON": "[]",
            "optionsJSON": "{\"darkTheme\":false}",
            "version": 1,
            "timeRestore": true,
            "timeTo": "now",
            "timeFrom": "now-1h",
            "kibanaSavedObjectMeta": {
                "searchSourceJSON": "{\"query\":{\"language\":\"kuery\",\"query\":\"\"},\"filter\":[]}"
            }
        }
    }' 2>/dev/null || echo "  (may already exist)"

echo "✓ Combined overview dashboard created"
echo ""

echo "============================================"
echo "Setup Complete!"
echo "============================================"
echo ""
echo "Access OpenSearch Dashboards at: ${DASHBOARDS_URL}"
echo ""
echo "Index Patterns created:"
for SERVICE in "${SERVICES[@]}"; do
    echo "  - logs-${SERVICE}-*"
done
echo ""
echo "Dashboards created:"
for SERVICE in "${SERVICES[@]}"; do
    echo "  - ${SERVICE} Logs Dashboard"
done
echo "  - All Services Overview Dashboard"
echo ""
echo "============================================"
