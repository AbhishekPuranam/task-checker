# Project Tracker - Production Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Environment Configuration](#environment-configuration)
6. [SSL/HTTPS Setup](#ssl-https-setup)
7. [Domain & DNS Configuration](#domain--dns-configuration)
8. [Database Initialization](#database-initialization)
9. [First-Time Setup](#first-time-setup)
10. [Post-Deployment Verification](#post-deployment-verification)
11. [Backup & Recovery](#backup--recovery)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying to your private web server, ensure you have:

- ✅ A server with Ubuntu 20.04/22.04 or CentOS 7/8 (recommended)
- ✅ Root or sudo access to the server
- ✅ Public IP address assigned to your server
- ✅ Domain name (optional but recommended)
- ✅ SSH access configured
- ✅ Basic Linux command line knowledge

**Minimum Server Specifications:**
- CPU: 4 vCPUs
- RAM: 8 GB
- Storage: 100 GB SSD
- Network: Public IP with ports 80, 443, 22 open

---

## Server Requirements

### Required Software
The following will be installed during deployment:

1. **Docker Engine** (20.10+)
2. **Docker Compose** (2.x)
3. **Git**
4. **Nginx** (for reverse proxy - optional if using Traefik)
5. **Certbot** (for SSL certificates)

### Firewall Configuration
Open the following ports:

```bash
# SSH
Port 22 (TCP)

# HTTP
Port 80 (TCP)

# HTTPS
Port 443 (TCP)

# MongoDB (only if accessing externally - not recommended)
Port 27017 (TCP) - Block this in production
```

---

## Pre-Deployment Checklist

### 1. DNS Configuration (if using domain)
- [ ] A Record pointing to your server's public IP
- [ ] Wait for DNS propagation (may take up to 48 hours)
- [ ] Verify DNS resolution: `nslookup yourdomain.com`

### 2. Generate Secure Secrets
Generate strong random secrets for production:

```bash
# Generate JWT Secret (32+ characters)
openssl rand -base64 32

# Generate Session Secret (32+ characters)
openssl rand -base64 32

# Generate MongoDB password (16+ characters)
openssl rand -base64 16
```

**Save these securely** - you'll need them for environment configuration.

### 3. Domain Information
Prepare the following:
- Production domain (e.g., `tracker.sapc.in` - subdomain recommended)
- Admin email for SSL certificate notifications (e.g., `admin@sapc.in`)
- Company/organization name

---

## Step-by-Step Deployment

### Step 1: Connect to Your Server

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Or if using a non-root user
ssh your_username@YOUR_SERVER_IP
```

### Step 2: System Update

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required utilities
sudo apt install -y git curl wget vim net-tools ufw
```

### Step 3: Configure Firewall

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (IMPORTANT - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### Step 4: Install Docker

```bash
# Remove old Docker versions (if any)
sudo apt remove docker docker-engine docker.io containerd runc

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional)
sudo usermod -aG docker $USER

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version
docker compose version
```

### Step 5: Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/projecttracker
cd /opt/projecttracker

# Clone your repository
git clone https://github.com/AbhishekPuranam/task-checker.git
cd task-checker/task-tracker-app

# Checkout main branch
git checkout main
```

### Step 6: Create Production Environment Files

#### Backend API Environment

```bash
# Create backend environment file
cat > /opt/projecttracker/task-checker/task-tracker-app/services/backend-api/.env << 'EOF'
NODE_ENV=production
PORT=5000

# Database Configuration
MONGODB_URI=mongodb://admin:YOUR_MONGODB_PASSWORD@mongodb:27017/projecttracker?authSource=admin

# Redis Configuration
REDIS_URL=redis://redis:6379

# Security - CHANGE THESE!
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_HERE
SESSION_SECRET=YOUR_GENERATED_SESSION_SECRET_HERE

# CORS - Your domain (use subdomain)
CLIENT_URL=https://tracker.sapc.in

# Optional: Email configuration (for notifications)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
EOF
```

#### Admin Client Environment

```bash
# Create admin client environment file
cat > /opt/projecttracker/task-checker/task-tracker-app/clients/admin/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://tracker.sapc.in/api
NODE_ENV=production
EOF
```

#### Engineer Client Environment

```bash
# Create engineer client environment file
cat > /opt/projecttracker/task-checker/task-tracker-app/clients/engineer/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://tracker.sapc.in/api
NODE_ENV=production
EOF
```

#### Auth Service Environment

```bash
# Create auth service environment file
cat > /opt/projecttracker/task-checker/task-tracker-app/services/auth-service/.env << 'EOF'
NODE_ENV=production
PORT=4000
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_HERE
SESSION_SECRET=YOUR_GENERATED_SESSION_SECRET_HERE
MONGODB_URI=mongodb://admin:YOUR_MONGODB_PASSWORD@mongodb:27017/projecttracker?authSource=admin
EOF
```

### Step 7: Update Docker Compose Configuration

Edit the production docker-compose file:

```bash
nano /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker/docker-compose.yml
```

Update the following:

```yaml
# Update MongoDB password
mongodb:
  environment:
    MONGO_INITDB_ROOT_PASSWORD: YOUR_MONGODB_PASSWORD

# Update backend API environment
tasktracker-app:
  environment:
    CLIENT_URL: https://tracker.sapc.in
    JWT_SECRET: YOUR_JWT_SECRET
    SESSION_SECRET: YOUR_SESSION_SECRET
```

### Step 8: Update CORS Configuration

Edit the backend server file:

```bash
nano /opt/projecttracker/task-checker/task-tracker-app/services/backend-api/server.js
```

Update the CORS origins (around line 77):

```javascript
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.CLIENT_URL,
    "https://tracker.sapc.in",      // Your subdomain
    "http://tracker.sapc.in",       // HTTP variant (will redirect to HTTPS)
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```
```

---

## Environment Configuration

### Replace Placeholders

**Important:** Replace these placeholders in ALL environment files created above:

| Placeholder | Replace With | Example |
|------------|--------------|---------|
| `YOUR_MONGODB_PASSWORD` | MongoDB root password | `MyS3cur3Mong0P@ss` |
| `YOUR_JWT_SECRET` | Generated JWT secret | `vK8x2mP9qW...` |
| `YOUR_SESSION_SECRET` | Generated session secret | `nR5yT3hL8x...` |
| `yourdomain.com` | Your actual domain/subdomain | `tracker.sapc.in` |

### Verify Environment Files

```bash
# Check all .env files are created
ls -la /opt/projecttracker/task-checker/task-tracker-app/services/backend-api/.env
ls -la /opt/projecttracker/task-checker/task-tracker-app/services/auth-service/.env
ls -la /opt/projecttracker/task-checker/task-tracker-app/clients/admin/.env.local
ls -la /opt/projecttracker/task-checker/task-tracker-app/clients/engineer/.env.local
```

---

## SSL/HTTPS Setup

### Option 1: Using Let's Encrypt (Recommended for Production)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Stop any services on port 80
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker
docker compose down

# Obtain SSL certificate
sudo certbot certonly --standalone \
  -d tracker.sapc.in \
  --email admin@sapc.in \
  --agree-tos \
  --non-interactive

# Certificates will be saved to:
# /etc/letsencrypt/live/tracker.sapc.in/fullchain.pem
# /etc/letsencrypt/live/tracker.sapc.in/privkey.pem

# Copy certificates to project directory
sudo mkdir -p /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl
sudo cp /etc/letsencrypt/live/tracker.sapc.in/fullchain.pem \
  /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl/
sudo cp /etc/letsencrypt/live/tracker.sapc.in/privkey.pem \
  /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl/

# Set proper permissions
sudo chmod 644 /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl/*

# Setup auto-renewal
sudo certbot renew --dry-run
```

### Option 2: Using Self-Signed Certificate (Development/Testing Only)

```bash
# Generate self-signed certificate
sudo mkdir -p /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl

sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=IN/ST=State/L=City/O=Organization/CN=tracker.sapc.in"
```

### Update Traefik Configuration for HTTPS

Edit the Traefik configuration:

```bash
nano /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker/traefik.yml
```

Uncomment and configure HTTPS:

```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  
  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@sapc.in
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

---

## Domain & DNS Configuration

### Option 1: Using Main Domain (e.g., sapc.in)

In your domain registrar's DNS settings, add:

```
Type    Name    Value               TTL
A       @       YOUR_SERVER_IP      3600
A       www     YOUR_SERVER_IP      3600
```

### Option 2: Using Subdomain (e.g., tracker.sapc.in) - RECOMMENDED

For setting up a subdomain like `tracker.sapc.in`:

#### Step 1: Access Your Domain DNS Management

1. Login to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
2. Navigate to DNS Management / DNS Settings for `sapc.in`
3. Look for "Add Record" or "Manage DNS Records"

#### Step 2: Add A Record for Subdomain

Add the following DNS record:

```
Type    Name        Value               TTL
A       tracker     YOUR_SERVER_IP      3600
```

**Example Configuration:**
```
Type: A
Host/Name: tracker
Points to/Value: 203.0.113.45  (your server's public IP)
TTL: 3600 (or 1 Hour)
```

#### Step 3: Subdomain Configuration Examples by Provider

**GoDaddy:**
1. Go to "My Products" → Domain → "DNS"
2. Click "Add" under Records
3. Select Type: "A"
4. Name: `tracker`
5. Value: Your server IP
6. TTL: 1 Hour
7. Click "Save"

**Namecheap:**
1. Domain List → Manage → Advanced DNS
2. Click "Add New Record"
3. Type: "A Record"
4. Host: `tracker`
5. Value: Your server IP
6. TTL: Automatic
7. Click "Save All Changes"

**Cloudflare:**
1. Select your domain → DNS → Records
2. Click "Add record"
3. Type: "A"
4. Name: `tracker`
5. IPv4 address: Your server IP
6. Proxy status: DNS only (or Proxied for additional security)
7. TTL: Auto
8. Click "Save"

**Google Domains:**
1. Go to "DNS" section
2. Scroll to "Custom resource records"
3. Name: `tracker`
4. Type: "A"
5. TTL: 1H
6. Data: Your server IP
7. Click "Add"

**HostGator / Bluehost:**
1. cPanel → Zone Editor
2. Select domain `sapc.in`
3. Click "Add Record"
4. Type: "A"
5. Name: `tracker.sapc.in`
6. Address: Your server IP
7. Click "Add Record"

#### Step 4: Optional - Add CNAME for www.tracker.sapc.in

If you want `www.tracker.sapc.in` to also work:

```
Type    Name            Value               TTL
CNAME   www.tracker     tracker.sapc.in     3600
```

### Verify DNS Propagation

```bash
# Check subdomain DNS resolution
nslookup tracker.sapc.in

# Expected output:
# Server:  8.8.8.8
# Address: 8.8.8.8#53
# 
# Non-authoritative answer:
# Name:    tracker.sapc.in
# Address: YOUR_SERVER_IP

# Check from external tool
# Visit: https://www.whatsmydns.net/#A/tracker.sapc.in

# Test DNS from command line
dig tracker.sapc.in +short

# Should return your server IP
```

### DNS Propagation Time

- **Typical time:** 5-30 minutes
- **Maximum time:** Up to 48 hours
- **Tips:** 
  - Use low TTL (300-600 seconds) before making changes
  - Clear your local DNS cache: `sudo dnsflush` (macOS) or `ipconfig /flushdns` (Windows)
  - Use incognito/private browser window to avoid caching

---

## Database Initialization

### Step 1: Start Database Services

```bash
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker

# Start only MongoDB and Redis first
docker compose up -d mongodb redis

# Wait for MongoDB to initialize (30 seconds)
sleep 30

# Check MongoDB is running
docker compose logs mongodb
```

### Step 2: Create Initial Admin User

```bash
# Access MongoDB container
docker exec -it tasktracker-mongodb mongosh -u admin -p YOUR_MONGODB_PASSWORD --authenticationDatabase admin

# Switch to projecttracker database
use projecttracker

# Create admin user
db.users.insertOne({
  username: "admin",
  email: "admin@sapc.in",
  password: "$2a$10$rH8JhQKNsLJHxJ2RzqLX4.xY7vJ3YzJHYvJ3YzJHYvJ3YzJHYvJ3Y",  // Password: admin123
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date()
})

# Exit MongoDB
exit
```

**Important:** Change the admin password immediately after first login!

---

## First-Time Setup

### Step 1: Build and Start All Services

```bash
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker

# Build images (first time only)
docker compose build

# Start all services
docker compose up -d

# Check all containers are running
docker compose ps
```

Expected output:
```
NAME                     STATUS          PORTS
tasktracker-mongodb      Up 2 minutes    0.0.0.0:27017->27017/tcp
tasktracker-redis        Up 2 minutes    0.0.0.0:6379->6379/tcp
tasktracker-app          Up 2 minutes    0.0.0.0:5000->5000/tcp
tasktracker-auth         Up 2 minutes    0.0.0.0:4000->4000/tcp
tasktracker-admin        Up 2 minutes    0.0.0.0:3000->3000/tcp
tasktracker-engineer     Up 2 minutes    0.0.0.0:3001->3001/tcp
traefik                  Up 2 minutes    0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### Step 2: View Logs

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f tasktracker-app
docker compose logs -f tasktracker-admin
docker compose logs -f mongodb

# Exit logs: Ctrl+C
```

### Step 3: Create Data Directories with Proper Permissions

```bash
# Create upload directories
sudo mkdir -p /opt/projecttracker/task-checker/task-tracker-app/uploads/excel
sudo mkdir -p /opt/projecttracker/task-checker/task-tracker-app/uploads/structural

# Create logs directory
sudo mkdir -p /opt/projecttracker/task-checker/task-tracker-app/logs

# Set proper ownership (Docker containers run as user 1000:1000)
sudo chown -R 1000:1000 /opt/projecttracker/task-checker/task-tracker-app/uploads
sudo chown -R 1000:1000 /opt/projecttracker/task-checker/task-tracker-app/logs

# Set proper permissions
sudo chmod -R 755 /opt/projecttracker/task-checker/task-tracker-app/uploads
sudo chmod -R 755 /opt/projecttracker/task-checker/task-tracker-app/logs
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check backend API health
curl http://localhost:5000/health

# Expected response:
# {"status":"ok","timestamp":"2025-10-31T..."}

# Check auth service health
curl http://localhost:4000/health
```

### 2. Access Application

Open your browser and navigate to:

```
https://tracker.sapc.in
```

You should see the login page with "🏗️ Project Tracker"

### 3. Test Login

**Admin Credentials:**
- Username: `admin`
- Password: `admin123` (or the password you set)

**After successful login:**
- [ ] Verify admin dashboard loads
- [ ] Check navigation menu works
- [ ] Test creating a project
- [ ] Verify file uploads work

### 4. Monitor Resource Usage

```bash
# Check container resource usage
docker stats

# Check disk usage
df -h

# Check memory usage
free -h

# Check Docker disk usage
docker system df
```

### 5. Test Engineer Access

Create a test engineer user:

1. Login as admin
2. Navigate to Users page
3. Create new user:
   - Username: `engineer1`
   - Role: Site Engineer
   - Email: `engineer1@yourdomain.com`
   - Password: `engineer123`

Test engineer login at: `https://tracker.sapc.in`

---

## Backup & Recovery

### Automated Backup Setup

```bash
# Create backup directory
sudo mkdir -p /opt/backups/projecttracker

# Setup automated backups
sudo crontab -e

# Add the following line for daily backups at 2 AM
0 2 * * * /opt/projecttracker/task-checker/task-tracker-app/scripts/backup/backup-all.sh
```

### Manual Backup

```bash
# Navigate to backup scripts
cd /opt/projecttracker/task-checker/task-tracker-app/scripts/backup

# Run full backup
sudo ./backup-all.sh

# Backup files will be saved to /opt/backups/projecttracker/
```

### Restore from Backup

```bash
# Stop services
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker
docker compose down

# Restore MongoDB
cd /opt/projecttracker/task-checker/task-tracker-app/scripts/backup
sudo ./restore-mongodb.sh /opt/backups/projecttracker/mongodb-backup-YYYY-MM-DD.tar.gz

# Restore file uploads
sudo ./restore-files.sh /opt/backups/projecttracker/files-backup-YYYY-MM-DD.tar.gz

# Start services
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker
docker compose up -d
```

---

## Troubleshooting

### Issue 1: Containers Not Starting

```bash
# Check Docker service
sudo systemctl status docker

# Restart Docker service
sudo systemctl restart docker

# Check container logs
docker compose logs

# Remove and recreate containers
docker compose down
docker compose up -d --force-recreate
```

### Issue 2: Database Connection Failed

```bash
# Check MongoDB is running
docker compose ps mongodb

# Check MongoDB logs
docker compose logs mongodb

# Test MongoDB connection
docker exec -it tasktracker-mongodb mongosh -u admin -p YOUR_PASSWORD --authenticationDatabase admin

# Verify connection string in .env file
cat /opt/projecttracker/task-checker/task-tracker-app/services/backend-api/.env | grep MONGODB_URI
```

### Issue 3: CORS Errors

**Symptoms:** Browser console shows CORS policy errors

**Solution:**
1. Check `CLIENT_URL` in backend .env file matches your domain
2. Verify CORS origins in `services/backend-api/server.js`
3. Restart backend service: `docker compose restart tasktracker-app`

### Issue 4: SSL Certificate Errors

```bash
# Verify certificate files exist
ls -la /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl/

# Check certificate expiry
sudo openssl x509 -in /etc/letsencrypt/live/tracker.sapc.in/fullchain.pem -noout -dates

# Renew certificate
sudo certbot renew --force-renewal

# Restart services
docker compose restart
```

### Issue 5: Application Shows 502 Bad Gateway

**Possible causes:**
1. Backend service not running
2. Traefik misconfigured
3. Port conflicts

**Diagnosis:**
```bash
# Check all services are up
docker compose ps

# Check backend health
curl http://localhost:5000/health

# Check Traefik logs
docker compose logs traefik

# Restart all services
docker compose restart
```

### Issue 6: File Upload Not Working

```bash
# Check upload directory permissions
ls -la /opt/projecttracker/task-checker/task-tracker-app/uploads/

# Fix permissions
sudo chown -R 1000:1000 /opt/projecttracker/task-checker/task-tracker-app/uploads
sudo chmod -R 755 /opt/projecttracker/task-checker/task-tracker-app/uploads

# Check backend logs for errors
docker compose logs tasktracker-app | grep -i upload
```

### Issue 7: High Memory Usage

```bash
# Check resource usage
docker stats

# Restart containers to free memory
docker compose restart

# Clear Docker cache
docker system prune -a --volumes
```

---

## Maintenance Commands

### Update Application

```bash
# Navigate to application directory
cd /opt/projecttracker/task-checker/task-tracker-app

# Pull latest changes
git pull origin main

# Rebuild and restart services
cd infrastructure/docker
docker compose down
docker compose build --no-cache
docker compose up -d

# Check logs for errors
docker compose logs -f
```

### View Application Logs

```bash
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker

# Real-time logs
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100

# Specific service
docker compose logs -f tasktracker-app

# Save logs to file
docker compose logs > /tmp/app-logs.txt
```

### Clean Up Docker Resources

```bash
# Remove unused images, containers, volumes
docker system prune -a --volumes

# Warning: This will delete all stopped containers and unused images!
```

### Restart Specific Service

```bash
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker

# Restart backend API
docker compose restart tasktracker-app

# Restart admin client
docker compose restart tasktracker-admin

# Restart all services
docker compose restart
```

---

## Security Checklist

After deployment, ensure:

- [ ] Changed default admin password
- [ ] Updated all JWT_SECRET and SESSION_SECRET values
- [ ] MongoDB is not accessible from external network (port 27017 blocked)
- [ ] Redis is not accessible from external network (port 6379 blocked)
- [ ] SSL/HTTPS is enabled and working
- [ ] Firewall (UFW) is enabled with only necessary ports open
- [ ] Regular backups are scheduled
- [ ] Docker containers are running as non-root user
- [ ] Environment files (.env) have restricted permissions (600)
- [ ] Application is behind Traefik reverse proxy
- [ ] CORS is configured with specific domains (not wildcard *)

---

## Production Recommendations

### 1. Enable Monitoring

Consider setting up:
- **Prometheus + Grafana** for metrics
- **ELK Stack** for log aggregation
- **Uptime monitoring** (UptimeRobot, Pingdom)

### 2. Configure Email Notifications

Update backend .env with SMTP settings for email alerts:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 3. Setup Automated Backups

Ensure daily backups are running:
```bash
# Verify cron job
sudo crontab -l

# Test backup manually
cd /opt/projecttracker/task-checker/task-tracker-app/scripts/backup
sudo ./backup-all.sh
```

### 4. Performance Tuning

For high-traffic deployments:
- Increase MongoDB connection pool size
- Configure Redis caching
- Enable gzip compression in Nginx/Traefik
- Setup CDN for static assets

---

## Support & Additional Resources

- **Architecture Documentation:** `docs/ARCHITECTURE.md`
- **Backup & Recovery:** `docs/BACKUP_RECOVERY.md`
- **Security Guidelines:** `docs/SECURITY.md`
- **DevOps Guide:** `docs/DEVOPS_DEPLOYMENT.md`
- **Server Requirements:** `docs/SERVER_REQUIREMENTS.md`

---

## Quick Reference Commands

```bash
# Start application
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker
docker compose up -d

# Stop application
docker compose down

# View logs
docker compose logs -f

# Restart application
docker compose restart

# Update application
cd /opt/projecttracker/task-checker/task-tracker-app
git pull && cd infrastructure/docker && docker compose down && docker compose build && docker compose up -d

# Backup database
cd /opt/projecttracker/task-checker/task-tracker-app/scripts/backup
sudo ./backup-mongodb.sh

# Check health
curl http://localhost:5000/health
```

---

## Deployment Complete! 🎉

Your Project Tracker application is now deployed and running on your private web server.

**Access your application at:** `https://tracker.sapc.in`

**Default Admin Login:**
- Username: `admin`
- Password: `admin123` (change immediately!)

For any issues or questions, refer to the troubleshooting section or contact your system administrator.
