# 🐳 Docker Deployment Guide

This guide explains how to run the Task Tracker application using Docker containers.

## Prerequisites

- Docker Engine (v20.0 or higher)
- Docker Compose (v2.0 or higher)
- 4GB RAM minimum
- 10GB disk space

## Quick Start

### 1. Development Environment (Recommended for testing)

```bash
# Start development environment with hot-reload
./docker-run.sh dev

# Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
# MongoDB: localhost:27017
```

### 2. Production Environment

```bash
# Start production environment
./docker-run.sh prod

# Access the application
# Application: http://localhost
# API: http://localhost:5000
# MongoDB: localhost:27017
```

## Available Commands

```bash
# Start development environment
./docker-run.sh dev

# Start production environment
./docker-run.sh prod

# Build Docker images
./docker-run.sh build

# Stop all containers
./docker-run.sh stop

# Clean up containers and volumes
./docker-run.sh clean

# View application logs
./docker-run.sh logs

# Access application shell
./docker-run.sh shell

# Access MongoDB shell
./docker-run.sh db
```

## Container Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │    │  Task Tracker    │    │    MongoDB      │
│   Port: 80/443  │────│    Port: 5000    │────│   Port: 27017   │
│                 │    │                  │    │                 │
│ • Load Balance  │    │ • Node.js API    │    │ • Primary DB    │
│ • SSL Term      │    │ • React Client   │    │ • Persistent    │
│ • Rate Limit    │    │ • Socket.IO      │    │   Storage       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                       ┌──────────────────┐
                       │      Redis       │
                       │   Port: 6379     │
                       │                  │
                       │ • Session Store  │
                       │ • Cache Layer    │
                       └──────────────────┘
```

## Configuration

### Environment Variables

The application uses environment variables for configuration. Create a `.env` file or set these in your docker-compose.yml:

```env
# Application
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb://admin:password123@mongodb:27017/tasktracker?authSource=admin
MONGODB_ROOT_PASSWORD=password123

# Security
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-session-secret

# Client
CLIENT_URL=http://localhost:3000
```

### Volume Mounts

The application uses several volumes for persistent data:

```yaml
volumes:
  # Database persistence
  - mongodb_data:/data/db
  
  # Application uploads
  - ./uploads:/app/uploads
  
  # Application logs
  - ./logs:/app/logs
  
  # Redis data
  - redis_data:/data
```

## Production Deployment

### 1. AWS EC2 Deployment

```bash
# Launch EC2 instance (t3.medium or larger)
# Install Docker and Docker Compose

# Clone repository
git clone https://github.com/YourUsername/task-checker.git
cd task-checker/task-tracker-app

# Configure environment
cp .env.example .env
nano .env

# Start production environment
./docker-run.sh prod

# Configure security group to allow:
# - Port 80 (HTTP)
# - Port 443 (HTTPS)
# - Port 22 (SSH)
```

### 2. Digital Ocean Deployment

```bash
# Create Droplet (4GB RAM minimum)
# Install Docker

# Deploy application
git clone <repository>
cd task-tracker-app
./docker-run.sh prod
```

### 3. Google Cloud Run

```bash
# Build and push to Container Registry
docker build -t gcr.io/PROJECT-ID/task-tracker .
docker push gcr.io/PROJECT-ID/task-tracker

# Deploy to Cloud Run
gcloud run deploy task-tracker \
  --image gcr.io/PROJECT-ID/task-tracker \
  --platform managed \
  --region us-central1
```

## SSL Configuration

### Using Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com

# Update nginx.conf to enable HTTPS server block
# Restart nginx container
docker-compose restart nginx
```

### Using Custom SSL Certificates

```bash
# Place certificates in ssl directory
mkdir ssl
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem

# Update nginx.conf and restart
docker-compose restart nginx
```

## Monitoring and Logging

### Container Health Checks

All containers include health checks:

```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# View health check logs
docker inspect tasktracker-app | grep -A5 Health
```

### Application Logs

```bash
# View real-time logs
./docker-run.sh logs

# View specific service logs
docker-compose logs mongodb
docker-compose logs nginx
docker-compose logs redis
```

### Log Rotation

Configure log rotation to prevent disk space issues:

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/docker-tasktracker

/var/lib/docker/containers/*/*.log {
  daily
  missingok
  rotate 52
  compress
  notifempty
  create 644 root root
}
```

## Backup and Restore

### Database Backup

```bash
# Backup MongoDB data
docker exec tasktracker-mongodb mongodump --out /tmp/backup
docker cp tasktracker-mongodb:/tmp/backup ./backup

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec tasktracker-mongodb mongodump --out /tmp/backup_$DATE
docker cp tasktracker-mongodb:/tmp/backup_$DATE ./backups/
```

### Data Restore

```bash
# Restore from backup
docker cp ./backup tasktracker-mongodb:/tmp/restore
docker exec tasktracker-mongodb mongorestore /tmp/restore
```

## Scaling and Performance

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  tasktracker-app:
    deploy:
      replicas: 3
    # ... other configuration
  
  nginx:
    # Configure load balancing
    # Update nginx.conf with multiple upstream servers
```

### Performance Optimization

```bash
# Optimize MongoDB
docker exec tasktracker-mongodb mongo --eval "
  db.users.createIndex({email: 1});
  db.tasks.createIndex({status: 1, createdAt: -1});
  db.structuralelements.createIndex({serialNo: 1});
"

# Monitor resource usage
docker stats

# Set resource limits in docker-compose.yml
services:
  tasktracker-app:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
```

## Security Best Practices

### Container Security

```bash
# Run containers as non-root user
USER nodejs:nodejs

# Use security options
security_opt:
  - no-new-privileges:true

# Limit capabilities
cap_drop:
  - ALL
cap_add:
  - CHOWN
  - DAC_OVERRIDE
```

### Network Security

```bash
# Use custom networks
networks:
  tasktracker-network:
    driver: bridge
    internal: true

# Configure firewall
sudo ufw allow 80
sudo ufw allow 443
sudo ufw deny 5000  # Don't expose backend directly
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs for errors
./docker-run.sh logs

# Check container status
docker ps -a

# Rebuild images
./docker-run.sh build
```

#### 2. Database Connection Issues

```bash
# Check MongoDB container
docker logs tasktracker-mongodb

# Verify network connectivity
docker exec tasktracker-app ping mongodb

# Check environment variables
docker exec tasktracker-app env | grep MONGODB
```

#### 3. Permission Issues

```bash
# Fix upload directory permissions
sudo chown -R 1001:1001 uploads/

# Check container user
docker exec tasktracker-app id
```

#### 4. Memory Issues

```bash
# Check memory usage
docker stats

# Increase memory limits
# Edit docker-compose.yml memory settings

# Clean up unused resources
docker system prune -a
```

### Debug Mode

```bash
# Run in debug mode
docker-compose -f docker-compose.dev.yml up

# Access container shell
docker exec -it tasktracker-app-dev sh

# Check logs in detail
docker logs --details tasktracker-app-dev
```

## Maintenance

### Regular Updates

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
./docker-run.sh stop
./docker-run.sh build
./docker-run.sh prod
```

### Cleanup

```bash
# Remove old images
docker image prune -a

# Remove unused volumes
docker volume prune

# Complete cleanup
./docker-run.sh clean
```

## Support

For Docker-related issues:

1. Check logs: `./docker-run.sh logs`
2. Verify configuration: Review docker-compose.yml
3. Check resources: `docker stats`
4. Contact support with container logs

---

**Happy Dockerizing! 🐳**