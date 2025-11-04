#!/bin/bash
# Initialize MongoDB Replica Set with Keyfile

set -e

KEYFILE_PATH="/tmp/mongodb-keyfile"

echo "🔑 Generating MongoDB keyfile..."
openssl rand -base64 756 > "$KEYFILE_PATH"
chmod 400 "$KEYFILE_PATH"

echo "📦 Creating Docker volume for keyfile..."
docker volume create mongodb_keyfile

echo "📝 Copying keyfile to Docker volume..."
docker run --rm \
  -v mongodb_keyfile:/data \
  -v "$KEYFILE_PATH":/keyfile:ro \
  busybox sh -c "cp /keyfile /data/mongodb-keyfile && chmod 400 /data/mongodb-keyfile && chown 999:999 /data/mongodb-keyfile"

echo "✅ MongoDB keyfile initialized successfully!"
echo "🚀 You can now start MongoDB with: docker compose up -d mongodb"

rm -f "$KEYFILE_PATH"
