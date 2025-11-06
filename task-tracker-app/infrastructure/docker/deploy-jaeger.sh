#!/bin/bash
# Deploy Jaeger Distributed Tracing to production

set -e

echo "🚀 Deploying Jaeger Distributed Tracing..."

# Change to infrastructure directory
cd "$(dirname "$0")"

# Pull latest images
echo "📦 Pulling latest Jaeger images..."
docker compose -f docker-compose.yml -f docker-compose.jaeger.yml pull jaeger

# Start Jaeger services
docker compose -f docker-compose.yml -f docker-compose.jaeger.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for Jaeger services to be healthy..."
sleep 10

# Check Jaeger services
docker ps | grep jaeger

echo "✅ Jaeger deployed successfully!"
echo "📊 Access Jaeger UI at: https://projects.sapcindia.com/admin/jaeger"
echo "🔍 OTLP gRPC endpoint: localhost:4317"
echo "🔍 OTLP HTTP endpoint: localhost:4318"
echo "📈 Health check: http://localhost:14269/"
