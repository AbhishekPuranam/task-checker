#!/bin/bash

# Clear grouping cache in Redis to fix pagination issue
# This clears cached data that was limited to 5 elements per group

echo "🧹 Clearing grouping cache from Redis..."

# Connect to Redis and delete all grouping cache keys
redis-cli --scan --pattern "grouping:*" | xargs -L 1 redis-cli DEL

echo "✅ Grouping cache cleared successfully!"
echo "ℹ️  New requests will fetch fresh data with all elements for proper pagination."
