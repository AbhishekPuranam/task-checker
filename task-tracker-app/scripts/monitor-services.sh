#!/bin/bash
set -e

echo "🔍 Monitoring container health..."

COMPOSE_FILE="infrastructure/docker/docker-compose.microservices.yml"

# Get list of running containers
CONTAINERS=$(docker compose -f "$COMPOSE_FILE" ps --format json | jq -r '.Name')

echo ""
echo "📊 Container Status Report"
echo "=========================="

ISSUES_FOUND=0

for CONTAINER in $CONTAINERS; do
  # Check if container exists
  if ! docker inspect "$CONTAINER" > /dev/null 2>&1; then
    echo "⚠️  Container not found: $CONTAINER"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    continue
  fi
  
  # Get container info
  STATUS=$(docker inspect "$CONTAINER" --format='{{.State.Status}}')
  RESTARTS=$(docker inspect "$CONTAINER" --format='{{.RestartCount}}')
  HEALTH=$(docker inspect "$CONTAINER" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")
  STARTED=$(docker inspect "$CONTAINER" --format='{{.State.StartedAt}}')
  
  # Check restart count
  if [ "$RESTARTS" -gt 3 ]; then
    echo ""
    echo "⚠️  WARNING: $CONTAINER has restarted $RESTARTS times"
    echo "   Status: $STATUS"
    echo "   Health: $HEALTH"
    echo "   Started: $STARTED"
    echo ""
    echo "   Recent logs:"
    docker logs "$CONTAINER" --tail=20 | sed 's/^/   /'
    echo ""
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi
  
  # Check if container is not running
  if [ "$STATUS" != "running" ]; then
    echo ""
    echo "❌ ERROR: $CONTAINER is not running"
    echo "   Status: $STATUS"
    echo "   Restart count: $RESTARTS"
    echo ""
    echo "   Recent logs:"
    docker logs "$CONTAINER" --tail=30 | sed 's/^/   /'
    echo ""
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi
  
  # Check health status
  if [ "$HEALTH" == "unhealthy" ]; then
    echo ""
    echo "❌ ERROR: $CONTAINER is unhealthy"
    echo "   Status: $STATUS"
    echo "   Restart count: $RESTARTS"
    echo ""
    echo "   Recent logs:"
    docker logs "$CONTAINER" --tail=30 | sed 's/^/   /'
    echo ""
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
  fi
done

echo ""
if [ "$ISSUES_FOUND" -eq 0 ]; then
  echo "✅ All containers healthy"
else
  echo "⚠️  Found $ISSUES_FOUND issue(s)"
  exit 1
fi

# Check for common error patterns in logs
echo ""
echo "🔍 Checking for common error patterns..."

ERROR_PATTERNS=(
  "ENOENT.*secrets"
  "Connection refused"
  "ECONNREFUSED"
  "Authentication failed"
  "MongoServerError"
  "Redis connection failed"
)

for PATTERN in "${ERROR_PATTERNS[@]}"; do
  MATCHES=$(docker compose -f "$COMPOSE_FILE" logs --since 10m 2>&1 | grep -i "$PATTERN" | wc -l)
  if [ "$MATCHES" -gt 0 ]; then
    echo "⚠️  Found $MATCHES instances of: $PATTERN"
    echo "   Sample log entries:"
    docker compose -f "$COMPOSE_FILE" logs --since 10m 2>&1 | grep -i "$PATTERN" | head -3 | sed 's/^/   /'
    echo ""
  fi
done

echo ""
echo "✅ Monitoring complete"
