# 🚀 Project Tracker - Secure One-Command Deployment

Deploy your Project Tracker application with **enterprise-grade HashiCorp Vault security** in one command!

## Quick Deployment

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Download and run deployment script
curl -o deploy.sh https://raw.githubusercontent.com/AbhishekPuranam/task-checker/main/task-tracker-app/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

## What the Script Does

The automated deployment script handles everything:

1. **DNS Verification** - Checks if your domain is properly configured
2. **System Setup** - Installs Docker, Git, and configures firewall
3. **Vault Initialization** - Sets up HashiCorp Vault with encryption
4. **Secret Management** - Securely stores all credentials in Vault
5. **SSL Certificates** - Configures Traefik + Let's Encrypt for automatic HTTPS
6. **Application Build** - Builds and starts all Docker containers
7. **Database Setup** - Initializes MongoDB with admin user
8. **Verification** - Confirms everything is working

## Prerequisites

Before running the script:

1. **DNS Configuration** - Add an A record for your subdomain:
   ```
   Type: A
   Name: projects
   Value: YOUR_SERVER_IP
   TTL: 3600
   ```

2. **Server Requirements**:
   - Ubuntu 20.04 or later
   - 4 vCPUs, 8GB RAM, 100GB SSD
   - Public IP address
   - Ports 22, 80, 443 open

## What You'll Need

The script will prompt you for:

1. **Domain Name** (default: `projects.sapcindia.com`)
2. **Admin Email** (for Let's Encrypt SSL notifications)
3. **Server IP** (auto-detected, press Enter to confirm)

## Security Features

Your deployment includes:

✅ **HashiCorp Vault** - All secrets encrypted at rest and in transit  
✅ **Docker Secrets** - No plaintext credentials in environment variables  
✅ **Policy-Based Access** - Fine-grained access control for applications  
✅ **Automatic SSL** - Let's Encrypt certificates via Traefik  
✅ **Firewall Protection** - UFW configured for ports 22, 80, 443  
✅ **Audit Logging** - Track all secret access (can be enabled)  
✅ **Git Safe** - Secrets never committed to version control  

## 🔐 Critical Post-Deployment Steps

**IMMEDIATELY after deployment completes:**

### 1. Backup Vault Unseal Keys

```bash
# Keys are saved in: task-tracker-app/infrastructure/docker/vault-keys.json
# Copy this file to a secure location RIGHT NOW
scp root@YOUR_SERVER_IP:task-tracker-app/infrastructure/docker/vault-keys.json ~/vault-keys-backup.json
```

**Store these keys securely:**
- Password manager (1Password, LastPass, Bitwarden)
- Encrypted USB drive in a safe
- Split keys among team members
- **YOU NEED 3 OF 5 KEYS TO UNSEAL VAULT AFTER RESTART**

### 2. Delete Keys from Server

```bash
# After backing up, remove from server
ssh root@YOUR_SERVER_IP
rm task-tracker-app/infrastructure/docker/vault-keys.json
```

### 3. Change Default Admin Password

3. **Access your application:**
   - URL: `https://your-domain.com`
   - User Documentation: `https://your-domain.com/admin/docs`
   - API Documentation: `https://your-domain.com/api/docs`
   - Default username: `admin`
   - Default password: `admin123`
   - **Change the password immediately!**

## Managing Your Deployment

### View Application Logs

```bash
cd task-tracker-app/infrastructure/docker
docker compose -f docker-compose.vault.yml logs -f
```

### Check Vault Status

```bash
docker exec tasktracker-vault vault status
```

### Unseal Vault (After Container Restart)

When the Vault container restarts, it will be sealed for security. Unseal it using 3 of your 5 keys:

```bash
docker exec tasktracker-vault vault operator unseal <KEY_1>
docker exec tasktracker-vault vault operator unseal <KEY_2>
docker exec tasktracker-vault vault operator unseal <KEY_3>
```

### Restart All Services

```bash
cd task-tracker-app/infrastructure/docker
docker compose -f docker-compose.vault.yml restart
```

### Stop All Services

```bash
docker compose -f docker-compose.vault.yml down
```

### View Service Status

```bash
docker ps
```

## Architecture

Your deployment includes:

| Component | Purpose | Port |
|-----------|---------|------|
| **HashiCorp Vault** | Encrypted secret storage | 8200 (internal) |
| **Traefik** | Reverse proxy + SSL | 80, 443 |
| **MongoDB** | Database | 27017 (internal) |
| **Redis** | Session storage | 6379 (internal) |
| **Backend API** | REST API | 5000 (internal) |
| **Auth Service** | JWT authentication | 4000 (internal) |
| **Admin Portal** | Next.js admin UI | 3000 (internal) |
| **Engineer Portal** | Next.js engineer UI | 3001 (internal) |

All services communicate via Docker network. Only Traefik exposes ports 80/443.

## Troubleshooting

### SSL Certificate Not Generated

```bash
# Check Traefik logs
docker logs tasktracker-traefik

# Common issues:
# - DNS not propagated yet (wait 10-60 minutes)
# - Firewall blocking ports 80/443
# - Email address invalid
```

### Services Not Starting

```bash
# Check if Vault is unsealed
docker exec tasktracker-vault vault status

# If sealed, unseal it (see above)

# View service logs
docker compose -f docker-compose.vault.yml logs <service-name>
```

### Cannot Access Application

```bash
# Check firewall
sudo ufw status

# Should show:
# 22/tcp    ALLOW
# 80/tcp    ALLOW  
# 443/tcp   ALLOW

# Check DNS resolution
nslookup your-domain.com

# Check containers running
docker ps
```

### Vault Sealed After Server Reboot

This is **normal security behavior**. Vault automatically seals when restarted.

```bash
# Unseal with 3 of your 5 keys
docker exec tasktracker-vault vault operator unseal <KEY_1>
docker exec tasktracker-vault vault operator unseal <KEY_2>
docker exec tasktracker-vault vault operator unseal <KEY_3>

# Verify unsealed
docker exec tasktracker-vault vault status
# Should show: Sealed = false
```

## Configuration Files

After deployment, these files are generated:

```
task-tracker-app/
├── infrastructure/docker/
│   ├── vault-keys.json        # ⚠️ BACKUP AND DELETE
│   ├── secrets/               # Docker secret files
│   ├── traefik.yml           # Traefik configuration
│   └── docker-compose.vault.yml
├── deployment-config.txt      # Deployment summary
└── services/                  # Application services
```

## Backup and Recovery

See detailed guides:

- **Backup Procedures**: `docs/BACKUP_RECOVERY.md`
- **Full Vault Guide**: `docs/VAULT_DEPLOYMENT.md`
- **Security Best Practices**: `docs/SECURITY.md`
- **Architecture Details**: `docs/ARCHITECTURE.md`

## DNS Setup Details

### For subdomain (projects.sapcindia.com):

1. Login to your DNS provider (GoDaddy, Cloudflare, etc.)
2. Add an A record:
   - **Type**: A
   - **Name**: `projects`
   - **Value**: `YOUR_SERVER_IP`
   - **TTL**: 3600 (1 hour)
3. Save and wait for propagation (5-60 minutes)

### Verify DNS:

```bash
# Should return your server IP
nslookup projects.sapcindia.com

# Or
dig projects.sapcindia.com +short
```

## Monitoring

View real-time logs:

```bash
# All services
docker compose -f docker-compose.vault.yml logs -f

# Specific service
docker logs -f tasktracker-backend
docker logs -f tasktracker-vault
docker logs -f tasktracker-traefik
```

Check resource usage:

```bash
docker stats
```

## Updates and Maintenance

### Update application code:

```bash
cd task-tracker-app
git pull origin main
docker compose -f infrastructure/docker/docker-compose.vault.yml up -d --build
```

### Backup database:

```bash
docker exec tasktracker-mongodb mongodump --out /backup
docker cp tasktracker-mongodb:/backup ./mongodb-backup-$(date +%Y%m%d)
```

### Rotate secrets:

See `docs/VAULT_DEPLOYMENT.md` for secret rotation procedures.

## Support

- **Full Documentation**: See `docs/` folder
- **Issues**: Open an issue on GitHub
- **Architecture**: `docs/ARCHITECTURE.md`
- **Security**: `docs/SECURITY.md`

---

## Quick Reference

| Task | Command |
|------|---------|
| View logs | `docker compose -f docker-compose.vault.yml logs -f` |
| Check Vault status | `docker exec tasktracker-vault vault status` |
| Unseal Vault | `docker exec tasktracker-vault vault operator unseal <KEY>` |
| Restart services | `docker compose -f docker-compose.vault.yml restart` |
| Stop services | `docker compose -f docker-compose.vault.yml down` |
| View containers | `docker ps` |
| Check Traefik | `docker logs tasktracker-traefik` |

---

**⚠️ REMEMBER:**
1. Backup `vault-keys.json` before deleting it
2. You need 3 of 5 keys to unseal Vault
3. Change default admin password
4. Vault seals on restart (this is normal)
5. Keep unseal keys in a secure location

**🎉 Your secure project tracker is now live!**
