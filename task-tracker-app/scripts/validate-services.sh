#!/bin/bash

# Service Validation Script
# Ensures all services are properly configured before deployment

echo "🔍 Validating Task Tracker Services..."
echo "========================================"

ERRORS=0

# Check if we're in the right directory
if [ ! -f "docker-compose.microservices.yml" ]; then
    echo "❌ Error: Must be run from infrastructure/docker directory"
    exit 1
fi

# 1. Validate JWT secrets in all services that need authentication
echo ""
echo "1️⃣ Checking JWT secrets configuration..."
SERVICES_NEEDING_JWT=("auth-service" "project-service" "subproject-service" "metrics-service" "excel-service" "structural-elements-service")

for service in "${SERVICES_NEEDING_JWT[@]}"; do
    if grep -A 50 "$service:" docker-compose.microservices.yml | grep -q "jwt_secret"; then
        echo "  ✅ $service has jwt_secret configured"
    else
        echo "  ❌ $service is MISSING jwt_secret!"
        ERRORS=$((ERRORS + 1))
    fi
done

# 2. Validate secrets files exist
echo ""
echo "2️⃣ Checking secrets files..."
REQUIRED_SECRETS=("jwt_secret" "mongodb_password" "redis_password" "session_secret" "vault_token")

for secret in "${REQUIRED_SECRETS[@]}"; do
    if [ -f "secrets/$secret" ]; then
        echo "  ✅ secrets/$secret exists"
    else
        echo "  ❌ secrets/$secret is MISSING!"
        ERRORS=$((ERRORS + 1))
    fi
done

# 3. Validate auth-service has login page routes
echo ""
echo "3️⃣ Checking auth-service login page configuration..."
if [ -f "../../services-microservices/auth-service/public/index.html" ]; then
    echo "  ✅ Login page (index.html) exists"
else
    echo "  ❌ Login page is MISSING!"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "app.get(\['\/', '\/login'\]" ../../services-microservices/auth-service/server.js; then
    echo "  ✅ Login routes configured in server.js"
else
    echo "  ❌ Login routes NOT configured!"
    ERRORS=$((ERRORS + 1))
fi

# 4. Check CSP configuration for login page
echo ""
echo "4️⃣ Checking Content Security Policy..."
if grep -q "scriptSrc.*unsafe-inline" ../../services-microservices/auth-service/server.js; then
    echo "  ✅ CSP allows inline scripts"
else
    echo "  ❌ CSP might block login page scripts!"
    ERRORS=$((ERRORS + 1))
fi

# 5. Validate redirectUrl in auth routes
echo ""
echo "5️⃣ Checking login redirectUrl..."
if grep -q "redirectUrl" ../../services-microservices/auth-service/routes/auth.js; then
    echo "  ✅ redirectUrl is returned in login response"
else
    echo "  ❌ redirectUrl is MISSING from login response!"
    ERRORS=$((ERRORS + 1))
fi

# 6. Check Traefik login route configuration
echo ""
echo "6️⃣ Checking Traefik login route..."
if grep -q "traefik.http.routers.login.rule" docker-compose.microservices.yml; then
    echo "  ✅ Traefik login route configured"
else
    echo "  ❌ Traefik login route is MISSING!"
    ERRORS=$((ERRORS + 1))
fi

# 7. Validate all services have health check endpoints
echo ""
echo "7️⃣ Checking health endpoints..."
for dir in ../../services-microservices/*/; do
    service_name=$(basename "$dir")
    if [ -f "$dir/routes/health.js" ] || grep -q "/health" "$dir/server.js" 2>/dev/null; then
        echo "  ✅ $service_name has health endpoint"
    else
        echo "  ⚠️  $service_name might be missing health endpoint"
    fi
done

# Summary
echo ""
echo "========================================"
if [ $ERRORS -eq 0 ]; then
    echo "✅ All validations passed! Services are properly configured."
    exit 0
else
    echo "❌ Found $ERRORS error(s). Please fix before deployment!"
    exit 1
fi
