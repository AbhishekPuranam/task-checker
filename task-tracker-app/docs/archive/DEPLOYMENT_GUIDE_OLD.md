# Project Tracker - Production Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [DNS Subdomain Setup](#dns-subdomain-setup)
3. [Server Setup](#server-setup)
4. [Application Deployment](#application-deployment)
5. [Traefik + Let's Encrypt SSL Setup](#traefik--lets-encrypt-ssl-setup)
6. [Database Initialization](#database-initialization)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

**What You Need:**
- Server with Ubuntu 20.04+ (4 vCPUs, 8GB RAM, 100GB SSD)
- Root/sudo access
- Public IP address
- Domain: `sapcindia.com` (you'll create subdomain `projects.sapcindia.com`)

---

## DNS Subdomain Setup

### Step 1: Access Your DNS Management

Login to your domain registrar or hosting provider where you manage `sapcindia.com` DNS.

Your nameservers are: `wz1.cms502.com` and `wz2.cms502.com`

Look for:
- **DNS Management** or **Zone Editor**
- **Manage DNS** or **Advanced DNS**

### Step 2: Add A Record for Subdomain

Add this DNS record:

```
Type: A
Name: projects
Value: YOUR_SERVER_PUBLIC_IP
TTL: 3600 (or default)
```

**Example:**
```
Type: A
Host: projects
Points to: 203.0.113.45  (your new server's IP)
TTL: 1 Hour
```

### Step 3: Verify DNS Propagation

```bash
# Wait 5-10 minutes, then test
nslookup projects.sapcindia.com

# Should return your server's IP
# If not, wait longer (up to 48 hours max)
```

**Important:** Do NOT proceed with deployment until DNS is working!

---

## Server Setup

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
### Step 1: Connect and Update Server

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Update system
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw
```

### Step 2: Configure Firewall

```bash
sudo ufw enable
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (for Let's Encrypt validation)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw status
```

### Step 3: Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo systemctl start docker
sudo systemctl enable docker
docker --version
```

---

## Application Deployment

### Step 1: Clone Repository

```bash
sudo mkdir -p /opt/projecttracker
cd /opt/projecttracker
git clone https://github.com/AbhishekPuranam/task-checker.git
cd task-checker/task-tracker-app
```

### Step 2: Generate Secrets

```bash
# Generate and save these values
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # SESSION_SECRET
openssl rand -base64 16  # MONGODB_PASSWORD
```

### Step 3: Create Environment Files

Create `.env` file for backend:

```bash
cat > services/backend-api/.env << 'EOF'
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://admin:YOUR_MONGODB_PASSWORD@mongodb:27017/projecttracker?authSource=admin
REDIS_URL=redis://redis:6379
JWT_SECRET=YOUR_JWT_SECRET
SESSION_SECRET=YOUR_SESSION_SECRET
CLIENT_URL=https://projects.sapcindia.com
EOF
```

Create `.env.local` for admin client:

```bash
cat > clients/admin/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://projects.sapcindia.com/api
NODE_ENV=production
EOF
```

Create `.env.local` for engineer client:

```bash
cat > clients/engineer/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://projects.sapcindia.com/api
NODE_ENV=production
EOF
```

Create `.env` for auth service:

```bash
cat > services/auth-service/.env << 'EOF'
NODE_ENV=production
PORT=4000
JWT_SECRET=YOUR_JWT_SECRET
SESSION_SECRET=YOUR_SESSION_SECRET
MONGODB_URI=mongodb://admin:YOUR_MONGODB_PASSWORD@mongodb:27017/projecttracker?authSource=admin
EOF
```

**Replace placeholders:**
- `YOUR_MONGODB_PASSWORD` - MongoDB password you generated
- `YOUR_JWT_SECRET` - JWT secret you generated
- `YOUR_SESSION_SECRET` - Session secret you generated

### Step 4: Update CORS Settings

Edit `services/backend-api/server.js` (around line 77):

```javascript
app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    "https://projects.sapcindia.com",
    "http://projects.sapcindia.com",
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```

---

## Traefik + Let's Encrypt SSL Setup

This section shows how to configure Traefik to automatically get and renew FREE SSL certificates from Let's Encrypt.

### Step 1: Update Traefik Configuration

Edit `infrastructure/docker/traefik.yml`:

```bash
nano infrastructure/docker/traefik.yml
```

Replace with this production configuration:

```yaml
# Traefik Production Configuration with Let's Encrypt

api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  
  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@sapcindia.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: "tasktracker-network"

log:
  level: INFO

accessLog: {}
```

**What this does:**
- Automatically gets SSL certificate from Let's Encrypt
- Redirects all HTTP traffic to HTTPS
- Stores certificates in `/letsencrypt/acme.json`
- Auto-renews certificates before expiry (every 90 days)

### Step 2: Update Docker Compose

Edit `infrastructure/docker/docker-compose.yml` and add/update the Traefik service and labels:

```yaml
version: '3.8'

services:
  # MongoDB
  mongodb:
    image: mongo:7.0
    container_name: tasktracker-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: YOUR_MONGODB_PASSWORD
      MONGO_INITDB_DATABASE: projecttracker
    volumes:
      - mongodb_data:/data/db
      - ../../scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - tasktracker-network

  # Redis
  redis:
    image: redis:7-alpine
    container_name: tasktracker-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - tasktracker-network

  # Backend API
  tasktracker-app:
    build:
      context: ../../services/backend-api
      dockerfile: Dockerfile
      target: production
    container_name: tasktracker-app
    restart: unless-stopped
    env_file:
      - ../../services/backend-api/.env
    volumes:
      - ../../uploads:/app/uploads
      - ../../logs:/app/logs
    depends_on:
      - mongodb
      - redis
    networks:
      - tasktracker-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=5000"

  # Auth Service
  tasktracker-auth:
    build:
      context: ../../services/auth-service
      dockerfile: Dockerfile
    container_name: tasktracker-auth
    restart: unless-stopped
    env_file:
      - ../../services/auth-service/.env
    depends_on:
      - mongodb
    networks:
      - tasktracker-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.auth.rule=Path(`/`) || Path(`/login`)"
      - "traefik.http.routers.auth.entrypoints=websecure"
      - "traefik.http.routers.auth.tls.certresolver=letsencrypt"
      - "traefik.http.routers.auth.priority=100"
      - "traefik.http.services.auth.loadbalancer.server.port=4000"

  # Admin Client
  tasktracker-admin:
    build:
      context: ../../clients/admin
      dockerfile: Dockerfile
    container_name: tasktracker-admin
    restart: unless-stopped
    env_file:
      - ../../clients/admin/.env.local
    depends_on:
      - tasktracker-app
    networks:
      - tasktracker-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.admin.rule=PathPrefix(`/admin`)"
      - "traefik.http.routers.admin.entrypoints=websecure"
      - "traefik.http.routers.admin.tls.certresolver=letsencrypt"
      - "traefik.http.services.admin.loadbalancer.server.port=3000"

  # Engineer Client
  tasktracker-engineer:
    build:
      context: ../../clients/engineer
      dockerfile: Dockerfile
    container_name: tasktracker-engineer
    restart: unless-stopped
    env_file:
      - ../../clients/engineer/.env.local
    depends_on:
      - tasktracker-app
    networks:
      - tasktracker-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.engineer.rule=PathPrefix(`/engineer`)"
      - "traefik.http.routers.engineer.entrypoints=websecure"
      - "traefik.http.routers.engineer.tls.certresolver=letsencrypt"
      - "traefik.http.services.engineer.loadbalancer.server.port=3000"

  # Traefik Reverse Proxy
  traefik:
    image: traefik:v2.10
    container_name: tasktracker-traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/etc/traefik/traefik.yml:ro
      - traefik_letsencrypt:/letsencrypt
    networks:
      - tasktracker-network
    labels:
      - "traefik.enable=true"

volumes:
  mongodb_data:
  redis_data:
  traefik_letsencrypt:

networks:
  tasktracker-network:
    driver: bridge
```

**Key labels explained:**
- `traefik.enable=true` - Enable Traefik for this service
- `traefik.http.routers.*.rule` - URL routing rule
- `traefik.http.routers.*.entrypoints=websecure` - Use HTTPS (port 443)
- `traefik.http.routers.*.tls.certresolver=letsencrypt` - Use Let's Encrypt SSL

### Step 3: Verify DNS Before Starting

**CRITICAL:** DNS must be working before Traefik can get SSL certificate!

```bash
nslookup projects.sapcindia.com
# Should return your server's IP
```

If DNS is not working, **STOP** and wait for DNS propagation.

### Step 4: Start Services

```bash
cd infrastructure/docker

# Build and start all services
docker compose build
docker compose up -d

# Watch Traefik logs to see SSL certificate being obtained
docker compose logs -f traefik
```

You should see logs like:
```
level=info msg="Trying to challenge from https://acme-v02.api.letsencrypt.org/..."
level=info msg="Obtain certificate"
level=info msg="Obtained certificate"
```

This means Let's Encrypt successfully issued your SSL certificate!

### Step 5: Verify HTTPS Works

```bash
# Test HTTPS
curl -I https://projects.sapcindia.com

# Should return HTTP/2 200 or 302

# Test HTTP redirect
curl -I http://projects.sapcindia.com
# Should return HTTP/1.1 301 Moved Permanently
# Location: https://projects.sapcindia.com/
```

Open browser: `https://projects.sapcindia.com` - You should see a green padlock 🔒

### How SSL Auto-Renewal Works

- Let's Encrypt certificates expire in **90 days**
- Traefik automatically renews them **30 days before expiry**
- No manual intervention needed!
- Certificates stored in Docker volume `traefik_letsencrypt`

---

## Database Initialization

3. **Another service using port 80**
   ```bash
   # Check what's using port 80
   sudo netstat -tulpn | grep :80
   ```
   **Fix:** Stop conflicting service

4. **Email not configured**
   - Check `traefik.yml` has valid email in `acme.email`

5. **Rate limit reached**
   - Let's Encrypt has rate limits (5 certificates per week per domain)
   - Wait 7 days or use staging server for testing

### Issue 2: HTTP Not Redirecting to HTTPS

**Diagnosis:**
```bash
# Test HTTP redirect
curl -I http://tracker.sapc.in

# Should return:
# HTTP/1.1 301 Moved Permanently
# Location: https://tracker.sapc.in/
```

**Fix:** Ensure `traefik.yml` has redirect configuration:
```yaml
entryPoints:
  web:
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
```

### Issue 3: Certificate Shows as Untrusted

**Symptoms:** Browser shows "Not Secure" despite certificate being present

**Diagnosis:**
```bash
# Check certificate details
echo | openssl s_client -servername tracker.sapc.in -connect tracker.sapc.in:443 2>/dev/null | openssl x509 -noout -text | grep -A 2 "Issuer"

# Should show: Issuer: C = US, O = Let's Encrypt
```

**Possible Causes:**
1. Certificate is self-signed (not from Let's Encrypt)
2. Wrong domain in certificate
3. Certificate expired

**Fix:** Delete old certificates and restart:
```bash
docker compose down
docker volume rm tasktracker_traefik_letsencrypt
docker compose up -d
```

### Issue 4: Traefik Can't Access Docker Socket

**Symptoms:** Services not registered with Traefik

**Diagnosis:**
```bash
# Check Traefik can access Docker
docker compose logs traefik | grep -i "provider.docker"
```

**Fix:** Ensure docker.sock is mounted:
```yaml
traefik:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

### Issue 5: Services Not Getting HTTPS

**Symptoms:** Backend/Admin/Engineer not accessible via HTTPS

**Diagnosis:**
```bash
# Check service labels
docker inspect tasktracker-app | grep -i traefik

# Should show labels like:
# traefik.http.routers.backend.tls.certresolver=letsencrypt
```

**Fix:** Ensure each service has proper labels in docker-compose.yml:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.SERVICE.entrypoints=websecure"
  - "traefik.http.routers.SERVICE.tls.certresolver=letsencrypt"
```

---

## Testing SSL Certificate

### Check Certificate Details

```bash
# View certificate information
echo | openssl s_client -servername tracker.sapc.in -connect tracker.sapc.in:443 2>/dev/null | openssl x509 -noout -text

# Check expiry date
echo | openssl s_client -servername tracker.sapc.in -connect tracker.sapc.in:443 2>/dev/null | openssl x509 -noout -dates

# Test SSL grade (online tool)
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=tracker.sapc.in
```

### Verify HTTPS Configuration

```bash
# Test all endpoints
curl -I https://tracker.sapc.in/
curl -I https://tracker.sapc.in/api/health
curl -I https://tracker.sapc.in/admin
curl -I https://tracker.sapc.in/engineer

# All should return HTTP/2 200 (or appropriate status)
```

---

## Production SSL Checklist

After setting up SSL with Traefik, verify:

- [ ] DNS points to server IP: `nslookup tracker.sapc.in`
- [ ] Port 80 and 443 are open: `sudo ufw status`
- [ ] Traefik is running: `docker compose ps traefik`
- [ ] Certificate is obtained: `docker compose logs traefik | grep "Obtained certificate"`
- [ ] HTTPS works: Visit `https://tracker.sapc.in`
- [ ] Browser shows padlock (secure connection)
- [ ] HTTP redirects to HTTPS: `curl -I http://tracker.sapc.in`
- [ ] Certificate is valid: Check browser certificate details
- [ ] Certificate issuer is Let's Encrypt
- [ ] Certificate expires in ~90 days
- [ ] All services accessible via HTTPS
- [ ] No browser security warnings

---
# Generate self-signed certificate
sudo mkdir -p /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl

sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=IN/ST=State/L=City/O=Organization/CN=tracker.sapc.in"
```

---

### Option C: Using Self-Signed Certificate (Development/Testing Only)

⚠️ **Not recommended for production** - Browsers will show security warnings

```bash
# Generate self-signed certificate
sudo mkdir -p /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/ssl

sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=IN/ST=State/L=City/O=Organization/CN=tracker.sapc.in"

# Mount in docker-compose as shown in Option B
```

**Use this only for:**
- Local testing before DNS is configured
- Development environments
- Testing SSL configuration

---

## Domain & DNS Configuration

### SSL/HTTPS Summary & Quick Decision Guide

**Question: "I have SSL for sapc.in. Will tracker.sapc.in work with HTTPS?"**

**Answer:** NO, unless you have a wildcard certificate.

#### Decision Tree:

**Do you have a wildcard SSL certificate (`*.sapc.in`) for your main domain?**

→ **YES** - Great! You can reuse it for `tracker.sapc.in`
   - Copy the wildcard certificate files to your Project Tracker server
   - No need to obtain a new certificate
   - All subdomains are covered

→ **NO** - You need a new SSL certificate for `tracker.sapc.in`
   - **Best Option:** Let Traefik get Let's Encrypt certificate automatically ⭐
   - **Alternative:** Manually get Let's Encrypt certificate
   - **Quick Test:** Use self-signed certificate (not for production)

#### Recommended Approach for tracker.sapc.in:

1. **Traefik Automatic SSL (Recommended):**
   - Traefik handles everything automatically
   - Gets certificate from Let's Encrypt
   - Auto-renews before expiry
   - Zero manual intervention needed
   ✅ EASIEST - Follow "Option A" below

2. **Manual Let's Encrypt:**
   ```bash
   sudo certbot certonly --standalone -d tracker.sapc.in
   ```
   ✅ FREE, Simple, Covers tracker.sapc.in only

3. **Already have wildcard SSL:**
   - Just copy existing certificate files
   ✅ Already paid for, Instant setup

---

## Traefik with Let's Encrypt Setup (RECOMMENDED)

### Option A: Let Traefik Handle SSL Automatically ⭐

This is the **best and easiest approach** - Traefik will automatically:
- Get SSL certificate from Let's Encrypt
- Renew certificate before expiry
- Handle all HTTPS traffic
- Redirect HTTP to HTTPS

#### Step 1: Update Traefik Configuration

Edit the Traefik configuration file:

```bash
nano /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker/traefik.yml
```

Replace the entire content with this production-ready configuration:

```yaml
# Traefik Static Configuration for Production with Let's Encrypt

api:
  dashboard: true
  insecure: false  # Disable insecure dashboard in production

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  
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

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: "tasktracker-network"  # Use production network name

log:
  level: INFO

accessLog: {}
```

#### Step 2: Update Docker Compose for Production with Traefik

You need to add Traefik to your production docker-compose file:

```bash
nano /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker/docker-compose.yml
```

Add the Traefik service and update service labels:

```yaml
version: '3.8'

services:
  # MongoDB Database
  mongodb:
    image: mongo:7.0
    container_name: tasktracker-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: YOUR_MONGODB_PASSWORD
      MONGO_INITDB_DATABASE: projecttracker
    volumes:
      - mongodb_data:/data/db
      - ../../scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - tasktracker-network

  # Redis for session storage
  redis:
    image: redis:7-alpine
    container_name: tasktracker-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - tasktracker-network

  # Backend API
  tasktracker-app:
    build:
      context: ../../services/backend-api
      dockerfile: Dockerfile
      target: production
    container_name: tasktracker-app
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 5000
      MONGODB_URI: mongodb://admin:YOUR_MONGODB_PASSWORD@mongodb:27017/projecttracker?authSource=admin
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
      CLIENT_URL: https://tracker.sapc.in
    volumes:
      - ../../uploads:/app/uploads
      - ../../logs:/app/logs
    depends_on:
      - mongodb
      - redis
    networks:
      - tasktracker-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=5000"

  # Auth Service
  tasktracker-auth:
    build:
      context: ../../services/auth-service
      dockerfile: Dockerfile
    container_name: tasktracker-auth
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 4000
      JWT_SECRET: ${JWT_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
      MONGODB_URI: mongodb://admin:YOUR_MONGODB_PASSWORD@mongodb:27017/projecttracker?authSource=admin
    depends_on:
      - mongodb
    networks:
      - tasktracker-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.auth.rule=Path(`/`) || Path(`/login`)"
      - "traefik.http.routers.auth.entrypoints=websecure"
      - "traefik.http.routers.auth.tls.certresolver=letsencrypt"
      - "traefik.http.routers.auth.priority=100"
      - "traefik.http.services.auth.loadbalancer.server.port=4000"

  # Admin Client
  tasktracker-admin:
    build:
      context: ../../clients/admin
      dockerfile: Dockerfile
    container_name: tasktracker-admin
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://tracker.sapc.in/api
    depends_on:
      - tasktracker-app
    networks:
      - tasktracker-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.admin.rule=PathPrefix(`/admin`)"
      - "traefik.http.routers.admin.entrypoints=websecure"
      - "traefik.http.routers.admin.tls.certresolver=letsencrypt"
      - "traefik.http.services.admin.loadbalancer.server.port=3000"

  # Engineer Client
  tasktracker-engineer:
    build:
      context: ../../clients/engineer
      dockerfile: Dockerfile
    container_name: tasktracker-engineer
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: https://tracker.sapc.in/api
    depends_on:
      - tasktracker-app
    networks:
      - tasktracker-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.engineer.rule=PathPrefix(`/engineer`)"
      - "traefik.http.routers.engineer.entrypoints=websecure"
      - "traefik.http.routers.engineer.tls.certresolver=letsencrypt"
      - "traefik.http.services.engineer.loadbalancer.server.port=3000"

  # Traefik Reverse Proxy with Let's Encrypt
  traefik:
    image: traefik:v2.10
    container_name: tasktracker-traefik
    restart: unless-stopped
    ports:
      - "80:80"      # HTTP
      - "443:443"    # HTTPS
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/etc/traefik/traefik.yml:ro
      - traefik_letsencrypt:/letsencrypt  # Store Let's Encrypt certificates
    networks:
      - tasktracker-network
    labels:
      - "traefik.enable=true"

volumes:
  mongodb_data:
    driver: local
  redis_data:
    driver: local
  traefik_letsencrypt:
    driver: local

networks:
  tasktracker-network:
    driver: bridge
```

#### Step 3: Verify DNS is Configured

**IMPORTANT:** Before starting Traefik, ensure your DNS is set up:

```bash
# Check DNS resolution
nslookup tracker.sapc.in

# Should return your server's public IP
# If not, wait for DNS propagation or fix DNS settings
```

#### Step 4: Start Services with Traefik

```bash
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker

# Stop any existing services
docker compose down

# Start all services (Traefik will automatically get SSL certificate)
docker compose up -d

# Watch Traefik logs to see certificate request
docker compose logs -f traefik
```

You should see logs like:
```
time="..." level=info msg="Trying to challenge from https://acme-v02.api.letsencrypt.org/..."
time="..." level=info msg="The key type is empty. Use default key type 4096."
time="..." level=info msg="Obtain certificate"
time="..." level=info msg="Obtained certificate"
```

#### Step 5: Verify HTTPS is Working

```bash
# Test HTTPS
curl -I https://tracker.sapc.in

# Should return:
# HTTP/2 200
# ...

# Open browser
# Navigate to: https://tracker.sapc.in
# Check for green padlock icon (secure connection)
```

#### Step 6: Verify Auto-Renewal

Let's Encrypt certificates expire in 90 days. Traefik automatically renews them.

```bash
# Check certificate expiry date
echo | openssl s_client -servername tracker.sapc.in -connect tracker.sapc.in:443 2>/dev/null | openssl x509 -noout -dates

# Traefik will automatically renew 30 days before expiry
# No manual intervention needed!
```

---


### Create Initial Admin User

```bash
# Access MongoDB container
docker exec -it tasktracker-mongodb mongosh -u admin -p YOUR_MONGODB_PASSWORD --authenticationDatabase admin

# Switch to projecttracker database
use projecttracker

# Create admin user
db.users.insertOne({
  username: "admin",
  email: "admin@sapcindia.com",
  password: "$2a$10$rH8JhQKNsLJHxJ2RzqLX4.xY7vJ3YzJHYvJ3YzJHYvJ3YzJHYvJ3Y",  // Password: admin123
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date()
})

# Exit MongoDB
exit
```

**Default Admin Login:**
- Username: `admin`
- Password: `admin123`
- **⚠️ CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!**

---

## Post-Deployment Verification

### 1. Check All Services Running

```bash
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker
docker compose ps
```

All containers should show "Up" status.

### 2. Test HTTPS

```bash
# Visit your site
curl -I https://projects.sapcindia.com

# Check SSL certificate
echo | openssl s_client -servername projects.sapcindia.com -connect projects.sapcindia.com:443 2>/dev/null | openssl x509 -noout -dates
```

### 3. Login to Application

Open browser: `https://projects.sapcindia.com`

Login with:
- Username: `admin`
- Password: `admin123`

**Verify:**
- [ ] Login successful
- [ ] Dashboard loads
- [ ] Can create project
- [ ] File uploads work

---

## Troubleshooting

### DNS Not Working

```bash
# Check DNS
nslookup projects.sapcindia.com

# Should return your server IP
# If not, wait for DNS propagation (up to 48 hours)
```

### SSL Certificate Not Generated

```bash
# Check Traefik logs
docker compose logs traefik | grep -i acme
docker compose logs traefik | grep -i certificate

# Common issues:
# 1. DNS not pointing to server
# 2. Port 80 blocked by firewall
# 3. Another service using port 80
```

**Fixes:**
```bash
# Check firewall
sudo ufw status

# Ensure ports are open
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check if port 80 is free
sudo netstat -tulpn | grep :80
```

### Container Won't Start

```bash
# View logs
docker compose logs SERVICE_NAME

# Restart specific service
docker compose restart SERVICE_NAME

# Rebuild and restart all
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database Connection Failed

```bash
# Check MongoDB is running
docker compose ps mongodb

# Check MongoDB logs
docker compose logs mongodb

# Test connection
docker exec -it tasktracker-mongodb mongosh -u admin -p YOUR_PASSWORD --authenticationDatabase admin
```

### File Upload Not Working

```bash
# Create upload directories
mkdir -p uploads/excel uploads/structural logs

# Fix permissions
sudo chown -R 1000:1000 uploads logs
sudo chmod -R 755 uploads logs
```

---

## Maintenance

### View Logs

```bash
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker

# All logs
docker compose logs -f

# Specific service
docker compose logs -f tasktracker-app
```

### Update Application

```bash
cd /opt/projecttracker/task-checker/task-tracker-app

# Pull latest code
git pull origin main

# Rebuild and restart
cd infrastructure/docker
docker compose down
docker compose build
docker compose up -d
```

### Backup Database

```bash
# Manual backup
docker exec tasktracker-mongodb mongodump --username admin --password YOUR_PASSWORD --authenticationDatabase admin --out /backup

# Copy backup from container
docker cp tasktracker-mongodb:/backup ./mongodb-backup-$(date +%Y-%m-%d)
```

### Restart Services

```bash
cd /opt/projecttracker/task-checker/task-tracker-app/infrastructure/docker

# Restart all
docker compose restart

# Restart specific service
docker compose restart tasktracker-app
```

---

## Quick Reference

### Important URLs
- Application: `https://projects.sapcindia.com`
- Admin Panel: `https://projects.sapcindia.com/admin`
- Engineer Panel: `https://projects.sapcindia.com/engineer`

### Default Credentials
- Username: `admin`
- Password: `admin123` (CHANGE THIS!)

### Common Commands
```bash
# Start
docker compose up -d

# Stop
docker compose down

# Logs
docker compose logs -f

# Restart
docker compose restart

# Status
docker compose ps
```

### Important Files
- Backend env: `services/backend-api/.env`
- Admin env: `clients/admin/.env.local`
- Engineer env: `clients/engineer/.env.local`
- Auth env: `services/auth-service/.env`
- Traefik config: `infrastructure/docker/traefik.yml`
- Docker compose: `infrastructure/docker/docker-compose.yml`

---

## Success Checklist

After deployment, verify:

- [ ] DNS `projects.sapcindia.com` resolves to your server IP
- [ ] HTTPS works (green padlock in browser)
- [ ] HTTP redirects to HTTPS
- [ ] Can login with admin/admin123
- [ ] Dashboard loads without errors
- [ ] Can create a project
- [ ] File uploads work
- [ ] All Docker containers running
- [ ] Changed default admin password

---

## Support

For issues or questions:
- Check troubleshooting section above
- Review Docker logs: `docker compose logs`
- Verify environment files have correct values
- Ensure DNS is properly configured
- Confirm firewall allows ports 80 and 443

**Deployment Complete!** 🎉

Your Project Tracker is now live at: `https://projects.sapcindia.com`
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
