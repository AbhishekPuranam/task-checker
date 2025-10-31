# Vault Configuration File for Production

ui = true

storage "file" {
  path = "/vault/file"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1  # TLS handled by Traefik
}

# API address
api_addr = "http://0.0.0.0:8200"

# Disable mlock in containerized environments
disable_mlock = true

# Enable audit logging
# audit "file" {
#   file_path = "/vault/logs/audit.log"
# }
