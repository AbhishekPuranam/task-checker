# Unified Authentication Service

## Overview
The Task Tracker application now uses a centralized authentication microservice that handles login for both Admin and Site Engineer roles. This eliminates duplicate login pages and provides a seamless authentication experience.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   User Access Flow                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   Auth Service        │
                │   Port: 8080/4000     │
                │   (Unified Login)     │
                └───────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
        ┌──────────────┐       ┌──────────────┐
        │ Admin Portal │       │ Site Engineer│
        │  Port: 3000  │       │  Port: 3001  │
        └──────────────┘       └──────────────┘
```

## Services

### 1. **Auth Service** (Port 4000/8080)
- **Location**: `auth-service/`
- **Purpose**: Unified authentication and authorization
- **Features**:
  - Single login page for all users
  - Role-based authentication
  - JWT token generation
  - Automatic redirection based on role
  - User verification endpoint

### 2. **Admin Portal** (Port 3000)
- **Location**: `client/`
- **Access**: Admins only
- **Features**: Full project management, user management, Excel uploads

### 3. **Site Engineer Portal** (Port 3001)
- **Location**: `client-engineer/`
- **Access**: Site engineers only
- **Features**: Job management and updates

## How It Works

### Login Flow

1. **User Access**
   - User visits either `http://localhost:3000` or `http://localhost:3001`
   - If not authenticated, automatically redirected to `http://localhost:8080` (auth service)

2. **Authentication**
   - User enters credentials on unified login page
   - Auth service validates credentials against MongoDB
   - JWT token generated with user role information

3. **Redirection**
   - **Admin users** → Redirected to `http://localhost:3000/dashboard`
   - **Site Engineers** → Redirected to `http://localhost:3001/jobs`

4. **Token Storage**
   - JWT token stored in localStorage
   - Token includes: `userId`, `username`, `role`
   - Token valid for 24 hours

### Protected Routes

Both client applications use the `ProtectedRoute` component:
- Checks for valid JWT token
- Redirects to auth service if token missing/invalid
- Validates user role for admin-only routes

## API Endpoints

### Auth Service Endpoints

#### `POST /api/auth/login`
Login endpoint for all users.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "admin",
    "role": "admin",
    "name": "Admin User",
    "assignedProjects": []
  },
  "redirectUrl": "http://localhost:3000/dashboard"
}
```

#### `POST /api/auth/register`
Create new user (admin only in production).

**Request:**
```json
{
  "username": "engineer1",
  "password": "password123",
  "name": "John Engineer",
  "role": "site_engineer",
  "assignedProjects": ["projectId1", "projectId2"]
}
```

#### `GET /api/auth/verify`
Verify JWT token validity.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "admin",
    "role": "admin",
    "name": "Admin User"
  }
}
```

## Running the Application

### Development Mode

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Services will be available at:
# - Auth Service: http://localhost:8080
# - Admin Portal: http://localhost:3000
# - Site Engineer Portal: http://localhost:3001
# - Backend API: http://localhost:5000
```

### Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Auth Login** | http://localhost:8080 | Unified login page |
| **Admin Dashboard** | http://localhost:3000 | Admin interface |
| **Engineer Jobs** | http://localhost:3001 | Site engineer interface |
| **API Server** | http://localhost:5000 | Backend REST API |

## Environment Variables

### Auth Service (.env)
```env
PORT=4000
MONGODB_URI=mongodb://mongodb:27017/tasktracker
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

## Security Features

1. **Password Hashing**: bcryptjs with salt rounds
2. **JWT Tokens**: Signed with secret key, 24-hour expiration
3. **Role-Based Access**: Enforced at both auth and route levels
4. **CORS Protection**: Configured origins only
5. **Token Validation**: Automatic verification on protected routes

## User Roles

### Admin (`role: 'admin'`)
- Full system access
- Create/manage projects
- User management
- Excel uploads
- View all structural elements and jobs

### Site Engineer (`role: 'site_engineer'`)
- Limited to assigned projects
- View and update jobs
- Update job status and progress
- Cannot create users or projects

## Development Notes

- **No local login pages**: Both clients redirect to auth service
- **Shared MongoDB**: All services use the same database
- **Containerized**: Each service runs in its own Docker container
- **Hot reload**: All services support development mode with auto-reload

## Troubleshooting

### Issue: Redirected to login but already logged in
- Clear localStorage: `localStorage.clear()`
- Check token expiration (24 hours)
- Verify auth service is running: `docker logs tasktracker-auth-dev`

### Issue: "Invalid credentials"
- Check username/password in MongoDB users collection
- Default admin: `username: admin`, check database for password

### Issue: Wrong portal after login
- Auth service reads role from user document
- Verify user role in MongoDB: `db.users.find({username: "youruser"})`

## Migration from Old System

The old system had:
- `/client/src/components/Auth/Login.js` (Admin login) - REMOVED
- `/client-engineer/src/components/Login.js` (Engineer login) - REMOVED

Now:
- Single unified login at `auth-service/public/index.html`
- Both portals redirect unauthenticated users to auth service

## Future Enhancements

- [ ] Password reset functionality
- [ ] Email verification
- [ ] Multi-factor authentication
- [ ] Session management
- [ ] Login activity logging
- [ ] Password complexity requirements
- [ ] Account lockout after failed attempts
