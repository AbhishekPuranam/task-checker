#!/bin/bash

# Production Scaling Script
# This script scales the task-tracker application services

set -e

echo "🚀 Starting production scaling deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="docker"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Navigate to the docker directory
cd "$(dirname "$0")"

print_info "Current directory: $(pwd)"

# Pull latest images
print_info "Pulling latest images..."
docker compose -f "$COMPOSE_FILE" pull

# Build updated images
print_info "Building updated images..."
docker compose -f "$COMPOSE_FILE" build --no-cache tasktracker-app tasktracker-admin tasktracker-engineer

# Update Redis configuration first (requires restart)
print_info "Updating Redis configuration..."
docker compose -f "$COMPOSE_FILE" up -d redis
sleep 5

# Scale backend API to 3 replicas
print_info "Scaling backend API to 3 replicas..."
docker compose -f "$COMPOSE_FILE" up -d --scale tasktracker-app=3 --no-recreate tasktracker-app

# Wait for backends to be healthy
print_info "Waiting for backend services to be healthy..."
sleep 15

# Check backend health
print_info "Checking backend health..."
for i in {1..30}; do
    if curl -s -f http://localhost:5000/health > /dev/null 2>&1; then
        print_info "Backend is healthy!"
        break
    fi
    echo -n "."
    sleep 2
done

# Scale admin frontend to 2 replicas
print_info "Scaling admin frontend to 2 replicas..."
docker compose -f "$COMPOSE_FILE" up -d --scale tasktracker-admin=2 --no-recreate tasktracker-admin

# Scale engineer frontend to 2 replicas
print_info "Scaling engineer frontend to 2 replicas..."
docker compose -f "$COMPOSE_FILE" up -d --scale tasktracker-engineer=2 --no-recreate tasktracker-engineer

# Restart Traefik to pick up new service instances
print_info "Restarting Traefik to register new instances..."
docker compose -f "$COMPOSE_FILE" restart traefik

# Wait for Traefik to stabilize
sleep 10

# Show current status
print_info "Current service status:"
docker compose -f "$COMPOSE_FILE" ps

# Show scaled services
print_info "\n📊 Scaled Services:"
echo "Backend API: $(docker ps --filter 'name=tasktracker-app' --format '{{.Names}}' | wc -l) replicas"
echo "Admin Frontend: $(docker ps --filter 'name=tasktracker-admin' --format '{{.Names}}' | wc -l) replicas"
echo "Engineer Frontend: $(docker ps --filter 'name=tasktracker-engineer' --format '{{.Names}}' | wc -l) replicas"

# Test the endpoints
print_info "\n🔍 Testing endpoints..."
if curl -s -f -k https://projects.sapcindia.com/health > /dev/null 2>&1; then
    print_info "✅ Main endpoint is accessible"
else
    print_warning "⚠️  Main endpoint test failed (might need a few more seconds)"
fi

print_info "\n✅ Scaling deployment complete!"
print_info "Backend: 3 replicas | Admin: 2 replicas | Engineer: 2 replicas"
print_info "\nMonitor the services with:"
echo "  docker compose -f $COMPOSE_FILE ps"
echo "  docker compose -f $COMPOSE_FILE logs -f tasktracker-app"
