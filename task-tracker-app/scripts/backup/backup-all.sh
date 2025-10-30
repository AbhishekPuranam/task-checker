#!/bin/bash

##############################################
# Complete Backup Script
# Runs both MongoDB and file system backups
##############################################

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Main execution
main() {
    log_info "=== Complete Backup Process ==="
    log_info "Starting at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Run MongoDB backup
    log_info "Step 1: Backing up MongoDB database..."
    if "$SCRIPT_DIR/backup-mongodb.sh"; then
        log_success "MongoDB backup completed"
    else
        log_error "MongoDB backup failed!"
        exit 1
    fi
    
    echo ""
    echo "=========================================="
    echo ""
    
    # Run file system backup
    log_info "Step 2: Backing up files..."
    if "$SCRIPT_DIR/backup-files.sh"; then
        log_success "File backup completed"
    else
        log_error "File backup failed!"
        exit 1
    fi
    
    echo ""
    echo "=========================================="
    echo ""
    log_success "Complete backup process finished successfully!"
    log_info "Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
}

# Run main function
main "$@"
