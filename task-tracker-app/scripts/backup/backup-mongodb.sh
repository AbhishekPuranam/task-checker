#!/bin/bash

##############################################
# MongoDB Backup Script
# Creates timestamped backups of the database
##############################################

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups/mongodb"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="tasktracker_backup_${TIMESTAMP}"
RETENTION_DAYS=${RETENTION_DAYS:-7}  # Keep backups for 7 days by default

# MongoDB Configuration (from environment or defaults)
MONGO_HOST=${MONGO_HOST:-"localhost"}
MONGO_PORT=${MONGO_PORT:-"27017"}
MONGO_DB=${MONGO_DB:-"tasktracker"}
MONGO_USER=${MONGO_USER:-"admin"}
MONGO_PASSWORD=${MONGO_PASSWORD:-"password123"}
MONGO_AUTH_DB=${MONGO_AUTH_DB:-"admin"}

# Docker Configuration
DOCKER_CONTAINER=${DOCKER_CONTAINER:-"tasktracker-dev-mongodb"}
USE_DOCKER=${USE_DOCKER:-"true"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory if it doesn't exist
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Perform MongoDB backup
backup_mongodb() {
    local backup_path="${BACKUP_DIR}/${BACKUP_NAME}"
    
    log_info "Starting MongoDB backup..."
    log_info "Database: $MONGO_DB"
    log_info "Backup path: $backup_path"
    
    if [ "$USE_DOCKER" = "true" ]; then
        log_info "Using Docker container: $DOCKER_CONTAINER"
        
        # Check if container exists and is running
        if ! docker ps | grep -q "$DOCKER_CONTAINER"; then
            log_error "Docker container '$DOCKER_CONTAINER' is not running"
            return 1
        fi
        
        # Perform backup using docker exec
        docker exec "$DOCKER_CONTAINER" mongodump \
            --db="$MONGO_DB" \
            --out="/tmp/${BACKUP_NAME}" \
            --gzip \
            2>&1 || {
                log_error "MongoDB backup failed"
                return 1
            }
        
        # Copy backup from container to host
        docker cp "${DOCKER_CONTAINER}:/tmp/${BACKUP_NAME}" "$backup_path"
        
        # Cleanup backup from container
        docker exec "$DOCKER_CONTAINER" rm -rf "/tmp/${BACKUP_NAME}"
        
    else
        # Direct backup (non-Docker)
        mongodump \
            --host="$MONGO_HOST" \
            --port="$MONGO_PORT" \
            --db="$MONGO_DB" \
            --username="$MONGO_USER" \
            --password="$MONGO_PASSWORD" \
            --authenticationDatabase="$MONGO_AUTH_DB" \
            --out="$backup_path" \
            --gzip \
            2>&1 || {
                log_error "MongoDB backup failed"
                return 1
            }
    fi
    
    # Get backup size
    local backup_size=$(du -sh "$backup_path" | cut -f1)
    log_success "Backup created successfully: $backup_path ($backup_size)"
    
    # Create compressed archive
    log_info "Creating compressed archive..."
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}" 2>&1 && {
        rm -rf "${BACKUP_NAME}"
        local archive_size=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
        log_success "Compressed archive created: ${BACKUP_NAME}.tar.gz ($archive_size)"
    } || {
        log_warning "Failed to create compressed archive, keeping uncompressed backup"
    }
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted_count=0
    find "$BACKUP_DIR" -name "tasktracker_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -print | while read -r backup; do
        log_info "Deleting old backup: $(basename "$backup")"
        rm -f "$backup"
        ((deleted_count++)) || true
    done
    
    if [ $deleted_count -eq 0 ]; then
        log_info "No old backups to delete"
    else
        log_success "Deleted $deleted_count old backup(s)"
    fi
}

# List existing backups
list_backups() {
    log_info "Existing backups in $BACKUP_DIR:"
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR)" ]; then
        ls -lh "$BACKUP_DIR" | grep -E "\.tar\.gz$|^d" | awk '{print $9, "(" $5 ")"}'
    else
        log_info "No backups found"
    fi
}

# Main execution
main() {
    log_info "=== MongoDB Backup Script ==="
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    create_backup_dir
    backup_mongodb
    cleanup_old_backups
    
    echo ""
    list_backups
    echo ""
    log_success "Backup process completed successfully!"
}

# Run main function
main "$@"
