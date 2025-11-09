#!/bin/bash

# Script to clear Redis cache
# This helps ensure fresh data and prevents stale cache issues

set -e

# Get Redis password from Docker secret
REDIS_PASSWORD=$(docker exec $(docker ps --filter name=tasktracker-redis --format '{{.ID}}') cat /run/secrets/redis_password)

# Clear all Redis cache
echo "$(date '+%Y-%m-%d %H:%M:%S') - Clearing Redis cache..."
docker exec $(docker ps --filter name=tasktracker-redis --format '{{.ID}}') redis-cli -a "$REDIS_PASSWORD" FLUSHALL 2>&1 | grep -v "Warning:"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Redis cache cleared successfully"

# Optional: Log to a file
LOG_FILE="/opt/task-checker/logs/redis-clear.log"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Redis cache cleared" >> "$LOG_FILE"
