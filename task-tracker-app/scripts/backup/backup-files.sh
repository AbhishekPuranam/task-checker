#!/bin/bash

##############################################
# File System Backup Script
# Backs up uploads and configuration files
##############################################

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups/files"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="files_backup_${TIMESTAMP}"
RETENTION_DAYS=${RETENTION_DAYS:-30}  # Keep file backups for 30 days

# Directories to backup
UPLOADS_DIR="${PROJECT_ROOT}/uploads"
LOGS_DIR="${PROJECT_ROOT}/logs"
CONFIG_FILES=(
    "${PROJECT_ROOT}/.env"
    "${PROJECT_ROOT}/infrastructure/docker/docker-compose.dev.yml"
    "${PROJECT_ROOT}/infrastructure/docker/docker-compose.yml"
)

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

# Create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Backup files
backup_files() {
    local backup_path="${BACKUP_DIR}/${BACKUP_NAME}"
    mkdir -p "$backup_path"
    
    log_info "Starting file system backup..."
    
    # Backup uploads directory
    if [ -d "$UPLOADS_DIR" ]; then
        log_info "Backing up uploads directory..."
        mkdir -p "${backup_path}/uploads"
        cp -r "$UPLOADS_DIR"/* "${backup_path}/uploads/" 2>/dev/null || log_warning "No files in uploads directory"
    else
        log_warning "Uploads directory not found: $UPLOADS_DIR"
    fi
    
    # Backup logs directory (last 7 days only)
    if [ -d "$LOGS_DIR" ]; then
        log_info "Backing up recent logs..."
        mkdir -p "${backup_path}/logs"
        find "$LOGS_DIR" -type f -mtime -7 -exec cp {} "${backup_path}/logs/" \; 2>/dev/null || log_warning "No recent logs found"
    fi
    
    # Backup configuration files
    log_info "Backing up configuration files..."
    mkdir -p "${backup_path}/config"
    for config_file in "${CONFIG_FILES[@]}"; do
        if [ -f "$config_file" ]; then
            cp "$config_file" "${backup_path}/config/" 2>/dev/null && \
                log_info "  ✓ $(basename "$config_file")" || \
                log_warning "  ✗ Failed to backup $(basename "$config_file")"
        fi
    done
    
    # Create metadata file
    cat > "${backup_path}/backup_metadata.txt" << EOF
Backup Created: $(date '+%Y-%m-%d %H:%M:%S')
Hostname: $(hostname)
User: $(whoami)
Project Root: $PROJECT_ROOT

Directories Backed Up:
- Uploads: $UPLOADS_DIR
- Logs: $LOGS_DIR (last 7 days)

Configuration Files:
$(printf '%s\n' "${CONFIG_FILES[@]}")
EOF
    
    # Create compressed archive
    log_info "Creating compressed archive..."
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}" 2>&1 && {
        rm -rf "${BACKUP_NAME}"
        local archive_size=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
        log_success "Compressed archive created: ${BACKUP_NAME}.tar.gz ($archive_size)"
    } || {
        log_warning "Failed to create compressed archive"
    }
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up file backups older than $RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -name "files_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null
    log_success "Old backups cleaned up"
}

# List existing backups
list_backups() {
    log_info "Existing file backups:"
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null | awk '{print $9, "(" $5 ")"}' || log_info "No backups found"
    else
        log_info "No backups found"
    fi
}

# Main execution
main() {
    log_info "=== File System Backup Script ==="
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    create_backup_dir
    backup_files
    cleanup_old_backups
    
    echo ""
    list_backups
    echo ""
    log_success "File backup process completed successfully!"
}

# Run main function
main "$@"
