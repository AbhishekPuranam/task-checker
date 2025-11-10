# Pre-Deployment Checklist

Run this checklist **BEFORE EVERY DEPLOYMENT** to prevent service crashes.

## 1. Validate Configuration
```bash
cd /opt/task-checker/task-tracker-app/scripts
chmod +x validate-services.sh
./validate-services.sh
```

## 2. Test Services Locally (if applicable)
- [ ] All unit tests pass
- [ ] Services start without errors
- [ ] Login page loads at http://localhost/login
- [ ] Authentication works

## 3. Check Secrets
- [ ] All secret files exist in `infrastructure/docker/secrets/`
- [ ] jwt_secret is mounted in ALL services that use authentication
- [ ] mongodb_password is valid
- [ ] redis_password is valid

## 4. Verify Docker Compose Configuration
- [ ] jwt_secret listed in secrets section for:
  - auth-service ✓
  - project-service ✓
  - subproject-service ✓
  - metrics-service ✓
  - excel-service ✓
  - structural-elements-service ✓
- [ ] Traefik routes configured for /login and /

## 5. Build & Deploy
```bash
cd infrastructure/docker
docker compose -f docker-compose.microservices.yml build
docker compose -f docker-compose.microservices.yml up -d
```

## 6. Post-Deployment Verification
```bash
# Check all services are running
docker compose -f docker-compose.microservices.yml ps

# Check for crash loops
docker ps | grep -i restart

# Test login page
curl -I https://projects.sapcindia.com/login

# Test login API
curl -X POST https://projects.sapcindia.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"nsharma","password":"sapcindia@123"}'
```

## Common Issues & Fixes

### Issue: Service keeps restarting
**Check**: `docker logs <container-name>`
**Common cause**: Missing jwt_secret mount
**Fix**: Add jwt_secret to service secrets in docker-compose

### Issue: Login page returns 404
**Check**: Traefik routes and auth-service static file serving
**Fix**: Ensure auth-service has login routes and Traefik routing configured

### Issue: CSP blocking scripts
**Check**: Browser console for CSP errors
**Fix**: Configure Helmet CSP to allow inline scripts in auth-service

### Issue: Credentials in URL
**Check**: Form submission method
**Fix**: Add `action="javascript:void(0)"` to form

### Issue: No redirect after login
**Check**: Login API response
**Fix**: Ensure redirectUrl is returned in auth route response
