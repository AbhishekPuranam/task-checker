#!/bin/bash

##############################################
# File System Restore Script
# Restores uploads and configuration files
##############################################

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups/files"
UPLOADS_DIR="${PROJECT_ROOT}/uploads"
LOGS_DIR="${PROJECT_ROOT}/logs"

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
list_backups() {
    log_info "Available file backups:"
    if [ ! -d "$BACKUP_DIR" ] || [ ! "$(ls -A $BACKUP_DIR/*.tar.gz 2>/dev/null)" ]; then
        log_error "No backups found in $BACKUP_DIR"
        exit 1
    fi
    
    local i=1
    for backup in "$BACKUP_DIR"/files_backup_*.tar.gz; do
        local size=$(du -sh "$backup" | cut -f1)
        local date=$(echo "$backup" | grep -o '[0-9]\{8\}_[0-9]\{6\}' | sed 's/_/ /')
        echo "  [$i] $(basename "$backup") - Size: $size - Date: $date"
        ((i++))
    done
}

# Get backup path by selection
get_backup_path() {
    local selection=$1
    
    # If selection is a number
    if [[ "$selection" =~ ^[0-9]+$ ]]; then
        local backups=("$BACKUP_DIR"/files_backup_*.tar.gz)
        local index=$((selection - 1))
        
        if [ $index -ge 0 ] && [ $index -lt ${#backups[@]} ]; then
            echo "${backups[$index]}"
        else
            log_error "Invalid backup number"
            exit 1
        fi
    # If selection is a filename
    elif [ -f "$BACKUP_DIR/$selection" ]; then
        echo "$BACKUP_DIR/$selection"
    elif [ -f "$selection" ]; then
        echo "$selection"
    else
        log_error "Backup not found: $selection"
        exit 1
    fi
}

# Extract backup
extract_backup() {
    local backup_path=$1
    local temp_dir=$(mktemp -d)
    
    log_info "Extracting backup: $(basename "$backup_path")"
    tar -xzf "$backup_path" -C "$temp_dir"
    
    echo "$temp_dir"
}

# Restore uploads
restore_uploads() {
    local backup_extracted=$1
    local upload_backup="${backup_extracted}/files_backup_*/uploads"
    
    if [ -d $upload_backup ]; then
        log_warning "This will replace all files in $UPLOADS_DIR"
        read -p "Continue? (yes/no): " confirm
        
        if [ "$confirm" = "yes" ]; then
            # Create backup of current uploads
            if [ -d "$UPLOADS_DIR" ]; then
                local current_backup="${UPLOADS_DIR}_pre_restore_$(date +%Y%m%d_%H%M%S)"
                log_info "Creating backup of current uploads: $current_backup"
                cp -r "$UPLOADS_DIR" "$current_backup"
            fi
            
            # Restore uploads
            log_info "Restoring uploads directory..."
            mkdir -p "$UPLOADS_DIR"
            cp -r $upload_backup/* "$UPLOADS_DIR/"
            log_success "Uploads restored successfully"
        else
            log_info "Skipping uploads restore"
        fi
    else
        log_warning "No uploads found in backup"
    fi
}

# Restore logs
restore_logs() {
    local backup_extracted=$1
    local logs_backup="${backup_extracted}/files_backup_*/logs"
    
    if [ -d $logs_backup ]; then
        read -p "Restore logs? (yes/no): " confirm
        
        if [ "$confirm" = "yes" ]; then
            log_info "Restoring logs..."
            mkdir -p "$LOGS_DIR"
            cp -r $logs_backup/* "$LOGS_DIR/" 2>/dev/null || log_warning "No logs to restore"
            log_success "Logs restored successfully"
        else
            log_info "Skipping logs restore"
        fi
    else
        log_warning "No logs found in backup"
    fi
}

# Restore config files
restore_config() {
    local backup_extracted=$1
    local config_backup="${backup_extracted}/files_backup_*/config"
    
    if [ -d $config_backup ]; then
        log_warning "This will overwrite existing configuration files"
        read -p "Restore configuration files? (yes/no): " confirm
        
        if [ "$confirm" = "yes" ]; then
            log_info "Restoring configuration files..."
            
            # Restore .env if exists
            if [ -f "$config_backup/.env" ]; then
                read -p "  Restore .env? (yes/no): " env_confirm
                if [ "$env_confirm" = "yes" ]; then
                    cp "$config_backup/.env" "$PROJECT_ROOT/.env"
                    log_success "  ✓ .env restored"
                fi
            fi
            
            # Restore docker-compose files
            if [ -f "$config_backup/docker-compose.dev.yml" ]; then
                read -p "  Restore docker-compose.dev.yml? (yes/no): " compose_confirm
                if [ "$compose_confirm" = "yes" ]; then
                    cp "$config_backup/docker-compose.dev.yml" "$PROJECT_ROOT/infrastructure/docker/"
                    log_success "  ✓ docker-compose.dev.yml restored"
                fi
            fi
            
            if [ -f "$config_backup/docker-compose.yml" ]; then
                read -p "  Restore docker-compose.yml? (yes/no): " compose_confirm
                if [ "$compose_confirm" = "yes" ]; then
                    cp "$config_backup/docker-compose.yml" "$PROJECT_ROOT/infrastructure/docker/"
                    log_success "  ✓ docker-compose.yml restored"
                fi
            fi
        else
            log_info "Skipping configuration files restore"
        fi
    else
        log_warning "No configuration files found in backup"
    fi
}

# Show backup metadata
show_metadata() {
    local backup_extracted=$1
    local metadata_file="${backup_extracted}/files_backup_*/backup_metadata.txt"
    
    if [ -f $metadata_file ]; then
        echo ""
        log_info "Backup Metadata:"
        cat $metadata_file
        echo ""
    fi
}

# Main execution
main() {
    log_info "=== File System Restore Script ==="
    echo ""
    
    # List available backups
    list_backups
    echo ""
    
    # Get user selection
    read -p "Enter backup number or filename to restore: " selection
    
    if [ -z "$selection" ]; then
        log_error "No backup selected"
        exit 1
    fi
    
    # Get backup path
    local backup_path=$(get_backup_path "$selection")
    
    # Extract backup
    local temp_dir=$(extract_backup "$backup_path")
    
    # Show metadata
    show_metadata "$temp_dir"
    
    # Confirm restore
    echo ""
    log_warning "=== WARNING ==="
    log_warning "This will restore files from: $(basename "$backup_path")"
    log_warning "Existing files may be overwritten!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " final_confirm
    
    if [ "$final_confirm" != "yes" ]; then
        log_info "Restore cancelled"
        rm -rf "$temp_dir"
        exit 0
    fi
    
    # Restore components
    echo ""
    restore_uploads "$temp_dir"
    restore_logs "$temp_dir"
    restore_config "$temp_dir"
    
    # Cleanup
    log_info "Cleaning up temporary files..."
    rm -rf "$temp_dir"
    
    echo ""
    log_success "File restore process completed!"
}

# Run main function
main "$@"
