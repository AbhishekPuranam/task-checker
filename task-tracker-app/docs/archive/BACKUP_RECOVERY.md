# Backup and Recovery System

## Overview

This document describes the complete backup and recovery system for the Task Tracker application. The system provides automated backups of both MongoDB databases and file uploads, with verification and restoration capabilities.

## Components

### Backup Scripts

1. **`scripts/backup/backup-mongodb.sh`**
   - Backs up MongoDB database using mongodump
   - Supports both Docker and non-Docker deployments
   - Creates compressed tar.gz archives
   - Automatic retention management (7 days default)
   - Location: `backups/mongodb/`

2. **`scripts/backup/backup-files.sh`**
   - Backs up uploads directory (avatars, Excel files)
   - Backs up recent logs (last 7 days)
   - Backs up configuration files (.env, docker-compose files)
   - Creates compressed tar.gz archives
   - Automatic retention management (30 days default)
   - Location: `backups/files/`

3. **`scripts/backup/backup-all.sh`**
   - Runs both MongoDB and file backups sequentially
   - Recommended for automated scheduled backups
   - Provides consolidated logging

### Restore Scripts

1. **`scripts/backup/restore-mongodb.sh`**
   - Interactive MongoDB database restoration
   - Lists available backups with timestamps and sizes
   - Safety confirmations before restore
   - Uses `--drop` flag to replace existing data
   - Supports Docker and non-Docker environments

2. **`scripts/backup/restore-files.sh`**
   - Interactive file system restoration
   - Separate confirmations for uploads, logs, and config files
   - Creates pre-restore backup of current uploads
   - Shows backup metadata before restore

### Verification Script

1. **`scripts/backup/verify-backup.sh`**
   - Tests backup integrity by extracting and validating archives
   - Checks backup age (warns if older than 48 hours)
   - Reports disk usage for backup directories
   - Generates pass/fail summary report
   - Recommended for weekly automated verification

## Production Deployment

### Prerequisites

1. **Ensure scripts are executable:**
   ```bash
   chmod +x scripts/backup/*.sh
   ```

2. **Create backup directories:**
   ```bash
   mkdir -p backups/mongodb backups/files logs
   ```

3. **Verify environment variables:**
   - MongoDB connection details in `.env` or script defaults
   - Docker container name (if using Docker): `tasktracker-dev-mongodb`

### Configuration

#### MongoDB Backup Configuration

Edit `scripts/backup/backup-mongodb.sh` if needed:

```bash
# MongoDB Configuration
MONGO_HOST=${MONGO_HOST:-"localhost"}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_DB=${MONGO_DB:-"task-tracker"}

# Docker Configuration
USE_DOCKER=${USE_DOCKER:-"true"}
DOCKER_CONTAINER="tasktracker-dev-mongodb"

# Retention (days to keep backups)
RETENTION_DAYS=${RETENTION_DAYS:-7}
```

#### File Backup Configuration

Edit `scripts/backup/backup-files.sh` if needed:

```bash
# Retention (days to keep backups)
RETENTION_DAYS=${RETENTION_DAYS:-30}

# Additional directories to backup (optional)
# Add custom paths to CONFIG_FILES array
```

### Setting Up Automated Backups

#### Option 1: Cron Job (Recommended for Linux/macOS)

1. **Edit crontab:**
   ```bash
   crontab -e
   ```

2. **Add the following line for daily 2 AM backups:**
   ```cron
   0 2 * * * /Users/apuranam/Documents/GitHub/task-checker/task-tracker-app/scripts/backup/backup-all.sh >> /Users/apuranam/Documents/GitHub/task-checker/task-tracker-app/logs/backup.log 2>&1
   ```

3. **Add weekly verification on Sundays at 3 AM:**
   ```cron
   0 3 * * 0 /Users/apuranam/Documents/GitHub/task-checker/task-tracker-app/scripts/backup/verify-backup.sh >> /Users/apuranam/Documents/GitHub/task-checker/task-tracker-app/logs/backup-verify.log 2>&1
   ```

4. **Verify cron job is installed:**
   ```bash
   crontab -l
   ```

**Note:** Update the absolute paths in the cron commands to match your production server's actual project location.

#### Option 2: Systemd Timer (Linux Alternative)

Create `/etc/systemd/system/tasktracker-backup.service`:

```ini
[Unit]
Description=Task Tracker Backup Service
After=network.target

[Service]
Type=oneshot
User=your-production-user
WorkingDirectory=/path/to/task-tracker-app
ExecStart=/path/to/task-tracker-app/scripts/backup/backup-all.sh
StandardOutput=append:/path/to/task-tracker-app/logs/backup.log
StandardError=append:/path/to/task-tracker-app/logs/backup.log
```

Create `/etc/systemd/system/tasktracker-backup.timer`:

```ini
[Unit]
Description=Task Tracker Daily Backup Timer

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start the timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tasktracker-backup.timer
sudo systemctl start tasktracker-backup.timer
sudo systemctl status tasktracker-backup.timer
```

## Manual Backup Procedures

### Create Manual Backup

Run complete backup (MongoDB + files):
```bash
cd /path/to/task-tracker-app
./scripts/backup/backup-all.sh
```

Or run individual backups:
```bash
# MongoDB only
./scripts/backup/backup-mongodb.sh

# Files only
./scripts/backup/backup-files.sh
```

### List Available Backups

MongoDB backups:
```bash
ls -lh backups/mongodb/
```

File backups:
```bash
ls -lh backups/files/
```

### Verify Backup Integrity

```bash
./scripts/backup/verify-backup.sh
```

This will:
- Extract and validate latest backups
- Check backup age
- Report disk usage
- Generate pass/fail summary

## Disaster Recovery Procedures

### Full System Restore

#### Step 1: Restore MongoDB Database

1. **Run restore script:**
   ```bash
   cd /path/to/task-tracker-app
   ./scripts/backup/restore-mongodb.sh
   ```

2. **Select backup:**
   - Script will list available backups with dates
   - Enter backup number or filename
   - Confirm restoration when prompted

3. **Verify restoration:**
   ```bash
   # If using Docker:
   docker exec tasktracker-dev-mongodb mongosh task-tracker --eval "db.users.countDocuments()"
   
   # If using local MongoDB:
   mongosh task-tracker --eval "db.users.countDocuments()"
   ```

#### Step 2: Restore Files

1. **Run file restore script:**
   ```bash
   ./scripts/backup/restore-files.sh
   ```

2. **Select components to restore:**
   - Uploads directory (avatars, Excel files)
   - Logs (optional)
   - Configuration files (be careful - may overwrite current settings)

3. **Verify file restoration:**
   ```bash
   ls -lh uploads/avatars/
   ls -lh uploads/excel/
   ```

#### Step 3: Restart Services

If using Docker:
```bash
cd infrastructure/docker
docker-compose -f docker-compose.dev.yml restart
```

If using non-Docker:
```bash
# Restart your Node.js services
pm2 restart all  # or your process manager
```

#### Step 4: Verify Application

1. Check application logs for errors
2. Test login functionality
3. Verify uploaded files are accessible
4. Check that projects and tasks display correctly

### Partial Restore Scenarios

#### Restore Only User Avatars

1. Extract file backup to temporary location:
   ```bash
   mkdir -p /tmp/restore
   tar -xzf backups/files/files_backup_YYYYMMDD_HHMMSS.tar.gz -C /tmp/restore
   ```

2. Copy only avatars:
   ```bash
   cp -r /tmp/restore/files_backup_*/uploads/avatars/* uploads/avatars/
   ```

3. Clean up:
   ```bash
   rm -rf /tmp/restore
   ```

#### Restore Specific Configuration File

1. Extract backup and copy specific file:
   ```bash
   tar -xzf backups/files/files_backup_YYYYMMDD_HHMMSS.tar.gz -C /tmp
   cp /tmp/files_backup_*/config/.env .env
   rm -rf /tmp/files_backup_*
   ```

## Backup Monitoring

### Check Backup Status

View recent backup logs:
```bash
tail -50 logs/backup.log
```

View recent verification logs:
```bash
tail -50 logs/backup-verify.log
```

### Check Disk Space

```bash
du -sh backups/
df -h .
```

### Email Notifications (Optional)

Add to cron job for email on failure:

```bash
0 2 * * * /path/to/backup-all.sh || echo "Backup failed on $(date)" | mail -s "Backup Failure" admin@example.com
```

## Retention Policies

### Default Retention

- **MongoDB backups:** 7 days
- **File backups:** 30 days

### Modify Retention

Edit environment variables before running scripts:

```bash
# Keep MongoDB backups for 14 days
export RETENTION_DAYS=14
./scripts/backup/backup-mongodb.sh

# Keep file backups for 60 days
export RETENTION_DAYS=60
./scripts/backup/backup-files.sh
```

Or modify defaults in the scripts directly.

## Off-Site Backups (Optional)

### AWS S3 Integration

Add to `backup-all.sh` or create separate script:

```bash
#!/bin/bash
# Upload backups to S3 after successful local backup

AWS_BUCKET="your-backup-bucket"
AWS_REGION="us-east-1"

# Upload MongoDB backups
aws s3 sync backups/mongodb/ s3://$AWS_BUCKET/mongodb/ \
  --region $AWS_REGION \
  --storage-class STANDARD_IA

# Upload file backups
aws s3 sync backups/files/ s3://$AWS_BUCKET/files/ \
  --region $AWS_REGION \
  --storage-class STANDARD_IA
```

### Rsync to Remote Server

```bash
#!/bin/bash
# Sync backups to remote server

REMOTE_USER="backup-user"
REMOTE_HOST="backup-server.example.com"
REMOTE_PATH="/backups/task-tracker"

rsync -avz --delete \
  backups/ \
  $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/
```

## Troubleshooting

### MongoDB Backup Fails

1. **Check MongoDB is running:**
   ```bash
   docker ps | grep mongodb
   # or
   systemctl status mongod
   ```

2. **Verify Docker container name:**
   ```bash
   docker ps --format "{{.Names}}" | grep mongo
   ```

3. **Check mongodump is available:**
   ```bash
   docker exec tasktracker-dev-mongodb mongodump --version
   # or
   mongodump --version
   ```

4. **Check disk space:**
   ```bash
   df -h .
   ```

### Restore Fails

1. **Verify backup integrity:**
   ```bash
   ./scripts/backup/verify-backup.sh
   ```

2. **Check mongorestore version compatibility:**
   ```bash
   mongorestore --version
   ```

3. **Ensure MongoDB is running and accessible**

4. **Check file permissions:**
   ```bash
   ls -l backups/mongodb/
   ls -l backups/files/
   ```

### Cron Job Not Running

1. **Check cron service is running:**
   ```bash
   sudo systemctl status cron
   # or on macOS:
   sudo launchctl list | grep cron
   ```

2. **Verify cron job is installed:**
   ```bash
   crontab -l
   ```

3. **Check cron logs:**
   ```bash
   # Linux:
   grep CRON /var/log/syslog
   
   # macOS:
   log show --predicate 'process == "cron"' --last 24h
   ```

4. **Ensure scripts have correct permissions:**
   ```bash
   ls -l scripts/backup/*.sh
   ```

## Security Considerations

### Backup File Security

1. **Restrict backup directory permissions:**
   ```bash
   chmod 700 backups/
   ```

2. **Encrypt sensitive backups:**
   ```bash
   # Example: Encrypt MongoDB backup
   gpg --symmetric --cipher-algo AES256 backups/mongodb/mongodb_backup_*.tar.gz
   ```

3. **Secure transfer to remote storage:**
   - Use SSH/SCP for remote transfers
   - Use SSL/TLS for cloud storage uploads
   - Enable encryption at rest on cloud storage

### Environment Variables

Sensitive configuration should be in `.env`:
- MongoDB credentials
- AWS/cloud storage credentials
- Email notification credentials

Never commit `.env` to version control.

## Production Checklist

Before deploying to production:

- [ ] Update absolute paths in cron configuration
- [ ] Test manual backup: `./scripts/backup/backup-all.sh`
- [ ] Test manual restore on non-production data
- [ ] Run verification script: `./scripts/backup/verify-backup.sh`
- [ ] Install cron job or systemd timer
- [ ] Configure log rotation for `logs/backup.log`
- [ ] Set up backup monitoring/alerting
- [ ] Document backup location for team
- [ ] Test disaster recovery procedure
- [ ] Configure off-site backup (if required)
- [ ] Set appropriate retention policies
- [ ] Secure backup directory permissions

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review script output and logs
3. Verify environment configuration
4. Test with verbose output: `bash -x scripts/backup/backup-all.sh`

## Backup File Locations

- **MongoDB Backups:** `backups/mongodb/mongodb_backup_YYYYMMDD_HHMMSS.tar.gz`
- **File Backups:** `backups/files/files_backup_YYYYMMDD_HHMMSS.tar.gz`
- **Backup Logs:** `logs/backup.log`
- **Verification Logs:** `logs/backup-verify.log`

## Recovery Time Objective (RTO)

- **MongoDB Restore:** ~5-15 minutes (depends on database size)
- **File Restore:** ~2-10 minutes (depends on upload volume)
- **Total System Recovery:** ~15-30 minutes

## Recovery Point Objective (RPO)

- **With daily backups:** Maximum 24 hours of data loss
- **Recommendation:** Run backups more frequently for critical systems (every 6-12 hours)
