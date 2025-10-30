#!/bin/bash

##############################################
# MongoDB Restore Script
# Restores database from backup
##############################################

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups/mongodb"

# MongoDB Configuration
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

# List available backups
list_available_backups() {
    log_info "Available backups:"
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        log_error "No backups found in $BACKUP_DIR"
        exit 1
    fi
    
    local index=1
    ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | while read -r backup; do
        local size=$(du -sh "$backup" | cut -f1)
        local date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$backup" 2>/dev/null || stat -c "%y" "$backup" | cut -d' ' -f1-2)
        echo "  $index. $(basename "$backup") - $size - $date"
        ((index++))
    done
}

# Select backup
select_backup() {
    if [ -n "$1" ]; then
        # Backup file provided as argument
        if [ -f "$1" ]; then
            SELECTED_BACKUP="$1"
        elif [ -f "$BACKUP_DIR/$1" ]; then
            SELECTED_BACKUP="$BACKUP_DIR/$1"
        else
            log_error "Backup file not found: $1"
            exit 1
        fi
    else
        # Interactive selection
        list_available_backups
        echo ""
        read -p "Enter the number or filename of the backup to restore: " selection
        
        if [[ "$selection" =~ ^[0-9]+$ ]]; then
            # Numeric selection
            SELECTED_BACKUP=$(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | sed -n "${selection}p")
        else
            # Filename selection
            if [ -f "$BACKUP_DIR/$selection" ]; then
                SELECTED_BACKUP="$BACKUP_DIR/$selection"
            else
                log_error "Invalid selection"
                exit 1
            fi
        fi
    fi
    
    if [ -z "$SELECTED_BACKUP" ] || [ ! -f "$SELECTED_BACKUP" ]; then
        log_error "Invalid backup selection"
        exit 1
    fi
    
    log_info "Selected backup: $(basename "$SELECTED_BACKUP")"
}

# Confirm restore
confirm_restore() {
    log_warning "This will REPLACE all data in database: $MONGO_DB"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
}

# Extract backup
extract_backup() {
    local temp_dir="/tmp/restore_$(date +%s)"
    mkdir -p "$temp_dir"
    
    log_info "Extracting backup to $temp_dir..."
    tar -xzf "$SELECTED_BACKUP" -C "$temp_dir" || {
        log_error "Failed to extract backup"
        rm -rf "$temp_dir"
        exit 1
    }
    
    # Find the extracted directory
    EXTRACTED_DIR=$(find "$temp_dir" -maxdepth 1 -type d -name "tasktracker_backup_*" | head -n 1)
    
    if [ -z "$EXTRACTED_DIR" ]; then
        log_error "Could not find extracted backup directory"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    echo "$EXTRACTED_DIR"
}

# Restore MongoDB
restore_mongodb() {
    local extracted_dir="$1"
    
    log_info "Starting MongoDB restore..."
    log_info "Database: $MONGO_DB"
    log_info "Source: $extracted_dir"
    
    if [ "$USE_DOCKER" = "true" ]; then
        log_info "Using Docker container: $DOCKER_CONTAINER"
        
        # Check if container exists and is running
        if ! docker ps | grep -q "$DOCKER_CONTAINER"; then
            log_error "Docker container '$DOCKER_CONTAINER' is not running"
            return 1
        fi
        
        # Copy backup to container
        docker cp "$extracted_dir" "${DOCKER_CONTAINER}:/tmp/"
        
        # Perform restore using docker exec
        local backup_name=$(basename "$extracted_dir")
        docker exec "$DOCKER_CONTAINER" mongorestore \
            --db="$MONGO_DB" \
            --drop \
            --gzip \
            "/tmp/${backup_name}/${MONGO_DB}" \
            2>&1 || {
                log_error "MongoDB restore failed"
                docker exec "$DOCKER_CONTAINER" rm -rf "/tmp/${backup_name}"
                return 1
            }
        
        # Cleanup
        docker exec "$DOCKER_CONTAINER" rm -rf "/tmp/${backup_name}"
        
    else
        # Direct restore (non-Docker)
        mongorestore \
            --host="$MONGO_HOST" \
            --port="$MONGO_PORT" \
            --db="$MONGO_DB" \
            --username="$MONGO_USER" \
            --password="$MONGO_PASSWORD" \
            --authenticationDatabase="$MONGO_AUTH_DB" \
            --drop \
            --gzip \
            "${extracted_dir}/${MONGO_DB}" \
            2>&1 || {
                log_error "MongoDB restore failed"
                return 1
            }
    fi
    
    log_success "Database restored successfully!"
}

# Cleanup temporary files
cleanup() {
    if [ -n "$1" ] && [ -d "$1" ]; then
        log_info "Cleaning up temporary files..."
        rm -rf "$(dirname "$1")"
    fi
}

# Main execution
main() {
    log_info "=== MongoDB Restore Script ==="
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    select_backup "$1"
    confirm_restore
    
    extracted_dir=$(extract_backup)
    restore_mongodb "$extracted_dir"
    cleanup "$extracted_dir"
    
    echo ""
    log_success "Restore process completed successfully!"
    log_info "Please restart your application to ensure all connections are refreshed"
}

# Run main function
main "$@"
