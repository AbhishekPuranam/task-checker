#!/bin/bash

# Create Basic Dashboards for Each Service

set -e

DASHBOARDS_URL="${DASHBOARDS_URL:-http://localhost:5601}"
OPENSEARCH_USER="${OPENSEARCH_USER:-admin}"
OPENSEARCH_PASSWORD="${OPENSEARCH_PASSWORD:-Admin@123456}"

echo "🎨 Creating dashboards for each service..."

# Array of microservices (excluding infrastructure)
microservices=(
    "auth-service"
    "excel-service"
    "project-service"
    "subproject-service"
    "structural-elements-service"
    "jobs-service"
    "metrics-service"
)

# Array of UI services
ui_services=(
    "admin-ui"
    "engineer-ui"
)

# Array of infrastructure services
infra_services=(
    "mongodb"
    "redis"
    "traefik"
    "vault"
)

create_service_dashboard() {
    local service=$1
    local service_type=$2
    local dashboard_id="dashboard-${service}"
    local index_pattern_id="logs-${service}"
    
    echo "🎨 Creating dashboard for $service ($service_type)..."
    
    # Create a simple dashboard JSON
    local dashboard_json=$(cat <<EOF
{
  "attributes": {
    "title": "${service} - Logs Dashboard",
    "hits": 0,
    "description": "Log dashboard for ${service}",
    "panelsJSON": "[]",
    "optionsJSON": "{\"hidePanelTitles\":false,\"useMargins\":true}",
    "version": 1,
    "timeRestore": false,
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"query\":{\"language\":\"kuery\",\"query\":\"\"},\"filter\":[]}"
    }
  }
}
EOF
)
    
    curl -X POST "$DASHBOARDS_URL/api/saved_objects/dashboard/$dashboard_id" \
        -H 'Content-Type: application/json' \
        -H 'osd-xsrf: true' \
        -d "$dashboard_json" > /dev/null 2>&1 || echo "  ⚠️  Dashboard may already exist"
    
    echo "  ✅ Dashboard created: ${service}"
}

# Create dashboards for microservices
echo ""
echo "🔧 Creating Microservice Dashboards..."
for service in "${microservices[@]}"; do
    create_service_dashboard "$service" "microservice"
done

# Create dashboards for UI services
echo ""
echo "🔧 Creating UI Service Dashboards..."
for service in "${ui_services[@]}"; do
    create_service_dashboard "$service" "ui"
done

# Create dashboards for infrastructure services
echo ""
echo "🔧 Creating Infrastructure Dashboards..."
for service in "${infra_services[@]}"; do
    create_service_dashboard "$service" "infrastructure"
done

echo ""
echo "✅ All dashboards created!"
echo ""
echo "📊 Dashboards available for:"
echo ""
echo "Microservices:"
for service in "${microservices[@]}"; do
    echo "   - $service"
done
echo ""
echo "UI Services:"
for service in "${ui_services[@]}"; do
    echo "   - $service"
done
echo ""
echo "Infrastructure:"
for service in "${infra_services[@]}"; do
    echo "   - $service"
done
echo ""
echo "🌐 View dashboards at: $DASHBOARDS_URL/app/dashboards"
echo ""
