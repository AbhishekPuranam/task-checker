# 🔐 Vault-Based Secure Deployment

## Why Use HashiCorp Vault?

**Security Issues with Environment Variables:**
- ❌ Secrets stored in plain text in `.env` files
- ❌ Visible in `docker inspect` and process lists
- ❌ Easy to accidentally commit to git
- ❌ No audit trail of who accessed secrets
- ❌ Difficult to rotate credentials

**Benefits of HashiCorp Vault:**
- ✅ Encrypted storage of all secrets
- ✅ Fine-grained access control
- ✅ Audit logging of secret access
- ✅ Easy credential rotation
- ✅ Secrets never stored on disk unencrypted
- ✅ Automatic unsealing options
- ✅ Secret versioning and rollback

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Application Layer                  │
│  (Backend, Auth Service, Admin, Engineer)          │
└────────────────┬────────────────────────────────────┘
                 │ Request Secrets
                 ▼
┌─────────────────────────────────────────────────────┐
│              HashiCorp Vault Container              │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Secret Engine (KV v2)                       │  │
│  │  ├─ projecttracker/database                  │  │
│  │  │  ├─ mongodb_password                      │  │
│  │  │  └─ redis_password                        │  │
│  │  └─ projecttracker/app                       │  │
│  │     ├─ jwt_secret                            │  │
│  │     ├─ session_secret                        │  │
│  │     ├─ domain                                │  │
│  │     └─ admin_email                           │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                 │ Encrypted Storage
                 ▼
┌─────────────────────────────────────────────────────┐
│              Docker Volume (Encrypted)              │
│              vault_data:/vault/file                 │
└─────────────────────────────────────────────────────┘
```

---

## Quick Setup

### 1. Initialize Vault

```bash
cd infrastructure/docker
./setup-vault.sh
```

This script will:
1. Start Vault container
2. Initialize Vault (generates unseal keys)
3. Unseal Vault automatically
4. Create secret paths and policies
5. Generate and store all secrets
6. Create Docker secret files
7. Save unseal keys to `vault-keys.json`

### 2. Secure Your Unseal Keys

**CRITICAL:** The `vault-keys.json` file contains:
- Root token (admin access to Vault)
- 5 unseal keys (need 3 to unseal)

**You must:**
1. Copy `vault-keys.json` to a secure location:
   - Password manager (1Password, LastPass, Bitwarden)
   - Encrypted USB drive in a safe
   - Print and store in secure location
2. **DELETE** `vault-keys.json` from the server:
   ```bash
   shred -u vault-keys.json  # Secure delete
   ```

### 3. Start All Services

```bash
docker compose -f docker-compose.vault.yml up -d
```

---

## How It Works

### Secret Loading Priority

Applications load secrets with this priority:
1. **HashiCorp Vault** (primary)
2. **Docker Secrets** (fallback)
3. **Environment Variables** (last resort)

### Application Integration

Your Node.js applications use `vault-secrets.js`:

```javascript
const vaultSecrets = require('./vault-secrets');

// Load all secrets at startup
const secrets = await vaultSecrets.loadAllSecrets();

// Or get individual secrets
const mongoUri = await vaultSecrets.getMongoDBUri();
const redisUri = await vaultSecrets.getRedisUri();
const jwtSecret = await vaultSecrets.getSecret('jwt_secret', 'projecttracker/app');
```

### Docker Secrets

Docker mounts secrets as read-only files in `/run/secrets/`:
```
/run/secrets/
├── vault_token
├── mongodb_password
├── redis_password
├── jwt_secret
└── session_secret
```

These files are:
- Only readable by the container
- Not visible in `docker inspect`
- Automatically cleaned up when container stops

---

## Vault Management

### Access Vault UI

```bash
# Forward port to your local machine
ssh -L 8200:localhost:8200 user@your-server

# Open browser
http://localhost:8200
```

Login with root token from `vault-keys.json`

### View Secrets (CLI)

```bash
# Set environment
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="<your-root-token>"

# View database secrets
docker exec -e VAULT_TOKEN=$VAULT_TOKEN tasktracker-vault \
  vault kv get secret/projecttracker/database

# View app secrets
docker exec -e VAULT_TOKEN=$VAULT_TOKEN tasktracker-vault \
  vault kv get secret/projecttracker/app
```

### Rotate Secrets

```bash
# Generate new secret
NEW_JWT_SECRET=$(openssl rand -base64 32)

# Update in Vault
docker exec -e VAULT_TOKEN=$VAULT_TOKEN tasktracker-vault \
  vault kv patch secret/projecttracker/app jwt_secret="$NEW_JWT_SECRET"

# Restart services to pick up new secret
docker compose -f docker-compose.vault.yml restart tasktracker-app
```

### Update Secrets

```bash
# Update MongoDB password
docker exec -e VAULT_TOKEN=$VAULT_TOKEN tasktracker-vault \
  vault kv patch secret/projecttracker/database \
  mongodb_password="new-secure-password"

# Also update Docker secret file
echo "new-secure-password" > secrets/mongodb_password

# Restart affected services
docker compose -f docker-compose.vault.yml restart mongodb tasktracker-app
```

---

## Vault Unsealing

### Why Unsealing?

Vault starts **sealed** for security:
- Data is encrypted and inaccessible
- Need to provide unseal keys to decrypt
- Requires 3 out of 5 keys (threshold)

### Auto-Unseal After Restart

Vault seals itself when the container restarts. You must unseal manually:

```bash
# Get unseal keys from your secure storage
UNSEAL_KEY_1="..."
UNSEAL_KEY_2="..."
UNSEAL_KEY_3="..."

# Unseal (need 3 keys)
docker exec tasktracker-vault vault operator unseal $UNSEAL_KEY_1
docker exec tasktracker-vault vault operator unseal $UNSEAL_KEY_2
docker exec tasktracker-vault vault operator unseal $UNSEAL_KEY_3
```

### Unseal Script

Create a script for easier unsealing:

```bash
#!/bin/bash
# unseal-vault.sh

echo "Enter unseal key 1:"
read -s KEY1
docker exec tasktracker-vault vault operator unseal $KEY1

echo "Enter unseal key 2:"
read -s KEY2
docker exec tasktracker-vault vault operator unseal $KEY2

echo "Enter unseal key 3:"
read -s KEY3
docker exec tasktracker-vault vault operator unseal $KEY3

echo "✓ Vault unsealed"
```

### Check Seal Status

```bash
docker exec tasktracker-vault vault status

# Sealed: true/false
# If sealed=true, you need to unseal
```

---

## Security Best Practices

### 1. Unseal Keys Management

- ✅ **DO** store keys in multiple secure locations
- ✅ **DO** use different people for different keys (Shamir's Secret Sharing)
- ✅ **DO** keep offline backups
- ❌ **DON'T** store all keys together
- ❌ **DON'T** keep keys on the server
- ❌ **DON'T** commit keys to git

### 2. Root Token

- Use root token only for initial setup
- Create separate tokens with limited policies for operations
- Revoke root token after setup if not needed
- Store securely like unseal keys

### 3. Application Tokens

- Use policy-based tokens with minimal permissions
- Rotate tokens periodically
- Use short TTL (time-to-live) when possible
- Audit token usage

### 4. Backup Strategy

```bash
# Backup Vault data
docker exec tasktracker-vault vault operator raft snapshot save /vault/file/backup.snap
docker cp tasktracker-vault:/vault/file/backup.snap ./vault-backup-$(date +%Y%m%d).snap

# Encrypt backup
gpg -c vault-backup-$(date +%Y%m%d).snap

# Store encrypted backup securely
```

### 5. Network Security

- Vault UI should NOT be publicly accessible
- Use SSH tunneling to access Vault UI
- Enable TLS for Vault in production
- Restrict Vault port (8200) to internal network

---

## Monitoring & Auditing

### Enable Audit Logging

```bash
docker exec -e VAULT_TOKEN=$VAULT_TOKEN tasktracker-vault \
  vault audit enable file file_path=/vault/logs/audit.log

# View audit logs
docker exec tasktracker-vault cat /vault/logs/audit.log
```

### Health Checks

```bash
# Vault health
curl http://localhost:8200/v1/sys/health

# Seal status
docker exec tasktracker-vault vault status
```

---

## Troubleshooting

### Vault Won't Start

```bash
# Check logs
docker logs tasktracker-vault

# Check storage permissions
docker exec tasktracker-vault ls -la /vault/file
```

### Can't Access Secrets

```bash
# Check token validity
docker exec -e VAULT_TOKEN=$VAULT_TOKEN tasktracker-vault \
  vault token lookup

# Check policy permissions
docker exec -e VAULT_TOKEN=$VAULT_TOKEN tasktracker-vault \
  vault token capabilities secret/projecttracker/database
```

### Application Can't Connect to Vault

```bash
# Check network connectivity
docker exec tasktracker-app ping vault

# Check Vault token file
docker exec tasktracker-app cat /run/secrets/vault_token

# Check application logs
docker logs tasktracker-app | grep -i vault
```

### Vault Sealed After Restart

This is normal! Vault seals on restart for security.

```bash
# Unseal using 3 keys
./unseal-vault.sh
```

---

## Migration Guide

### From Environment Variables to Vault

If you're currently using `.env` files:

1. **Run setup script:**
   ```bash
   ./setup-vault.sh
   ```

2. **Switch docker-compose file:**
   ```bash
   # Stop current deployment
   docker compose down
   
   # Start with Vault
   docker compose -f docker-compose.vault.yml up -d
   ```

3. **Update applications** to use `vault-secrets.js`

4. **Remove old .env files:**
   ```bash
   rm services/backend-api/.env
   rm services/auth-service/.env
   rm clients/*/.env.local
   ```

5. **Verify secrets are loaded** from Vault:
   ```bash
   docker logs tasktracker-app | grep "Loaded.*from Vault"
   ```

---

## Comparison

| Feature | Environment Variables | Docker Secrets | HashiCorp Vault |
|---------|---------------------|----------------|-----------------|
| Encryption at rest | ❌ | ✅ | ✅ |
| Encryption in transit | ❌ | ✅ | ✅ |
| Audit logging | ❌ | ❌ | ✅ |
| Access control | ❌ | ⚠️ Limited | ✅ Full RBAC |
| Secret rotation | Manual | Manual | ✅ Easy |
| Versioning | ❌ | ❌ | ✅ |
| Central management | ❌ | ❌ | ✅ |
| Leak prevention | ❌ | ✅ | ✅ |
| Complexity | Low | Medium | High |

---

## Production Recommendations

For production use:

1. **Enable TLS for Vault** - Don't use TLS disable
2. **Use auto-unseal** - AWS KMS, GCP KMS, Azure Key Vault
3. **Enable audit logging** - Track all secret access
4. **Regular backups** - Automated encrypted snapshots
5. **Monitor seal status** - Alert if Vault becomes sealed
6. **Rotate secrets** - Schedule regular credential rotation
7. **Separate Vault cluster** - Don't run on same server as app
8. **High availability** - Run multiple Vault instances

---

## Summary

✅ **Secrets stored encrypted in Vault**
✅ **Fine-grained access control**
✅ **Audit trail of all access**
✅ **Easy credential rotation**
✅ **No secrets in git or environment**
✅ **Production-grade security**

Your secrets are now enterprise-grade secure! 🔒
