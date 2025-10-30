#!/bin/bash

##############################################
# Backup Verification Script
# Tests backup integrity and restoration
##############################################

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MONGO_BACKUP_DIR="${PROJECT_ROOT}/backups/mongodb"
FILES_BACKUP_DIR="${PROJECT_ROOT}/backups/files"
TEST_RESTORE_DIR=$(mktemp -d)

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

# Verify MongoDB backup
verify_mongodb_backup() {
    log_info "Verifying MongoDB backups..."
    
    if [ ! -d "$MONGO_BACKUP_DIR" ] || [ ! "$(ls -A $MONGO_BACKUP_DIR/*.tar.gz 2>/dev/null)" ]; then
        log_error "No MongoDB backups found!"
        return 1
    fi
    
    # Get most recent backup
    local latest_backup=$(ls -t "$MONGO_BACKUP_DIR"/*.tar.gz | head -1)
    log_info "Testing latest MongoDB backup: $(basename "$latest_backup")"
    
    # Extract backup
    local mongo_test_dir="${TEST_RESTORE_DIR}/mongodb_test"
    mkdir -p "$mongo_test_dir"
    tar -xzf "$latest_backup" -C "$mongo_test_dir"
    
    # Check if extracted successfully
    if [ -d "$mongo_test_dir" ] && [ "$(ls -A $mongo_test_dir)" ]; then
        log_success "✓ MongoDB backup extraction successful"
        
        # Check for BSON files (mongodump output)
        local bson_count=$(find "$mongo_test_dir" -name "*.bson" | wc -l)
        log_info "  Found $bson_count BSON files"
        
        if [ $bson_count -gt 0 ]; then
            log_success "✓ MongoDB backup contains valid database dumps"
            return 0
        else
            log_error "✗ MongoDB backup missing BSON files"
            return 1
        fi
    else
        log_error "✗ MongoDB backup extraction failed"
        return 1
    fi
}

# Verify file system backup
verify_files_backup() {
    log_info "Verifying file system backups..."
    
    if [ ! -d "$FILES_BACKUP_DIR" ] || [ ! "$(ls -A $FILES_BACKUP_DIR/*.tar.gz 2>/dev/null)" ]; then
        log_error "No file system backups found!"
        return 1
    fi
    
    # Get most recent backup
    local latest_backup=$(ls -t "$FILES_BACKUP_DIR"/*.tar.gz | head -1)
    log_info "Testing latest file backup: $(basename "$latest_backup")"
    
    # Extract backup
    local files_test_dir="${TEST_RESTORE_DIR}/files_test"
    mkdir -p "$files_test_dir"
    tar -xzf "$latest_backup" -C "$files_test_dir"
    
    # Check if extracted successfully
    if [ -d "$files_test_dir" ] && [ "$(ls -A $files_test_dir)" ]; then
        log_success "✓ File backup extraction successful"
        
        # Check for expected directories
        local has_uploads=false
        local has_config=false
        
        if [ -d "$files_test_dir"/files_backup_*/uploads ]; then
            has_uploads=true
            local upload_count=$(find "$files_test_dir"/files_backup_*/uploads -type f | wc -l)
            log_info "  Found $upload_count files in uploads backup"
        fi
        
        if [ -d "$files_test_dir"/files_backup_*/config ]; then
            has_config=true
            local config_count=$(find "$files_test_dir"/files_backup_*/config -type f | wc -l)
            log_info "  Found $config_count configuration files"
        fi
        
        if [ "$has_uploads" = true ] || [ "$has_config" = true ]; then
            log_success "✓ File backup contains expected data"
            return 0
        else
            log_warning "⚠ File backup exists but may be empty"
            return 0
        fi
    else
        log_error "✗ File backup extraction failed"
        return 1
    fi
}

# Check backup age
check_backup_age() {
    log_info "Checking backup recency..."
    
    # Check MongoDB backup age
    if [ -d "$MONGO_BACKUP_DIR" ]; then
        local latest_mongo=$(ls -t "$MONGO_BACKUP_DIR"/*.tar.gz 2>/dev/null | head -1)
        if [ -n "$latest_mongo" ]; then
            local mongo_age_hours=$(( ($(date +%s) - $(stat -f %m "$latest_mongo")) / 3600 ))
            log_info "Latest MongoDB backup is $mongo_age_hours hours old"
            
            if [ $mongo_age_hours -gt 48 ]; then
                log_warning "⚠ MongoDB backup is older than 48 hours!"
            else
                log_success "✓ MongoDB backup is recent"
            fi
        fi
    fi
    
    # Check file backup age
    if [ -d "$FILES_BACKUP_DIR" ]; then
        local latest_files=$(ls -t "$FILES_BACKUP_DIR"/*.tar.gz 2>/dev/null | head -1)
        if [ -n "$latest_files" ]; then
            local files_age_hours=$(( ($(date +%s) - $(stat -f %m "$latest_files")) / 3600 ))
            log_info "Latest file backup is $files_age_hours hours old"
            
            if [ $files_age_hours -gt 48 ]; then
                log_warning "⚠ File backup is older than 48 hours!"
            else
                log_success "✓ File backup is recent"
            fi
        fi
    fi
}

# Check disk space
check_disk_space() {
    log_info "Checking backup disk usage..."
    
    if [ -d "$MONGO_BACKUP_DIR" ]; then
        local mongo_size=$(du -sh "$MONGO_BACKUP_DIR" | cut -f1)
        log_info "MongoDB backups: $mongo_size"
    fi
    
    if [ -d "$FILES_BACKUP_DIR" ]; then
        local files_size=$(du -sh "$FILES_BACKUP_DIR" | cut -f1)
        log_info "File backups: $files_size"
    fi
    
    local total_backups_size=$(du -sh "${PROJECT_ROOT}/backups" | cut -f1)
    log_info "Total backups size: $total_backups_size"
    
    # Check available disk space
    local available_space=$(df -h "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
    log_info "Available disk space: $available_space"
}

# Generate report
generate_report() {
    local mongo_status=$1
    local files_status=$2
    
    echo ""
    log_info "=== Backup Verification Summary ==="
    echo ""
    
    if [ $mongo_status -eq 0 ]; then
        log_success "MongoDB Backup: PASSED"
    else
        log_error "MongoDB Backup: FAILED"
    fi
    
    if [ $files_status -eq 0 ]; then
        log_success "File Backup: PASSED"
    else
        log_error "File Backup: FAILED"
    fi
    
    echo ""
    
    if [ $mongo_status -eq 0 ] && [ $files_status -eq 0 ]; then
        log_success "All backup verifications passed!"
        return 0
    else
        log_error "Some backup verifications failed!"
        return 1
    fi
}

# Cleanup
cleanup() {
    log_info "Cleaning up test files..."
    rm -rf "$TEST_RESTORE_DIR"
}

# Main execution
main() {
    log_info "=== Backup Verification Script ==="
    log_info "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Run verifications
    verify_mongodb_backup
    local mongo_status=$?
    
    echo ""
    
    verify_files_backup
    local files_status=$?
    
    echo ""
    
    check_backup_age
    echo ""
    
    check_disk_space
    
    # Generate report
    generate_report $mongo_status $files_status
    local report_status=$?
    
    # Cleanup
    cleanup
    
    log_info "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
    
    exit $report_status
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"
