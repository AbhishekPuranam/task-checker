#!/bin/bash

###############################################################################
# Uptime Kuma Production Setup Script
# 
# This script runs on the production server (62.72.56.99) inside the 
# Uptime Kuma container to configure comprehensive monitoring with proper
# authentication for protected endpoints.
#
# Usage:
#   chmod +x setup-uptime-kuma-production.sh
#   ./setup-uptime-kuma-production.sh
###############################################################################

set -e

echo "🚀 Setting up Uptime Kuma monitors on production server..."

# Configuration
BASE_DOMAIN="projects.sapcindia.com"
ADMIN_EMAIL="admin@sapcindia.com"
ADMIN_PASSWORD="Coreinme@789"
UPTIME_KUMA_CONTAINER="uptime-kuma"

echo "📦 Installing dependencies in Uptime Kuma container..."

# Install Node.js packages needed for the script
docker exec $UPTIME_KUMA_CONTAINER sh -c "cd /app && npm install axios --save 2>/dev/null || true"

echo "📝 Creating monitoring script inside container..."

# Create the monitoring script inside the container
docker exec $UPTIME_KUMA_CONTAINER sh -c 'cat > /app/setup-monitors.js << '\''EOFSCRIPT'\''
const axios = require("axios");
const io = require("socket.io-client");

const UPTIME_KUMA_URL = "http://localhost:3001";
const USERNAME = "admin";
const PASSWORD = "Coreinme@789";
const BASE_DOMAIN = "projects.sapcindia.com";
const API_BASE = `https://${BASE_DOMAIN}/api`;

// Admin credentials for JWT
const ADMIN_EMAIL = "admin@sapcindia.com";
const ADMIN_PASSWORD = "Coreinme@789";

let JWT_TOKEN = null;

// Get JWT token for authenticated endpoints
async function getJWTToken() {
  try {
    console.log("🔐 Getting JWT token for authenticated endpoints...");
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (response.data.token) {
      JWT_TOKEN = response.data.token;
      console.log("✅ JWT token obtained successfully");
      return JWT_TOKEN;
    }
  } catch (error) {
    console.error("❌ Failed to get JWT token:", error.message);
    return null;
  }
}

// Monitor configurations
const MONITORS = [
  // Infrastructure Services
  {
    name: "🔒 Vault - Secret Management",
    type: "http",
    url: "http://tasktracker-vault:8200/v1/sys/health",
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "HashiCorp Vault health check",
    accepted_statuscodes: ["200-299", "429", "473"]
  },
  {
    name: "🗄️ MongoDB - Database",
    type: "port",
    hostname: "tasktracker-mongodb",
    port: 27017,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "MongoDB replica set health"
  },
  {
    name: "⚡ Redis - Cache & Queue",
    type: "port",
    hostname: "tasktracker-redis",
    port: 6379,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Redis cache and BullMQ"
  },
  
  // Microservices - Backend APIs with JWT auth
  {
    name: "🔐 Auth Service",
    type: "http",
    url: `${API_BASE}/auth/me`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Authentication & Authorization service",
    accepted_statuscodes: ["200-299", "401"],
    headers: {}  // Will add JWT dynamically
  },
  {
    name: "📊 Excel Service",
    type: "http",
    url: `${API_BASE}/excel`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Excel upload & batch processing",
    accepted_statuscodes: ["200-299", "401"],
    headers: {}
  },
  {
    name: "📁 Project Service",
    type: "http",
    url: `${API_BASE}/projects`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Project management service",
    accepted_statuscodes: ["200-299", "401"],
    headers: {}
  },
  {
    name: "📋 SubProject Service",
    type: "http",
    url: `${API_BASE}/subprojects`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "SubProject management service",
    accepted_statuscodes: ["200-299", "401"],
    headers: {}
  },
  {
    name: "🏗️ Structural Elements Service",
    type: "http",
    url: `${API_BASE}/structural-elements`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Structural elements service (3 replicas)",
    accepted_statuscodes: ["200-299", "401"],
    headers: {}
  },
  {
    name: "⚙️ Jobs Service",
    type: "http",
    url: `${API_BASE}/jobs`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Jobs management service (3 replicas)",
    accepted_statuscodes: ["200-299", "401"],
    headers: {}
  },
  {
    name: "📈 Metrics Service",
    type: "http",
    url: `${API_BASE}/metrics`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Reports & analytics service",
    accepted_statuscodes: ["200-299", "401", "404"],
    headers: {}
  },
  
  // Frontend Services
  {
    name: "🖥️ Admin Portal",
    type: "http",
    url: `https://${BASE_DOMAIN}/admin`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Admin UI (2 replicas)"
  },
  {
    name: "👷 Engineer Portal",
    type: "http",
    url: `https://${BASE_DOMAIN}/engineer`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Engineer UI (2 replicas)"
  },
  
  // Monitoring Services
  {
    name: "🔍 OpenSearch",
    type: "http",
    url: "http://tasktracker-opensearch:9200/_cluster/health",
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "OpenSearch cluster health",
    accepted_statuscodes: ["200-299", "401"]
  },
  {
    name: "📊 OpenSearch Dashboards",
    type: "http",
    url: "http://tasktracker-dashboards:5601/api/status",
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "OpenSearch Dashboards UI",
    accepted_statuscodes: ["200-299", "302"]
  },
  {
    name: "🌐 Traefik Dashboard",
    type: "http",
    url: "http://tasktracker-traefik:8080/dashboard/",
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Traefik reverse proxy dashboard"
  },
  
  // Main Application Endpoints
  {
    name: "🌍 Main Website",
    type: "http",
    url: `https://${BASE_DOMAIN}`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Main application landing page"
  },
  {
    name: "🔑 Login Page",
    type: "http",
    url: `https://${BASE_DOMAIN}/login`,
    interval: 60,
    maxretries: 3,
    retryInterval: 60,
    description: "Login page availability",
    keyword: "Login"
  }
];

class UptimeKumaClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.token = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log("🔌 Connecting to Uptime Kuma...");
      
      this.socket = io(this.url, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on("connect", () => {
        console.log("✅ Connected to Uptime Kuma");
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error("❌ Connection error:", error.message);
        reject(error);
      });

      setTimeout(() => {
        if (!this.socket.connected) {
          reject(new Error("Connection timeout"));
        }
      }, 10000);
    });
  }

  async login(username, password) {
    return new Promise((resolve, reject) => {
      console.log("🔐 Logging in to Uptime Kuma...");
      
      this.socket.emit("login", {
        username,
        password,
        token: ""
      }, (response) => {
        if (response.ok) {
          this.token = response.token;
          console.log("✅ Login successful");
          resolve(response);
        } else {
          console.error("❌ Login failed:", response.msg);
          reject(new Error(response.msg));
        }
      });

      setTimeout(() => {
        reject(new Error("Login timeout"));
      }, 5000);
    });
  }

  async deleteMonitor(monitorId) {
    return new Promise((resolve, reject) => {
      this.socket.emit("deleteMonitor", monitorId, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.msg));
        }
      });

      setTimeout(() => {
        reject(new Error(`Timeout deleting monitor: ${monitorId}`));
      }, 10000);
    });
  }

  async addMonitor(monitorConfig) {
    return new Promise((resolve, reject) => {
      const monitor = {
        type: monitorConfig.type || "http",
        name: monitorConfig.name,
        url: monitorConfig.url,
        hostname: monitorConfig.hostname,
        port: monitorConfig.port,
        interval: monitorConfig.interval || 60,
        maxretries: monitorConfig.maxretries || 3,
        retryInterval: monitorConfig.retryInterval || 60,
        resendInterval: 0,
        ignoreTls: false,
        upsideDown: false,
        maxredirects: 10,
        accepted_statuscodes: monitorConfig.accepted_statuscodes || ["200-299"],
        dns_resolve_type: "A",
        dns_resolve_server: "1.1.1.1",
        notificationIDList: {},
        description: monitorConfig.description || "",
        keyword: monitorConfig.keyword || "",
        expiryNotification: false,
        proxyId: null,
        headers: monitorConfig.headers || null
      };

      // Add JWT token to headers if needed
      if (JWT_TOKEN && monitorConfig.headers !== undefined) {
        monitor.headers = JSON.stringify({
          "Authorization": `Bearer ${JWT_TOKEN}`
        });
      }

      this.socket.emit("add", monitor, (response) => {
        if (response.ok) {
          console.log(`✅ Monitor created: ${monitor.name} (ID: ${response.monitorID})`);
          resolve(response);
        } else {
          console.error(`❌ Failed to create monitor ${monitor.name}:`, response.msg);
          reject(new Error(response.msg));
        }
      });

      setTimeout(() => {
        reject(new Error(`Timeout creating monitor: ${monitor.name}`));
      }, 10000);
    });
  }

  async getMonitors() {
    return new Promise((resolve, reject) => {
      this.socket.emit("getMonitorList", (response) => {
        if (response.ok) {
          const monitorList = response.monitorList || {};
          resolve(monitorList);
        } else {
          reject(new Error(response.msg));
        }
      });

      setTimeout(() => {
        reject(new Error("Timeout fetching monitors"));
      }, 5000);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

async function main() {
  const client = new UptimeKumaClient(UPTIME_KUMA_URL);
  
  try {
    // Get JWT token first
    await getJWTToken();
    
    // Connect to Uptime Kuma
    await client.connect();
    await client.login(USERNAME, PASSWORD);
    
    // Delete all existing monitors
    console.log("\n🗑️  Deleting existing monitors...");
    const existingMonitors = await client.getMonitors();
    const monitorIds = Object.keys(existingMonitors);
    
    for (const monitorId of monitorIds) {
      try {
        await client.deleteMonitor(parseInt(monitorId));
        console.log(`✅ Deleted monitor ID: ${monitorId}`);
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ Error deleting monitor ${monitorId}:`, error.message);
      }
    }
    
    console.log("\n⏳ Waiting 2 seconds before creating new monitors...\n");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create new monitors
    console.log("📊 Creating fixed monitors...\n");
    
    let successCount = 0;
    let failCount = 0;
    
    for (const monitor of MONITORS) {
      try {
        await client.addMonitor(monitor);
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error creating ${monitor.name}:`, error.message);
        failCount++;
      }
    }
    
    console.log("\n📊 Summary:");
    console.log(`✅ Successfully created: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📝 Total monitors: ${MONITORS.length}`);
    
    console.log("\n🎉 Monitor setup complete!");
    console.log(`\n🌐 Access Uptime Kuma at: http://62.72.56.99:3001`);
    
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

main().catch(error => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
EOFSCRIPT
'

echo "🚀 Running monitoring setup script..."
docker exec $UPTIME_KUMA_CONTAINER node /app/setup-monitors.js

echo ""
echo "✅ Uptime Kuma monitoring setup complete!"
echo ""
echo "📊 Access your monitoring dashboard at: http://62.72.56.99:3001"
echo "   Username: admin"
echo "   Password: Coreinme@789"
echo ""
echo "💡 All monitors are now configured with:"
echo "   - Docker network hostnames (no localhost issues)"
echo "   - JWT authentication for protected endpoints"
echo "   - Proper accepted status codes (200-299, 401)"
echo "   - 60-second check intervals"
echo ""
