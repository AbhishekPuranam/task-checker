#!/bin/bash

# Deploy OpenSearch + APM Stack for Task Tracker Monitoring
# This script sets up comprehensive logging and APM for production monitoring

set -e

echo "════════════════════════════════════════════════════════════════"
echo "  Task Tracker - OpenSearch + APM Deployment"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Configuration
COMPOSE_FILE="infrastructure/docker/docker-compose.opensearch.yml"
OPENSEARCH_PASSWORD="${OPENSEARCH_PASSWORD:-Admin@123456}"
APM_SECRET_TOKEN="${APM_SECRET_TOKEN:-your-secret-token}"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
fi
log_info "Docker installed"

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose is not installed"
    exit 1
fi
log_info "Docker Compose installed"

# Check system resources
TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM" -lt 4 ]; then
    log_warn "System has less than 4GB RAM. OpenSearch may have performance issues."
fi

# Set vm.max_map_count for OpenSearch
echo ""
echo "🔧 Configuring system settings..."
CURRENT_MAX_MAP=$(sysctl -n vm.max_map_count 2>/dev/null || echo 0)
if [ "$CURRENT_MAX_MAP" -lt 262144 ]; then
    log_warn "Setting vm.max_map_count to 262144 (required for OpenSearch)"
    sudo sysctl -w vm.max_map_count=262144
    echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
    log_info "vm.max_map_count configured"
else
    log_info "vm.max_map_count already configured"
fi

# Export environment variables
export OPENSEARCH_PASSWORD
export APM_SECRET_TOKEN

# Create necessary directories
echo ""
echo "📁 Creating directory structure..."
mkdir -p infrastructure/docker/otel
mkdir -p infrastructure/docker/fluent-bit
mkdir -p infrastructure/docker/logstash/pipeline
mkdir -p infrastructure/docker/logstash/config
mkdir -p infrastructure/docker/apm
log_info "Directories created"

# Stop existing services if running
echo ""
echo "🛑 Stopping existing observability services..."
docker-compose -f "$COMPOSE_FILE" down 2>/dev/null || true
log_info "Existing services stopped"

# Start OpenSearch first
echo ""
echo "🚀 Starting OpenSearch..."
docker-compose -f "$COMPOSE_FILE" up -d opensearch

# Wait for OpenSearch to be healthy
echo "⏳ Waiting for OpenSearch to be ready..."
MAX_TRIES=30
TRIES=0
while [ $TRIES -lt $MAX_TRIES ]; do
    if curl -s -u "admin:$OPENSEARCH_PASSWORD" http://localhost:9200/_cluster/health &> /dev/null; then
        log_info "OpenSearch is ready"
        break
    fi
    TRIES=$((TRIES+1))
    echo -n "."
    sleep 2
done

if [ $TRIES -eq $MAX_TRIES ]; then
    log_error "OpenSearch failed to start within timeout"
    docker-compose -f "$COMPOSE_FILE" logs opensearch
    exit 1
fi

# Create index templates
echo ""
echo "📊 Creating index templates..."
curl -s -u "admin:$OPENSEARCH_PASSWORD" -X PUT "http://localhost:9200/_index_template/logs-tasktracker" \
  -H 'Content-Type: application/json' \
  -d '{
    "index_patterns": ["logs-tasktracker-*"],
    "template": {
      "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "index.refresh_interval": "5s"
      },
      "mappings": {
        "properties": {
          "timestamp": { "type": "date" },
          "level": { "type": "keyword" },
          "message": { "type": "text" },
          "service": { "type": "keyword" },
          "container_name": { "type": "keyword" },
          "environment": { "type": "keyword" }
        }
      }
    }
  }' > /dev/null
log_info "Index templates created"

# Start remaining services
echo ""
echo "🚀 Starting remaining services..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for all services to be healthy
echo ""
echo "⏳ Waiting for all services to be ready..."
sleep 10

# Check service health
echo ""
echo "🏥 Checking service health..."

SERVICES=("opensearch:9200" "opensearch-dashboards:5601" "otel-collector:13133")
for service in "${SERVICES[@]}"; do
    SERVICE_NAME=$(echo "$service" | cut -d':' -f1)
    PORT=$(echo "$service" | cut -d':' -f2)
    
    if curl -s "http://localhost:$PORT" &> /dev/null || curl -s "http://localhost:$PORT/health" &> /dev/null; then
        log_info "$SERVICE_NAME is healthy"
    else
        log_warn "$SERVICE_NAME may not be fully ready yet"
    fi
done

# Display access information
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ Deployment Complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📊 OpenSearch Dashboards:"
echo "   URL: http://localhost:5601"
echo "   URL: http://62.72.56.99:5601"
echo "   Username: admin"
echo "   Password: $OPENSEARCH_PASSWORD"
echo ""
echo "🔍 OpenSearch API:"
echo "   URL: http://localhost:9200"
echo "   Username: admin"
echo "   Password: $OPENSEARCH_PASSWORD"
echo ""
echo "📡 OpenTelemetry Collector:"
echo "   OTLP gRPC: localhost:4317"
echo "   OTLP HTTP: localhost:4318"
echo "   Health Check: http://localhost:13133"
echo ""
echo "📈 APM Server:"
echo "   URL: http://localhost:8200"
echo "   Secret Token: $APM_SECRET_TOKEN"
echo ""
echo "💡 Next Steps:"
echo "   1. Open OpenSearch Dashboards to create visualizations"
echo "   2. Update backend services to send logs to OpenTelemetry"
echo "   3. Configure Uptime Kuma monitors using:"
echo "      node scripts/configure-uptime-monitors.js"
echo "   4. View logs in OpenSearch Dashboards under 'Discover'"
echo ""
echo "📚 Index Patterns:"
echo "   - logs-tasktracker-* (Application logs)"
echo "   - traces-tasktracker-* (Distributed traces)"
echo "   - apm-* (APM data)"
echo ""
echo "════════════════════════════════════════════════════════════════"
