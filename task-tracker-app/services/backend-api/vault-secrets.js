const fs = require('fs');
const https = require('https');
const http = require('http');

/**
 * Vault Secret Manager
 * Fetches secrets from HashiCorp Vault or falls back to Docker secrets/environment variables
 */
class VaultSecretManager {
  constructor() {
    this.vaultAddr = process.env.VAULT_ADDR || 'http://vault:8200';
    this.vaultToken = this.loadVaultToken();
    this.secretCache = {};
  }

  /**
   * Load Vault token from file or environment
   */
  loadVaultToken() {
    const tokenFile = process.env.VAULT_TOKEN_FILE || '/run/secrets/vault_token';
    
    try {
      if (fs.existsSync(tokenFile)) {
        return fs.readFileSync(tokenFile, 'utf8').trim();
      }
    } catch (err) {
      console.warn('Could not read Vault token file:', err.message);
    }
    
    return process.env.VAULT_TOKEN || null;
  }

  /**
   * Read secret from Docker secrets file
   */
  readDockerSecret(secretName) {
    const secretPath = `/run/secrets/${secretName}`;
    
    try {
      if (fs.existsSync(secretPath)) {
        return fs.readFileSync(secretPath, 'utf8').trim();
      }
    } catch (err) {
      console.warn(`Could not read Docker secret ${secretName}:`, err.message);
    }
    
    return null;
  }

  /**
   * Fetch secret from Vault
   */
  async fetchFromVault(path) {
    return new Promise((resolve, reject) => {
      if (!this.vaultToken) {
        return reject(new Error('Vault token not available'));
      }

      const url = new URL(`${this.vaultAddr}/v1/secret/data/${path}`);
      const httpModule = url.protocol === 'https:' ? https : http;

      const options = {
        method: 'GET',
        headers: {
          'X-Vault-Token': this.vaultToken
        }
      };

      const req = httpModule.request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(data);
              resolve(response.data.data);
            } catch (err) {
              reject(new Error('Failed to parse Vault response'));
            }
          } else {
            reject(new Error(`Vault returned status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  /**
   * Get secret with fallback mechanism
   * Priority: 1) Vault, 2) Docker Secret, 3) Environment Variable
   */
  async getSecret(secretName, vaultPath = null) {
    // Check cache first
    if (this.secretCache[secretName]) {
      return this.secretCache[secretName];
    }

    let value = null;

    // Try Vault first
    if (vaultPath && this.vaultToken) {
      try {
        const secrets = await this.fetchFromVault(vaultPath);
        value = secrets[secretName];
        if (value) {
          console.log(`✓ Loaded ${secretName} from Vault`);
          this.secretCache[secretName] = value;
          return value;
        }
      } catch (err) {
        console.warn(`Could not fetch from Vault: ${err.message}`);
      }
    }

    // Fallback to Docker secret
    value = this.readDockerSecret(secretName);
    if (value) {
      console.log(`✓ Loaded ${secretName} from Docker secret`);
      this.secretCache[secretName] = value;
      return value;
    }

    // Fallback to environment variable
    const envVarName = secretName.toUpperCase();
    value = process.env[envVarName];
    if (value) {
      console.log(`✓ Loaded ${secretName} from environment variable`);
      this.secretCache[secretName] = value;
      return value;
    }

    throw new Error(`Secret ${secretName} not found in Vault, Docker secrets, or environment`);
  }

  /**
   * Load all application secrets
   */
  async loadAllSecrets() {
    const secrets = {};

    try {
      // Load database secrets
      secrets.MONGODB_PASSWORD = await this.getSecret(
        'mongodb_password',
        'projecttracker/database'
      );
      secrets.REDIS_PASSWORD = await this.getSecret(
        'redis_password',
        'projecttracker/database'
      );

      // Load application secrets
      secrets.JWT_SECRET = await this.getSecret(
        'jwt_secret',
        'projecttracker/app'
      );
      secrets.SESSION_SECRET = await this.getSecret(
        'session_secret',
        'projecttracker/app'
      );

      // Load app config
      const appConfig = await this.fetchFromVault('projecttracker/app').catch(() => ({}));
      secrets.DOMAIN = appConfig.domain || process.env.DOMAIN;
      secrets.ADMIN_EMAIL = appConfig.admin_email || process.env.ADMIN_EMAIL;

      console.log('✓ All secrets loaded successfully');
      return secrets;
    } catch (err) {
      console.error('Error loading secrets:', err.message);
      throw err;
    }
  }

  /**
   * Build MongoDB connection URI with secrets
   */
  async getMongoDBUri() {
    const password = await this.getSecret('mongodb_password', 'projecttracker/database');
    const host = process.env.MONGODB_HOST || 'mongodb';
    const port = process.env.MONGODB_PORT || '27017';
    const database = process.env.MONGODB_DATABASE || 'tasktracker';
    
    return `mongodb://admin:${password}@${host}:${port}/${database}?authSource=admin`;
  }

  /**
   * Build Redis connection URI with secrets
   */
  async getRedisUri() {
    const password = await this.getSecret('redis_password', 'projecttracker/database');
    const host = process.env.REDIS_HOST || 'redis';
    const port = process.env.REDIS_PORT || '6379';
    
    return `redis://:${password}@${host}:${port}`;
  }
}

// Export singleton instance
module.exports = new VaultSecretManager();
