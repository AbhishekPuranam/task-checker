# Security Guidelines

## Critical Security Measures Implemented

### 1. Authentication & Authorization

#### JWT Security
- **NEVER** use fallback JWT secrets in production
- Set `JWT_SECRET` environment variable to a strong random string (minimum 32 characters)
- Generate using: `openssl rand -base64 32`
- Token expiry: 24 hours (configurable)

#### Password Requirements
- Minimum length: 8 characters (enforced)
- Bcrypt salt rounds: 12
- Passwords are hashed before storage
- Password reuse prevention on change
- Account lockout after 5 failed login attempts (15-minute window)

#### Rate Limiting
- **Login**: 5 attempts per 15 minutes per IP
- **Registration**: 3 accounts per hour per IP
- **Password Change**: 5 attempts per 15 minutes
- **General API**: 1000 requests per minute (disabled in dev mode)

### 2. Input Validation

#### Username Validation
- 3-30 characters
- Alphanumeric, underscore, and hyphen only
- Regex: `/^[a-zA-Z0-9_-]{3,30}$/`

#### Email Validation
- Standard email format validation
- Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

#### Role Validation
- Whitelisted roles: `admin`, `site-engineer`, `engineer`
- Prevents privilege escalation

### 3. File Upload Security

#### Avatar Uploads
- **File size limit**: 5MB
- **Allowed types**: JPEG, JPG, PNG, GIF
- **Filename sanitization**: Removes special characters, prevents path traversal
- **MIME type validation**: Server-side verification
- Storage path: `/uploads/avatars/` (not web-accessible by default)

#### Excel Uploads
- **File size limit**: 10MB
- **Allowed types**: .xlsx, .xls
- **MIME type validation**: Strict content-type checking
- Processed in background queue to prevent DoS

### 4. HTTP Security Headers (Helmet.js)

```javascript
Content-Security-Policy: Prevents XSS attacks
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 5. Database Security

#### MongoDB Protection
- **No SQL injection**: Using Mongoose ODO with parameterized queries
- **Prototype pollution prevention**: JSON parser filtering
- **Connection pooling**: Min 5, Max 10 connections
- **Index optimization**: Compound indexes for query performance

#### Data Sanitization
- User passwords excluded from queries (`.select('-password')`)
- Input validation on all endpoints
- ObjectId validation for route parameters

### 6. CORS Configuration

```javascript
Allowed origins:
- http://localhost:3000
- http://127.0.0.1:3000
- Process.env.CLIENT_URL (production)

Credentials: true
Methods: GET, POST, PUT, DELETE, OPTIONS
```

### 7. Session Management

- JWT tokens stored in `localStorage` (client-side)
- HTTP-only cookies option available
- Token validation on every protected route
- Automatic logout on token expiry
- User status check (isActive) on every request

## Security Checklist for Production

### Before Deployment

- [ ] Set strong `JWT_SECRET` environment variable
- [ ] Set strong `SESSION_SECRET` environment variable
- [ ] Change default MongoDB credentials
- [ ] Enable HTTPS/TLS for all connections
- [ ] Set `NODE_ENV=production`
- [ ] Review and update CORS allowed origins
- [ ] Enable rate limiting (currently disabled in dev)
- [ ] Set up firewall rules
- [ ] Configure proper file permissions
- [ ] Enable MongoDB authentication
- [ ] Set up database backups
- [ ] Configure log rotation
- [ ] Review and remove debug console.logs
- [ ] Set up monitoring and alerting
- [ ] Conduct security audit/penetration testing

### Environment Variables (Production)

```bash
# CRITICAL: Never commit these to version control
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://<user>:<password>@<host>:<port>/<database>
JWT_SECRET=<strong-random-string-min-32-chars>
SESSION_SECRET=<strong-random-string-min-32-chars>
CLIENT_URL=https://your-domain.com
REDIS_URL=redis://<host>:6379
```

### MongoDB Production Configuration

```javascript
// Enable authentication
use admin
db.createUser({
  user: "admin",
  pwd: "<strong-password>",
  roles: ["userAdminAnyDatabase", "readWriteAnyDatabase"]
})

// Enable SSL/TLS
net:
  ssl:
    mode: requireSSL
    PEMKeyFile: /path/to/mongodb.pem
```

## Common Vulnerabilities Addressed

### ✅ OWASP Top 10

1. **Broken Access Control**: Role-based authentication middleware
2. **Cryptographic Failures**: Bcrypt for passwords, strong JWT secrets
3. **Injection**: Mongoose ODM, input validation, parameterized queries
4. **Insecure Design**: Security-first architecture, rate limiting
5. **Security Misconfiguration**: Helmet.js, secure defaults
6. **Vulnerable Components**: Regular npm audit and updates
7. **Authentication Failures**: Strong password policy, rate limiting
8. **Software/Data Integrity**: File upload validation, MIME checking
9. **Logging Failures**: Comprehensive error logging (review for sensitive data)
10. **SSRF**: Input validation, whitelist-based validation

### 🔒 Additional Protections

- **Path Traversal**: Filename sanitization
- **Prototype Pollution**: JSON reviver filtering
- **Brute Force**: Rate limiting on auth endpoints
- **XSS**: Helmet CSP, input escaping
- **CSRF**: SameSite cookies (when using cookie-based auth)
- **DoS**: Request size limits, rate limiting, background job processing

## Incident Response

### If Credentials Are Compromised

1. Immediately rotate JWT_SECRET
2. Invalidate all active sessions
3. Force password reset for affected users
4. Review access logs for suspicious activity
5. Notify affected users
6. Document the incident

### Regular Security Tasks

- [ ] Weekly: Review npm audit results
- [ ] Monthly: Update dependencies
- [ ] Quarterly: Security audit
- [ ] Annually: Penetration testing

## Reporting Security Issues

If you discover a security vulnerability, please email: security@your-domain.com

**Do not** create public GitHub issues for security vulnerabilities.

## Security Updates Log

| Date | Version | Security Fix |
|------|---------|--------------|
| 2025-10-30 | 1.1.0 | Initial security hardening |
| | | - Added rate limiting |
| | | - Enhanced password requirements |
| | | - File upload sanitization |
| | | - Input validation |
| | | - Helmet security headers |
