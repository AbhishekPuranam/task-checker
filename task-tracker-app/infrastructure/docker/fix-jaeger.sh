#!/bin/bash
# Fix Jaeger UI white page issue by adding QUERY_BASE_PATH

# Stop and remove existing Jaeger container
docker stop tasktracker-jaeger
docker rm tasktracker-jaeger

# Recreate Jaeger with correct base path configuration
docker run -d \
  --name tasktracker-jaeger \
  --network infrastructure_tasktracker-network \
  -e COLLECTOR_OTLP_ENABLED=true \
  -e METRICS_STORAGE_TYPE=prometheus \
  -e COLLECTOR_ZIPKIN_HOST_PORT=:9411 \
  -e QUERY_BASE_PATH=/admin/jaeger \
  -p 4317-4318:4317-4318 \
  -p 5775:5775/udp \
  -p 5778:5778 \
  -p 6831-6832:6831-6832/udp \
  -p 9411:9411 \
  -p 14250:14250 \
  -p 14268-14269:14268-14269 \
  -p 16686:16686 \
  --label 'traefik.enable=true' \
  --label 'traefik.http.routers.jaeger.rule=Host(`projects.sapcindia.com`) && PathPrefix(`/admin/jaeger`)' \
  --label 'traefik.http.routers.jaeger.entrypoints=web' \
  --label 'traefik.http.routers.jaeger.priority=110' \
  --label 'traefik.http.routers.jaeger-secure.rule=Host(`projects.sapcindia.com`) && PathPrefix(`/admin/jaeger`)' \
  --label 'traefik.http.routers.jaeger-secure.entrypoints=websecure' \
  --label 'traefik.http.routers.jaeger-secure.tls.certresolver=letsencrypt' \
  --label 'traefik.http.routers.jaeger-secure.priority=110' \
  --label 'traefik.http.services.jaeger.loadbalancer.server.port=16686' \
  --restart unless-stopped \
  jaegertracing/all-in-one:1.52

echo "✓ Jaeger restarted with QUERY_BASE_PATH=/admin/jaeger"
echo "Waiting for startup..."
sleep 5
docker logs tasktracker-jaeger --tail 20
