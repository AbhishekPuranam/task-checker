# Microservices Architecture - Task Tracker

## 🎯 Overview

This application has been refactored from a monolithic architecture to a **microservices architecture** consisting of **13 independent services**.

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Traefik (API Gateway)                      │
│                    Load Balancer & SSL Termination                │
└───────────┬─────────────────────────────────────────┬─────────────┘
            │                                         │
    ┌───────▼──────┐                          ┌──────▼──────┐
    │   Frontend   │                          │   Backend   │
    │   Services   │                          │ Microservices│
    └──────────────┘                          └─────────────┘
         │                                           │
    ┌────┴────┐                          ┌──────────┴──────────┐
    │         │                          │                     │
┌───▼──┐  ┌──▼───┐              ┌───────▼────────┐   ┌───────▼────────┐
│Admin │  │Engine│              │  Auth Service  │   │ Excel Service  │
│  UI  │  │er UI │              │     (6000)     │   │     (6001)     │
│ x2   │  │  x2  │              └────────────────┘   └────────────────┘
└──────┘  └──────┘                       │                    │
                                         │                    │
                            ┌────────────┴────────────────────┴──────┐
                            │                                         │
                   ┌────────▼────────┐              ┌────────▼────────┐
                   │Project Service  │              │SubProject Svc   │
                   │     (6002)      │              │     (6003)      │
                   └─────────────────┘              └─────────────────┘
                            │                                │
                            │                                │
              ┌─────────────┴────────────┐          ┌───────┴──────┐
              │                          │          │              │
     ┌────────▼────────┐        ┌───────▼──────┐  ┌▼──────────┐  │
     │Structural Elem  │        │Jobs Service  │  │  Metrics   │  │
     │Service (x3)     │        │   (x3)       │  │  Service   │  │
     │(6004-6006)      │        │(6007-6009)   │  │  (6010)    │  │
     └─────────────────┘        └──────────────┘  └────────────┘  │
              │                          │                │        │
              └──────────────────┬───────┴────────────────┘        │
                                 │                                 │
                    ┌────────────▼──────────────┐                  │
                    │                           │                  │
              ┌─────▼─────┐            ┌────────▼────────┐         │
              │  MongoDB  │            │     Redis       │         │
              │  (27017)  │            │    (6379)       │         │
              └───────────┘            └─────────────────┘         │
                                                                   │
                                                          ┌────────▼────────┐
                                                          │Uptime Kuma      │
                                                          │(Monitoring)     │
                                                          └─────────────────┘
```

## 🏗️ Services Breakdown

### Frontend Services (2)
| Service | Port | Replicas | Description |
|---------|------|----------|-------------|
| Admin UI | 3002 | 2 | Admin dashboard for project management |
| Engineer UI | 3001 | 2 | Engineer portal for job tracking |

### Backend Microservices (7)
| Service | Port(s) | Replicas | CPU | Memory | Description |
|---------|---------|----------|-----|--------|-------------|
| Auth Service | 6000 | 1 | 0.5 | 512MB | JWT authentication & authorization |
| Excel Service | 6001 | 1 | 1.5 | 2GB | Batch Excel processing with BullMQ |
| Project Service | 6002 | 1 | 0.5 | 512MB | Project aggregation & management |
| SubProject Service | 6003 | 1 | 0.5 | 512MB | SubProject CRUD & grouping |
| **Structural Elements** | **6004-6006** | **3** | **0.75** | **768MB** | **High-load element management** |
| **Jobs Service** | **6007-6009** | **3** | **0.75** | **768MB** | **High-load job tracking** |
| Metrics Service | 6010 | 1 | 0.75 | 768MB | Reports & analytics |

### Infrastructure Services (4)
| Service | Port | Description |
|---------|------|-------------|
| MongoDB | 27017 | Database with replica set |
| Redis | 6379 | Cache & BullMQ queue |
| Traefik | 80, 443 | API Gateway & Load Balancer |
| Uptime Kuma | 3001 | Service health monitoring |

**Total Resources**: ~7-8 CPU cores, 8-10GB RAM

## 🔄 Business Logic Flow

### Admin Drill-Down Workflow
```
1. LOGIN → Auth Service validates credentials

2. PROJECT DASHBOARD → Project Service
   ├─ Aggregates data from all SubProjects
   ├─ Shows element status: No Job | Active | Complete | No Clearance
   └─ Shows job status: Pending | Completed | No Clearance

3. SUBPROJECT VIEW → SubProject Service
   ├─ Element grouping by parameters
   ├─ SQM tracking per section
   └─ Excel export by status

4. ELEMENT DETAILS → Structural Elements Service (Load Balanced x3)
   ├─ Individual element details
   ├─ Status tracking with SQM
   └─ Associated fireproofing workflow

5. JOB MANAGEMENT → Jobs Service (Load Balanced x3)
   ├─ View jobs: Pending | Completed | No Clearance
   ├─ Update job status
   └─ Triggers metric recalculation cascade
```

### Data Processing Flow
```
EXCEL UPLOAD (Admin)
    ↓
Excel Service (6001)
    ├─ Validates file
    ├─ Queues to BullMQ (Redis)
    └─ Returns job ID immediately
    
BullMQ Worker Processing (Background)
    ├─ Parses Excel (5000+ rows)
    ├─ Creates Structural Elements → Structural Elements Service
    ├─ Assigns Fireproofing Workflow
    └─ Auto-creates Jobs → Jobs Service
         ├─ Cement Fire Proofing: 7 jobs
         ├─ Gypsum Fire Proofing: 7 jobs
         ├─ Intumescent Coatings: 9 jobs
         └─ Refinery Fire Proofing: 12 jobs
    
Metric Aggregation (Automatic)
    ├─ Jobs Service calculates job metrics
    ├─ Structural Elements calculates SQM completion
    ├─ SubProject Service aggregates from elements
    └─ Project Service aggregates from subprojects
```

## 📡 API Routing (Traefik)

All requests go through Traefik API Gateway at `projects.sapcindia.com`:

| Path | Service | Load Balanced |
|------|---------|---------------|
| `/api/auth/*` | Auth Service | No |
| `/api/excel/*` | Excel Service | No |
| `/api/projects` | Project Service | No |
| `/api/subprojects/*` | SubProject Service | No |
| `/api/structural-elements/*` | Structural Elements | **Yes (3 replicas)** |
| `/api/jobs/*` | Jobs Service | **Yes (3 replicas)** |
| `/api/reports/*`, `/api/metrics/*` | Metrics Service | No |
| `/admin/*` | Admin UI | Yes (2 replicas) |
| `/engineer/*` | Engineer UI | Yes (2 replicas) |

## 🚀 Quick Start

### Local Development
```bash
cd task-tracker-app/infrastructure/docker
docker compose -f docker-compose.microservices.yml up -d
```

### Production Deployment
```bash
# Automated migration
chmod +x scripts/migrate-to-microservices.sh
./scripts/migrate-to-microservices.sh

# Or manual
cd /opt/task-checker/task-tracker-app
git pull origin main
cd infrastructure/docker
docker compose -f docker-compose.microservices.yml build
docker compose -f docker-compose.microservices.yml up -d
```

See [MICROSERVICES_DEPLOYMENT.md](./MICROSERVICES_DEPLOYMENT.md) for detailed steps.

## 📦 Directory Structure

```
task-tracker-app/
├── shared/                          # Shared across all microservices
│   ├── models/                      # Mongoose models
│   ├── middleware/                  # Auth, cache, etc.
│   └── utils/                       # Queue, transaction helpers
│
├── services-microservices/          # Backend microservices
│   ├── auth-service/
│   ├── excel-service/
│   ├── project-service/
│   ├── subproject-service/
│   ├── structural-elements-service/
│   ├── jobs-service/
│   └── metrics-service/
│
├── clients/                         # Frontend services
│   ├── admin/                       # Admin UI (Next.js)
│   └── engineer/                    # Engineer UI (Next.js)
│
├── infrastructure/docker/
│   ├── docker-compose.microservices.yml  # Microservices config
│   ├── docker-compose.yml                # Legacy monolithic (backup)
│   └── traefik.yml                       # API Gateway config
│
├── docs/
│   ├── MICROSERVICES_ARCHITECTURE.md     # Architecture overview
│   └── MICROSERVICES_DEPLOYMENT.md       # Deployment guide
│
└── scripts/
    ├── migrate-to-microservices.sh       # Automated migration
    └── generate-microservices.sh         # Service generator
```

## 🔧 Configuration

### Environment Variables (Each Service)
```bash
NODE_ENV=production
PORT=600X
SERVICE_NAME=service-name
MONGO_HOST=mongodb
MONGO_PORT=27017
MONGO_DB=tasktracker
REDIS_HOST=redis
REDIS_PORT=6379
VAULT_ADDR=http://vault:8200
```

### Docker Secrets
Located in `infrastructure/docker/secrets/`:
- `mongodb_password` - MongoDB root password
- `redis_password` - Redis authentication
- `jwt_secret` - JWT token signing
- `session_secret` - Session encryption
- `vault_token` - Vault access token

## 📊 Monitoring & Health Checks

### Health Endpoints
Each service exposes `/health`:
```bash
curl http://localhost:6000/health  # Auth
curl http://localhost:6001/health  # Excel
curl http://localhost:6002/health  # Project
curl http://localhost:6003/health  # SubProject
curl http://localhost:6004/health  # Structural Elements
curl http://localhost:6007/health  # Jobs
curl http://localhost:6010/health  # Metrics
```

### Monitoring Tools
- **Uptime Kuma**: http://62.72.56.99:3001
- **Traefik Dashboard**: https://traefik.projects.sapcindia.com
- **OpenSearch**: Centralized logging
- **Docker Stats**: `docker stats`

## 🔄 Scaling Services

```bash
# Scale Structural Elements to 5 replicas
docker compose -f docker-compose.microservices.yml up -d --scale structural-elements-service=5

# Scale Jobs Service to 5 replicas
docker compose -f docker-compose.microservices.yml up -d --scale jobs-service=5

# Scale UI services
docker compose -f docker-compose.microservices.yml up -d --scale tasktracker-admin=3
```

## 🛠️ Development

### Adding a New Microservice
1. Create service directory: `services-microservices/new-service/`
2. Add `package.json`, `server.js`, `Dockerfile`
3. Add routes in `routes/`
4. Update `docker-compose.microservices.yml`
5. Add Traefik labels for routing
6. Build and deploy

### Modifying Existing Service
1. Update code in `services-microservices/[service-name]/`
2. Test locally
3. Commit and push
4. Rebuild: `docker compose -f docker-compose.microservices.yml build [service-name]`
5. Deploy: `docker compose -f docker-compose.microservices.yml up -d [service-name]`

## 🐛 Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose -f docker-compose.microservices.yml logs [service-name]

# Verify dependencies
docker compose -f docker-compose.microservices.yml ps mongodb redis

# Restart service
docker compose -f docker-compose.microservices.yml restart [service-name]
```

### Database Issues
```bash
# Check MongoDB replica set
docker exec tasktracker-mongodb mongosh -u admin -p [password] \
  --eval "rs.status()"
```

### Routing Issues
```bash
# Check Traefik logs
docker logs tasktracker-traefik

# Verify service labels
docker inspect [service-name] | grep traefik
```

## 📈 Benefits of Microservices

1. **Independent Scaling**: Scale high-load services (Structural Elements, Jobs) independently
2. **Fault Isolation**: One service failure doesn't crash entire system
3. **Independent Deployment**: Deploy services without downtime
4. **Technology Flexibility**: Use different tech stacks per service if needed
5. **Team Autonomy**: Teams can work on services independently
6. **Resource Optimization**: Allocate resources based on service needs
7. **Better Performance**: Load balancing across multiple replicas

## 🔐 Security

- **API Gateway**: Traefik handles SSL termination
- **Authentication**: Centralized in Auth Service
- **Secrets Management**: Docker Secrets + HashiCorp Vault
- **Rate Limiting**: Per service configuration
- **Network Isolation**: Services communicate via internal Docker network

## 📚 Documentation

- [Architecture Overview](./docs/MICROSERVICES_ARCHITECTURE.md)
- [Deployment Guide](./docs/MICROSERVICES_DEPLOYMENT.md)
- [API Documentation](https://projects.sapcindia.com/api/docs)

## 🤝 Contributing

1. Create feature branch
2. Develop in specific microservice
3. Test locally with docker-compose
4. Submit PR with service-specific changes
5. Deploy to production after approval

## 📞 Support

For deployment issues:
1. Check service logs
2. Verify health endpoints
3. Review Traefik dashboard
4. Check OpenSearch logs
5. Monitor resource usage

---

**Last Updated**: November 2025  
**Version**: 2.0.0 (Microservices)  
**Previous Version**: 1.x (Monolithic)
