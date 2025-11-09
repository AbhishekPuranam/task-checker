#!/bin/bash
# Script to help find and count remaining console.log statements
# Usage: ./check-console-logs.sh

echo "==================================="
echo "Console.log Statement Analysis"
echo "==================================="
echo ""

echo "Backend Services:"
echo "-----------------"
find services/backend-api -name "*.js" -not -path "*/node_modules/*" -not -path "*/.next/*" | \
  xargs grep -n "console\.\(log\|error\|warn\|info\)" | wc -l | \
  awk '{print "Total: " $1 " statements"}'
echo ""

echo "By Category:"
echo ""

echo "Routes:"
find services/backend-api/routes -name "*.js" | \
  xargs grep -c "console\.\(log\|error\|warn\|info\)" 2>/dev/null | \
  awk -F: '{sum+=$2} END {print "  Total: " sum " statements"}'

echo ""
echo "Workers:"
find services/backend-api/workers -name "*.js" | \
  xargs grep -c "console\.\(log\|error\|warn\|info\)" 2>/dev/null | \
  awk -F: '{sum+=$2} END {print "  Total: " sum " statements"}'

echo ""
echo "Models:"
find services/backend-api/models -name "*.js" | \
  xargs grep -c "console\.\(log\|error\|warn\|info\)" 2>/dev/null | \
  awk -F: '{sum+=$2} END {print "  Total: " sum " statements"}'

echo ""
echo "Server & Config:"
find services/backend-api -maxdepth 1 -name "*.js" | \
  xargs grep -c "console\.\(log\|error\|warn\|info\)" 2>/dev/null | \
  awk -F: '{sum+=$2} END {print "  Total: " sum " statements"}'

echo ""
echo "==================================="
echo "Client Applications:"
echo "-----------------"
find clients -name "*.js" -not -path "*/node_modules/*" -not -path "*/.next/*" | \
  xargs grep -n "console\.\(log\|error\|warn\|info\)" | wc -l | \
  awk '{print "Total: " $1 " statements"}'

echo ""
echo "==================================="
echo "Top 10 Files with Most Console Logs:"
echo "-----------------"
find services clients -name "*.js" -not -path "*/node_modules/*" -not -path "*/.next/*" | \
  xargs grep -c "console\.\(log\|error\|warn\|info\)" 2>/dev/null | \
  sort -t: -k2 -rn | head -10

echo ""
echo "==================================="
echo "Complete! Run with './check-console-logs.sh' anytime"
