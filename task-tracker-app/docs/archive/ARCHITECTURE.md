# Task Tracker - Architecture Documentation

## 📁 Project Structure

This project follows a modular architecture with clear separation of concerns:

```
task-tracker-app/
├── clients/                    # Frontend Applications
│   ├── admin/                 # Admin Portal (Next.js)
│   │   ├── components/        # Reusable React components
│   │   ├── contexts/          # React Context (Auth, etc.)
│   │   ├── pages/             # Next.js pages (routing)
│   │   ├── styles/            # CSS/styling files
│   │   └── utils/             # Helper functions (API client)
│   └── engineer/              # Engineer Portal (Next.js)
│       ├── contexts/          # React Context
│       ├── pages/             # Next.js pages
│       ├── styles/            # CSS/styling
│       └── utils/             # Helper functions
│
├── services/                   # Backend Services
│   ├── backend-api/           # Main API Service
│   │   ├── middleware/        # Express middleware (auth, etc.)
│   │   ├── models/            # MongoDB models (User, Task, Job, etc.)
│   │   ├── routes/            # API route handlers
│   │   ├── server.js          # Express server entry point
│   │   └── healthcheck.js     # Docker health check
│   └── auth-service/          # Authentication Service
│       ├── models/            # Auth-specific models
│       ├── routes/            # Auth routes (login, register, etc.)
│       ├── public/            # Static assets for login page
│       └── server.js          # Auth server entry point
│
├── infrastructure/             # Infrastructure & Deployment
│   ├── docker/                # Docker orchestration
│   │   ├── docker-compose.yml     # Production compose
│   │   ├── docker-compose.dev.yml # Development compose
│   │   └── traefik.yml        # Traefik gateway config
│   └── ssl/                   # SSL certificates (optional)
│
├── scripts/                    # Utility Scripts
│   ├── create-initial-users.js # Seed default users
│   ├── init-db.js             # Initialize database
│   └── mongo-init.js          # MongoDB initialization
│
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md        # This file
│   ├── DOCKER.md              # Docker setup guide
│   └── PRODUCTION_CLEANUP.md  # Production readiness checklist
│
├── uploads/                    # Runtime file storage
│   ├── excel/                 # Excel uploads
│   └── structural/            # Structural element files
│
├── logs/                       # Application logs
├── .env                        # Environment variables
├── .gitignore                 # Git ignore patterns
├── README.md                   # Main documentation
└── setup.sh                    # Automated setup script
```

## 🏗️ Architecture Overview

### Microservices Design

The application is built with a microservices architecture:

1. **Frontend Services (Next.js)**
   - **Admin Portal**: User management, project access, reports
   - **Engineer Portal**: Job tracking, task management, progress updates
   - Both use Server-Side Rendering (SSR) for better performance
   - Shared authentication via cookies

2. **Backend Services (Node.js/Express)**
   - **Backend API**: Core business logic, data management
   - **Auth Service**: Centralized authentication, ForwardAuth endpoint
   - RESTful API design with JWT authentication

3. **Infrastructure**
   - **Traefik**: API Gateway with automatic routing and ForwardAuth
   - **MongoDB**: NoSQL database for all data
   - **Docker**: Containerized deployment

### Communication Flow

```
User Request
    ↓
Traefik Gateway (Port 80)
    ↓
ForwardAuth → Auth Service (validates token)
    ↓
Route to appropriate service:
    - /admin     → Admin Next.js Client
    - /jobs      → Engineer Next.js Client
    - /api/auth  → Auth Service
    - /api/*     → Backend API
```

## 🔐 Authentication Flow

1. User visits root `/` → Auth Service login page
2. User submits credentials → Auth Service validates
3. Auth Service sets HTTP-only cookie with JWT token
4. Subsequent requests include cookie automatically
5. Traefik ForwardAuth middleware validates token before routing
6. Auth headers (X-User-Id, X-User-Role) passed to services

## 🗄️ Data Models

### User
- Stores user credentials and profile information
- Roles: admin, engineer
- Contains username, email, password (hashed), role

### Project
- Project information and metadata
- Links to users with access permissions

### Task
- Individual tasks within projects
- Assigned to users, tracks status and progress

### Job
- Represents work items/jobs
- Contains project reference, status, surface area data

### StructuralElement
- Structural components tracked in the system
- Includes dimensions, properties, associated files

## 🔄 Development Workflow

### Running Development Environment

```bash
cd infrastructure/docker
docker-compose -f docker-compose.dev.yml up --build
```

Access:
- Frontend (via Traefik): http://localhost
- Admin Portal: http://localhost/admin
- Engineer Portal: http://localhost/jobs
- Traefik Dashboard: http://localhost:8080
- Backend API directly: http://localhost:5000
- Auth Service directly: http://localhost:4000

### Making Changes

**Frontend Changes (clients/)**
- Hot reload enabled via Next.js dev server
- Changes reflect immediately in browser
- Volume mounted to container for live updates

**Backend Changes (services/)**
- Nodemon watches for file changes
- Server automatically restarts on code changes
- Volume mounted for live updates

## 📦 Build & Deployment

### Production Build

```bash
cd infrastructure/docker
docker-compose -f docker-compose.yml up -d
```

### Environment Variables

Key variables to configure:
- `JWT_SECRET`: Secret for JWT token signing
- `MONGODB_URI`: MongoDB connection string
- `SESSION_SECRET`: Express session secret
- `NODE_ENV`: Set to 'production' for production builds

## 🧪 Testing

### Database Seeding

```bash
# Create initial admin and engineer users
node scripts/create-initial-users.js

# Initialize database schema
node scripts/init-db.js
```

### Health Checks

- Backend API: `GET /health`
- Auth Service: `GET /api/auth/health`

## 📊 Monitoring & Logging

- Application logs: `logs/` directory
- Traefik dashboard: Port 8080 in development
- MongoDB logs: Docker container logs

## 🔧 Configuration Files

- **next.config.js**: Next.js configuration (basePath, etc.)
- **traefik.yml**: Traefik gateway settings
- **docker-compose.yml**: Production container orchestration
- **docker-compose.dev.yml**: Development environment
- **.env**: Environment-specific variables

## 🚀 Benefits of Current Structure

1. **Clear Boundaries**: Services, clients, infrastructure clearly separated
2. **Scalability**: Easy to add new services or clients
3. **Maintainability**: Related code grouped together
4. **Docker-Ready**: Each service has own Dockerfile
5. **Development**: Easy to work on specific services
6. **Production**: Clean deployment with docker-compose
