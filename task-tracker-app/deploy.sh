#!/bin/bash

# Project Tracker - Automated Deployment Script
# This script automates the entire deployment process

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓ ${NC}$1"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${NC}$1"
}

print_error() {
    echo -e "${RED}✗ ${NC}$1"
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Function to prompt for input with default value
prompt_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        eval "$var_name=\"${input:-$default}\""
    else
        read -p "$prompt: " input
        eval "$var_name=\"$input\""
    fi
}

# Function to generate random secret
generate_secret() {
    openssl rand -base64 32
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check DNS resolution
check_dns() {
    local domain="$1"
    print_info "Checking DNS for $domain..."
    
    if nslookup "$domain" >/dev/null 2>&1; then
        local ip=$(nslookup "$domain" | grep -A1 "Name:" | tail -n1 | awk '{print $2}')
        print_success "DNS resolved: $domain → $ip"
        return 0
    else
        print_warning "DNS not resolved yet for $domain"
        return 1
    fi
}

# Banner
clear
echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     🏗️  PROJECT TRACKER DEPLOYMENT SCRIPT            ║
║                                                       ║
║     Automated setup for production deployment        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_warning "This script should NOT be run as root. Run as a regular user with sudo privileges."
    read -p "Continue anyway? (y/N): " continue
    if [[ ! $continue =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_header "STEP 1: CONFIGURATION"

# Collect configuration
print_info "Let's gather your deployment configuration..."
echo ""

# Deployment mode selection
echo "Select deployment mode:"
echo "  1) IP-based deployment (HTTP only, no domain required)"
echo "  2) Domain-based deployment (HTTPS with Let's Encrypt)"
echo ""
read -p "Enter choice [1]: " deploy_mode
deploy_mode=${deploy_mode:-1}

# Server configuration
print_info "Checking current server IP..."
SERVER_IP=$(curl -4s ifconfig.me || echo "")
if [ -n "$SERVER_IP" ]; then
    print_success "Detected server IP: $SERVER_IP"
    prompt_input "Confirm server IP" "$SERVER_IP" SERVER_IP
else
    prompt_input "Enter server IP" "" SERVER_IP
fi

# Domain configuration based on mode
if [ "$deploy_mode" = "2" ]; then
    USE_DOMAIN=true
    prompt_input "Enter your domain" "projects.sapcindia.com" DOMAIN
    prompt_input "Enter admin email for SSL certificates" "admin@sapcindia.com" ADMIN_EMAIL
else
    USE_DOMAIN=false
    DOMAIN="$SERVER_IP"
    ADMIN_EMAIL="admin@localhost"
    print_success "Using IP-based deployment: http://${SERVER_IP}"
fi

# Generate secrets
print_info "Generating secure secrets..."
JWT_SECRET=$(generate_secret)
SESSION_SECRET=$(generate_secret)
MONGODB_PASSWORD=$(openssl rand -base64 16)

print_success "Secrets generated successfully"
echo ""
print_warning "IMPORTANT: Save these credentials securely!"
echo ""
echo "MongoDB Password: $MONGODB_PASSWORD"
echo "JWT Secret: $JWT_SECRET"
echo "Session Secret: $SESSION_SECRET"
echo ""
read -p "Press Enter to continue after saving these credentials..."

# Installation directory
prompt_input "Installation directory" "/opt/projecttracker" INSTALL_DIR

print_header "STEP 2: DNS VERIFICATION"

# Skip DNS check for IP-based deployment
if [ "$USE_DOMAIN" = "true" ]; then
    # Check DNS
    if check_dns "$DOMAIN"; then
        DNS_IP=$(nslookup "$DOMAIN" | grep -A1 "Name:" | tail -n1 | awk '{print $2}')
        if [ "$DNS_IP" != "$SERVER_IP" ]; then
            print_warning "DNS points to $DNS_IP but server IP is $SERVER_IP"
            print_info "Make sure your DNS A record is configured correctly:"
            echo ""
            echo "  Type: A"
            echo "  Name: projects"
            echo "  Value: $SERVER_IP"
            echo "  TTL: 3600"
            echo ""
            read -p "Continue anyway? (y/N): " continue
            if [[ ! $continue =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        print_warning "DNS not configured yet!"
        echo ""
        print_info "Please configure DNS before continuing:"
        echo ""
        echo "  Type: A"
        echo "  Name: projects (or appropriate subdomain)"
        echo "  Value: $SERVER_IP"
        echo "  TTL: 3600"
        echo ""
        read -p "Continue without DNS? Let's Encrypt will fail without proper DNS! (y/N): " continue
        if [[ ! $continue =~ ^[Yy]$ ]]; then
            print_info "Please configure DNS and run this script again."
            exit 1
        fi
    fi
else
    print_success "Skipping DNS verification for IP-based deployment"
    print_info "Access will be via: http://${SERVER_IP}"
fi
    echo ""
    echo "  Type: A"
    echo "  Name: projects (or appropriate subdomain)"
    echo "  Value: $SERVER_IP"
    echo "  TTL: 3600"
    echo ""
    read -p "Continue without DNS? Let's Encrypt will fail without proper DNS! (y/N): " continue
    if [[ ! $continue =~ ^[Yy]$ ]]; then
        print_info "Please configure DNS and run this script again."
        exit 1
    fi
fi

print_header "STEP 3: SYSTEM DEPENDENCIES"

# Check for required commands
print_info "Checking system dependencies..."

# Check Docker
if ! command_exists docker; then
    print_warning "Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    sudo systemctl start docker
    sudo systemctl enable docker
    print_success "Docker installed"
else
    print_success "Docker already installed"
fi

# Check Docker Compose
if ! docker compose version >/dev/null 2>&1; then
    print_error "Docker Compose not found. Please install Docker Compose v2+"
    exit 1
else
    print_success "Docker Compose found"
fi

# Check Git
if ! command_exists git; then
    print_warning "Git not found. Installing..."
    sudo apt-get update && sudo apt-get install -y git
    print_success "Git installed"
else
    print_success "Git already installed"
fi

print_header "STEP 4: FIREWALL CONFIGURATION"

# Configure firewall
if command_exists ufw; then
    print_info "Configuring firewall..."
    
    sudo ufw --force enable
    sudo ufw allow 22/tcp  # SSH
    sudo ufw allow 80/tcp  # HTTP
    sudo ufw allow 443/tcp # HTTPS
    
    print_success "Firewall configured"
else
    print_warning "UFW not found. Skipping firewall configuration."
    print_info "Please ensure ports 22, 80, and 443 are open."
fi

print_header "STEP 5: APPLICATION SETUP"

# Create installation directory
print_info "Creating installation directory..."
sudo mkdir -p "$INSTALL_DIR"
sudo chown -R $USER:$USER "$INSTALL_DIR"

# Clone repository
cd "$INSTALL_DIR"
if [ -d "task-checker" ]; then
    print_info "Repository already exists. Pulling latest changes..."
    cd task-checker/task-tracker-app
    git pull origin main
else
    print_info "Cloning repository..."
    git clone https://github.com/AbhishekPuranam/task-checker.git
    cd task-checker/task-tracker-app
fi

print_success "Repository ready"

print_header "STEP 6: VAULT INITIALIZATION"

# Create secrets directory
SECRETS_DIR="infrastructure/docker/secrets"
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

# Start Vault container first
print_info "Starting Vault container..."
cd infrastructure/docker
docker compose up -d vault

# Wait for Vault to be ready
print_info "Waiting for Vault to be ready..."
sleep 5

VAULT_ADDR="http://localhost:8200"
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s "$VAULT_ADDR/v1/sys/health" >/dev/null 2>&1; then
        print_success "Vault is ready"
        break
    fi
    attempt=$((attempt + 1))
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    print_error "Vault failed to start"
    exit 1
fi

# Check if Vault is already initialized
print_info "Checking Vault initialization status..."
VAULT_STATUS=$(docker exec tasktracker-vault vault status -format=json 2>/dev/null || echo '{"initialized":false}')
IS_INITIALIZED=$(echo "$VAULT_STATUS" | jq -r '.initialized')

VAULT_KEYS_FILE="vault-keys.json"

if [ "$IS_INITIALIZED" = "true" ]; then
    print_warning "Vault is already initialized"
    
    # Check if vault-keys.json exists
    if [ -f "$VAULT_KEYS_FILE" ]; then
        print_success "Found existing vault-keys.json file"
        VAULT_INIT=$(cat "$VAULT_KEYS_FILE")
        
        # Extract tokens and keys
        ROOT_TOKEN=$(echo "$VAULT_INIT" | jq -r '.root_token')
        UNSEAL_KEY_1=$(echo "$VAULT_INIT" | jq -r '.unseal_keys_b64[0]')
        UNSEAL_KEY_2=$(echo "$VAULT_INIT" | jq -r '.unseal_keys_b64[1]')
        UNSEAL_KEY_3=$(echo "$VAULT_INIT" | jq -r '.unseal_keys_b64[2]')
    else
        print_error "Vault is initialized but vault-keys.json not found!"
        print_error "Please provide the Vault root token and unseal keys manually."
        echo ""
        prompt_input "Enter Vault root token" "" ROOT_TOKEN
        prompt_input "Enter unseal key 1" "" UNSEAL_KEY_1
        prompt_input "Enter unseal key 2" "" UNSEAL_KEY_2
        prompt_input "Enter unseal key 3" "" UNSEAL_KEY_3
    fi
else
    # Initialize Vault
    print_info "Initializing Vault..."
    VAULT_INIT=$(docker exec tasktracker-vault vault operator init -key-shares=5 -key-threshold=3 -format=json)

    # Extract tokens and keys
    ROOT_TOKEN=$(echo "$VAULT_INIT" | jq -r '.root_token')
    UNSEAL_KEY_1=$(echo "$VAULT_INIT" | jq -r '.unseal_keys_b64[0]')
    UNSEAL_KEY_2=$(echo "$VAULT_INIT" | jq -r '.unseal_keys_b64[1]')
    UNSEAL_KEY_3=$(echo "$VAULT_INIT" | jq -r '.unseal_keys_b64[2]')

    # Save Vault keys
    echo "$VAULT_INIT" > "$VAULT_KEYS_FILE"
    chmod 600 "$VAULT_KEYS_FILE"

    print_success "Vault initialized"
fi

# Check if Vault needs to be unsealed
IS_SEALED=$(echo "$VAULT_STATUS" | jq -r '.sealed')
if [ "$IS_SEALED" = "true" ]; then
    # Unseal Vault
    print_info "Unsealing Vault..."
    docker exec tasktracker-vault vault operator unseal "$UNSEAL_KEY_1" >/dev/null
    docker exec tasktracker-vault vault operator unseal "$UNSEAL_KEY_2" >/dev/null
    docker exec tasktracker-vault vault operator unseal "$UNSEAL_KEY_3" >/dev/null
    print_success "Vault unsealed"
else
    print_success "Vault is already unsealed"
fi

# Configure Vault
print_info "Configuring Vault secrets..."

# Enable KV secrets engine
docker exec -e VAULT_TOKEN="$ROOT_TOKEN" tasktracker-vault \
    vault secrets enable -path=secret kv-v2 2>/dev/null || true

# Check if secrets already exist
SECRETS_EXIST=$(docker exec -e VAULT_TOKEN="$ROOT_TOKEN" tasktracker-vault \
    vault kv get -format=json secret/projecttracker/database 2>/dev/null || echo "null")

if [ "$SECRETS_EXIST" = "null" ]; then
    print_info "Creating new secrets in Vault..."
    
    # Store secrets in Vault
    docker exec -e VAULT_TOKEN="$ROOT_TOKEN" tasktracker-vault \
        vault kv put secret/projecttracker/database \
        mongodb_password="$MONGODB_PASSWORD" \
        redis_password=$(openssl rand -base64 16)

    docker exec -e VAULT_TOKEN="$ROOT_TOKEN" tasktracker-vault \
        vault kv put secret/projecttracker/app \
        jwt_secret="$JWT_SECRET" \
        session_secret="$SESSION_SECRET" \
        domain="$DOMAIN" \
        admin_email="$ADMIN_EMAIL"
    
    print_success "New secrets stored in Vault"
else
    print_warning "Secrets already exist in Vault"
    
    read -p "Do you want to update the secrets? (y/N): " update_secrets
    if [[ $update_secrets =~ ^[Yy]$ ]]; then
        docker exec -e VAULT_TOKEN="$ROOT_TOKEN" tasktracker-vault \
            vault kv put secret/projecttracker/database \
            mongodb_password="$MONGODB_PASSWORD" \
            redis_password=$(openssl rand -base64 16)

        docker exec -e VAULT_TOKEN="$ROOT_TOKEN" tasktracker-vault \
            vault kv put secret/projecttracker/app \
            jwt_secret="$JWT_SECRET" \
            session_secret="$SESSION_SECRET" \
            domain="$DOMAIN" \
            admin_email="$ADMIN_EMAIL"
        
        print_success "Secrets updated in Vault"
    else
        print_info "Keeping existing secrets"
        # Retrieve existing MongoDB password if not updating
        MONGODB_PASSWORD=$(docker exec -e VAULT_TOKEN="$ROOT_TOKEN" tasktracker-vault \
            vault kv get -format=json secret/projecttracker/database | jq -r '.data.data.mongodb_password')
    fi
fi

# Create application policy
docker exec -e VAULT_TOKEN="$ROOT_TOKEN" tasktracker-vault vault policy write projecttracker-policy - <<POLICY
path "secret/data/projecttracker/*" {
  capabilities = ["read"]
}
POLICY

# Create application token
APP_TOKEN=$(docker exec -e VAULT_TOKEN="$ROOT_TOKEN" tasktracker-vault \
    vault token create -policy=projecttracker-policy -format=json | jq -r '.auth.client_token')

print_success "Vault configured with secrets"

# Create Docker secret files
print_info "Creating Docker secret files..."
echo "$MONGODB_PASSWORD" > "$SECRETS_DIR/mongodb_password"
echo "$(openssl rand -base64 16)" > "$SECRETS_DIR/redis_password"
echo "$JWT_SECRET" > "$SECRETS_DIR/jwt_secret"
echo "$SESSION_SECRET" > "$SECRETS_DIR/session_secret"
echo "$APP_TOKEN" > "$SECRETS_DIR/vault_token"

chmod 600 "$SECRETS_DIR"/*
print_success "Docker secrets created"

cd ../..

# Update CORS in backend
print_info "Updating CORS configuration..."
sed -i.bak "s|\"https://tracker.sapc.in\"|\"https://${DOMAIN}\"|g" services/backend-api/server.js 2>/dev/null || true
sed -i.bak "s|\"http://tracker.sapc.in\"|\"http://${DOMAIN}\"|g" services/backend-api/server.js 2>/dev/null || true
sed -i.bak "s|https://tracker.sapc.in|https://${DOMAIN}|g" clients/admin/.env.local 2>/dev/null || true
sed -i.bak "s|https://tracker.sapc.in|https://${DOMAIN}|g" clients/engineer/.env.local 2>/dev/null || true

print_header "STEP 7: DOCKER DEPLOYMENT"


# Build and start services with appropriate Traefik config
print_info "Starting all services with Docker Compose..."
cd infrastructure/docker
if [ "$USE_DOMAIN" = "true" ]; then
    # Use HTTPS config
    cp traefik-https.yml traefik.yml
    # Replace admin email in traefik.yml
    sed -i.bak "s|ADMIN_EMAIL_PLACEHOLDER|$ADMIN_EMAIL|g" traefik.yml
    print_success "Using HTTPS/Let's Encrypt Traefik config."
else
    cp traefik-http.yml traefik.yml
    print_success "Using HTTP-only Traefik config."
fi
docker compose up -d --build
cd ../..

# Update docker-compose.yml with MongoDB password
print_info "Updating docker-compose.yml..."
sed -i.bak "s|MONGO_INITDB_ROOT_PASSWORD:.*|MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_PASSWORD}|" infrastructure/docker/docker-compose.yml

# Create upload directories
print_info "Creating upload directories..."
mkdir -p uploads/excel uploads/structural logs
chmod -R 755 uploads logs
print_success "Upload directories created"

print_header "STEP 8: DOCKER BUILD & START"

cd infrastructure/docker

print_info "Building Docker images (this may take several minutes)..."
docker compose build

print_info "Starting services..."
docker compose up -d

print_success "Services started"

# Wait for services to be ready
print_info "Waiting for services to be ready..."
sleep 10

print_header "STEP 9: DATABASE INITIALIZATION"

print_info "Waiting for MongoDB to be ready..."
sleep 10

print_info "Creating initial admin user..."

# Create admin user
docker exec -i tasktracker-mongodb mongosh -u admin -p "${MONGODB_PASSWORD}" --authenticationDatabase admin << MONGOEOF
use projecttracker
db.users.insertOne({
  username: "admin",
  email: "${ADMIN_EMAIL}",
  password: "\$2a\$10\$rH8JhQKNsLJHxJ2RzqLX4.xY7vJ3YzJHYvJ3YzJHYvJ3YzJHYvJ3Y",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date()
})
MONGOEOF

print_success "Admin user created"

print_header "STEP 10: VERIFICATION"

# Check services
print_info "Checking service status..."
docker compose ps

# Check if all services are running
RUNNING=$(docker compose ps --format json | jq -r '.State' | grep -c "running" || echo "0")
TOTAL=$(docker compose ps --format json | jq -r '.State' | wc -l)

if [ "$RUNNING" -eq "$TOTAL" ]; then
    print_success "All $RUNNING services are running"
else
    print_warning "$RUNNING out of $TOTAL services are running"
fi

# Check Traefik logs for SSL certificate
print_info "Checking SSL certificate status..."
sleep 5
if docker compose logs traefik | grep -q "Obtained certificate"; then
    print_success "SSL certificate obtained from Let's Encrypt!"
else
    print_warning "SSL certificate not obtained yet. Check logs with: docker compose logs traefik"
fi

print_header "DEPLOYMENT COMPLETE! 🎉"

echo ""
print_success "Project Tracker has been deployed successfully!"
echo ""
print_info "Access your application at: https://${DOMAIN}"
echo ""
print_info "Default login credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
print_warning "IMPORTANT: Change the default password immediately after first login!"
echo ""
print_info "Important credentials (save these securely):"
echo "  MongoDB Password: $MONGODB_PASSWORD"
echo "  JWT Secret: $JWT_SECRET"
echo "  Session Secret: $SESSION_SECRET"
echo ""
print_info "Useful commands:"
echo "  View logs:        cd $INSTALL_DIR/task-checker/task-tracker-app/infrastructure/docker && docker compose logs -f"
echo "  Restart services: cd $INSTALL_DIR/task-checker/task-tracker-app/infrastructure/docker && docker compose restart"
echo "  Stop services:    cd $INSTALL_DIR/task-checker/task-tracker-app/infrastructure/docker && docker compose down"
echo ""
print_info "For troubleshooting, check: $INSTALL_DIR/task-checker/task-tracker-app/docs/DEPLOYMENT_GUIDE.md"
echo ""

# Save configuration to file
CONFIG_FILE="$INSTALL_DIR/task-checker/deployment-config.txt"
cat > "$CONFIG_FILE" << EOF
Project Tracker Deployment Configuration
Generated: $(date)

Domain: $DOMAIN
Server IP: $SERVER_IP
Admin Email: $ADMIN_EMAIL
Installation Directory: $INSTALL_DIR

Vault Root Token: $ROOT_TOKEN
Vault Application Token: $APP_TOKEN

IMPORTANT: Vault Unseal Keys saved in infrastructure/docker/vault-keys.json
BACKUP THIS FILE IMMEDIATELY - You need 3 of 5 keys to unseal Vault after restart

Default Admin Login:
  Username: admin
  Password: admin123 (CHANGE THIS!)

Application URL: https://${DOMAIN}

Vault URL (internal): http://localhost:8200
EOF

print_success "Configuration saved to: $CONFIG_FILE"
echo ""
print_warning "Keep this file secure and delete it after backing up the credentials!"
echo ""

print_success "=== DEPLOYMENT SUCCESSFUL! ==="
echo ""
print_info "Access your application:"
echo "   ${GREEN}https://${DOMAIN}${NC}"
echo ""
print_info "Configuration saved to: deployment-config.txt"
echo ""
print_warning "IMPORTANT SECURITY NOTES:"
echo "   1. Vault unseal keys saved to: infrastructure/docker/vault-keys.json"
echo "   2. ${YELLOW}BACKUP THIS FILE IMMEDIATELY to a secure location${NC}"
echo "   3. ${YELLOW}Store unseal keys in a password manager or offline safe${NC}"
echo "   4. You need 3 of 5 unseal keys to unseal Vault after restart"
echo "   5. After backup, delete vault-keys.json from the server"
echo ""
print_info "To unseal Vault after container restart:"
echo "   docker exec tasktracker-vault vault operator unseal <key1>"
echo "   docker exec tasktracker-vault vault operator unseal <key2>"
echo "   docker exec tasktracker-vault vault operator unseal <key3>"
echo ""
print_info "View Vault status:"
echo "   docker exec tasktracker-vault vault status"
echo ""
print_info "View logs:"
echo "   docker compose -f infrastructure/docker/docker-compose.yml logs -f"
echo ""
print_success "Your secure project tracker is now live!"
