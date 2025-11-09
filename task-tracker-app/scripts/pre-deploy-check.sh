#!/bin/bash
set -e

echo "🔍 Running pre-deployment validation..."

# Check all services have required secrets
SERVICES=(
  "auth-service:jwt_secret,session_secret,mongodb_password,redis_password"
  "project-service:jwt_secret,mongodb_password,redis_password"
  "subproject-service:jwt_secret,mongodb_password,redis_password"
  "metrics-service:jwt_secret,mongodb_password,redis_password"
  "excel-service:jwt_secret,mongodb_password,redis_password"
  "jobs-service:jwt_secret,mongodb_password,redis_password"
  "structural-elements-service:jwt_secret,mongodb_password,redis_password"
)

COMPOSE_FILE="infrastructure/docker/docker-compose.microservices.yml"

for SERVICE_DEF in "${SERVICES[@]}"; do
  SERVICE=$(echo "$SERVICE_DEF" | cut -d: -f1)
  REQUIRED_SECRETS=$(echo "$SERVICE_DEF" | cut -d: -f2 | tr ',' ' ')
  
  echo "Checking $SERVICE..."
  
  # Extract service section from docker-compose
  SERVICE_CONFIG=$(awk "/^  $SERVICE:/,/^  [a-zA-Z]/" "$COMPOSE_FILE")
  
  for SECRET in $REQUIRED_SECRETS; do
    if ! echo "$SERVICE_CONFIG" | grep -q "- $SECRET"; then
      echo "❌ ERROR: $SERVICE missing secret: $SECRET"
      exit 1
    fi
  done
  echo "✅ $SERVICE secrets validated"
done

# Verify all secret files exist
echo ""
echo "Checking secret files..."
SECRETS_DIR="infrastructure/docker/secrets"
REQUIRED_FILES=("jwt_secret" "mongodb_password" "redis_password" "session_secret" "vault_token")

for FILE in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$SECRETS_DIR/$FILE" ]; then
    echo "❌ ERROR: Missing secret file: $FILE"
    exit 1
  fi
  
  # Check file is not empty
  if [ ! -s "$SECRETS_DIR/$FILE" ]; then
    echo "❌ ERROR: Secret file is empty: $FILE"
    exit 1
  fi
  
  echo "✅ Secret file exists and not empty: $FILE"
done

# Validate docker-compose syntax
echo ""
echo "Validating docker-compose syntax..."
if docker compose -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
  echo "✅ Docker Compose syntax valid"
else
  echo "❌ ERROR: Invalid docker-compose syntax"
  exit 1
fi

# Check for common misconfigurations
echo ""
echo "Checking for common misconfigurations..."

# Check if services expose ports correctly
if grep -q "expose:" "$COMPOSE_FILE"; then
  echo "✅ Services use 'expose' for internal ports"
else
  echo "⚠️  WARNING: No 'expose' directives found - services may not be accessible"
fi

# Check Traefik labels are present
if grep -q "traefik.enable=true" "$COMPOSE_FILE"; then
  echo "✅ Traefik labels configured"
else
  echo "❌ ERROR: No Traefik labels found"
  exit 1
fi

# Check health checks are defined
SERVICES_WITHOUT_HEALTHCHECK=$(grep -A 20 "^  [a-z-]*-service:" "$COMPOSE_FILE" | grep -B 1 "image:" | grep -v "healthcheck:" | wc -l)
if [ "$SERVICES_WITHOUT_HEALTHCHECK" -gt 0 ]; then
  echo "⚠️  WARNING: Some services missing health checks"
else
  echo "✅ All services have health checks"
fi

echo ""
echo "✅ All pre-deployment checks passed"
