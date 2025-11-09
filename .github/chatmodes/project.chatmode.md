# GitHub Copilot Custom Instructions

## Repository Guidelines

### 1. Git Push Policy
- **ALWAYS** push code changes to production after writing code
- Commit regularly with meaningful commit messages
- Ensure code is tested before pushing

### 2. Security & Privacy
- This is a **PUBLIC** repository
- **NEVER** push production documents, credentials, or sensitive data
- All sensitive files must be added to `.gitignore`
- Use environment variables for secrets
- Reference credentials from Docker Compose files only (they should already be gitignored)

### 3. Code Quality
- **Remove dead code** before every commit
- **Eliminate duplicate code** before committing
- Run code cleanup and formatting before pushing
- Keep codebase clean and maintainable

### 4. Logging & Monitoring
- **ALWAYS** ensure logging is enabled in code changes
- Use proper logging levels (info, warn, error)
- All logs are monitored in OpenSearch
- Include relevant context in log messages for debugging

### 5. Deployment Process
After committing code, follow these steps:

```bash
# 1. SSH into production server
ssh root@62.72.56.99

# 2. Navigate to project directory
cd /opt/task-checker/task-tracker-app

# 3. Pull latest changes
git pull origin main

# 4. Navigate to infrastructure directory
cd infrastructure/docker

# 5. Build containers
docker-compose build

# 6. Deploy using docker-compose
docker-compose up -d
```

### 6. Infrastructure Details
- Infrastructure code location: `/opt/task-checker/task-tracker-app/infrastructure/docker`
- **ALWAYS** build containers before deploying
- **ALWAYS** use `docker-compose` for deployment
- Redis and MongoDB passwords are configured in Docker Compose files
- Reference these credentials from the compose files - do not hardcode

### 7. Key Paths
- Production server: `root@62.72.56.99`
- Project root: `/opt/task-checker/`
- App root: `/opt/task-checker/task-tracker-app/`
- Infrastructure: `/opt/task-checker/task-tracker-app/infrastructure/docker/`

## Pre-Commit Checklist
- [ ] do unit tests pass
- [ ] Code formatted
- [ ] Dead code removed
- [ ] Duplicate code eliminated
- [ ] Logging enabled and properly configured
- [ ] No sensitive data in code
- [ ] Code tested locally
- [ ] Ready to push to production

## Deployment Checklist
- [ ] Code committed and pushed
- [ ] SSH'd into production server
- [ ] Navigated to correct directory
- [ ] Pulled latest changes
- [ ] Built Docker containers
- [ ] Deployed with docker-compose
- [ ] Verified services are running
- [ ] Checked logs in OpenSearch
- [ ] test the code for UI use Playwright MCP 
