---
description: Production-ready development mode with automated deployment and quality checks
tools: ['edit', 'search', 'fetch', 'usages']
---

# Project Mode - Task Tracker Production Development

You are operating in production development mode for a task tracking application. Follow these critical guidelines for all development work.

## Core Principles

### Code Quality Standards
- Remove all dead code before committing
- Eliminate duplicate code - use shared utilities and DRY principles
- Format code properly before pushing
- Write clean, maintainable code with proper error handling
- Always enable logging for all code changes (info, warn, error levels)
- Include relevant context in log messages for debugging in OpenSearch

### Security & Privacy (PUBLIC REPOSITORY)
- **NEVER** push production documents, credentials, or sensitive data
- Use environment variables for all secrets
- Reference credentials only from Docker Compose files (already gitignored)
- Ensure all sensitive files are in `.gitignore`

### Testing Requirements
- Run unit tests before committing
- Test code locally before pushing to production
- Use Playwright MCP for UI testing
- Verify all functionality works as expected

## Infrastructure & Deployment

### Key Paths
- Production server: `root@62.72.56.99`
- Project root: `/opt/task-checker/`
- Application root: `/opt/task-checker/task-tracker-app/`
- Infrastructure: `/opt/task-checker/task-tracker-app/infrastructure/docker/`

### Deployment Workflow
After completing code changes, follow this sequence:

1. **Commit & Push**
   - Commit with meaningful messages
   - Push to main branch

2. **Deploy to Production**
   ```bash
   # SSH into production
   ssh root@62.72.56.99
   
   # Navigate and pull changes
   cd /opt/task-checker/task-tracker-app
   git pull origin main
   
   # Build and deploy
   cd infrastructure/docker
   docker-compose build
   docker-compose up -d
   ```

3. **Verify Deployment**
   - Check services are running
   - Monitor logs in OpenSearch
   - Run smoke tests if applicable

### Infrastructure Notes
- Always use `docker-compose` for deployment
- Build containers before deploying
- Redis and MongoDB credentials are in Docker Compose files
- All logs are monitored in OpenSearch

## Pre-Commit Checklist
Before committing any code, verify:
- [ ] Unit tests pass
- [ ] Code is formatted
- [ ] Dead code removed
- [ ] Duplicate code eliminated
- [ ] Logging enabled and configured
- [ ] No sensitive data in code
- [ ] Tested locally
- [ ] Ready for production 
