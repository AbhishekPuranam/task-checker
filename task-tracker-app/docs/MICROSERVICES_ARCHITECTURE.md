# Microservices Architecture Design

## Overview
Refactoring from monolithic architecture to microservices with 13 services.

## Services Architecture

### 1. UI Services (2 containers)
- **Admin UI** (Port: 3002) - Admin dashboard
- **Engineer UI** (Port: 3001) - Engineer dashboard
- Technology: Next.js
- Scaling: 2 replicas each

### 2. Auth Service (Port: 6000)
- Authentication and Authorization
- JWT token management
- User management
- Session handling
- Technology: Express.js + Mongoose

### 3. Excel Service (Port: 6001)
- Excel file upload and validation
- BullMQ job queuing
- Batch processing
- Progress tracking
- Technology: Express.js + BullMQ + XLSX

### 4. Project Service (Port: 6002)
- Project CRUD operations
- Project listing and filtering
- Project metrics
- Technology: Express.js + Mongoose

### 5. SubProject Service (Port: 6003)
- SubProject CRUD operations
- SubProject-Project relationships
- SubProject metrics
- Technology: Express.js + Mongoose

### 6. Structural Elements Service (Port: 6004-6006)
- Structural element CRUD
- Bulk operations
- Search and filtering
- **Scaling: 3 replicas** for load distribution
- Technology: Express.js + Mongoose

### 7. Jobs Service (Port: 6007-6009)
- Job CRUD operations
- Job assignment and tracking
- Job status updates
- **Scaling: 3 replicas** for load distribution
- Technology: Express.js + Mongoose

### 8. Metrics Service (Port: 6010)
- Reports generation
- Analytics and dashboards
- Progress calculations
- Technology: Express.js + Mongoose

### 9. Redis (Port: 6379)
- Session storage
- BullMQ job queue
- Caching layer

### 10. MongoDB (Port: 27017)
- Primary database
- Replica set for transactions

### 11. Monitoring (Uptime Kuma)
- Service health monitoring
- Uptime tracking
- Alert management

### 12. Logging (Vector/OpenSearch)
- Centralized logging
- Log aggregation
- Log search and analysis

### 13. Traefik (Ports: 80, 443)
- API Gateway
- Load balancing
- SSL termination
- Request routing

## Routing Strategy

### Traefik Routing Rules
```
/admin/* → Admin UI (load balanced across 2 replicas)
/engineer/* → Engineer UI (load balanced across 2 replicas)
/api/auth/* → Auth Service
/api/excel/* → Excel Service
/api/projects → Project Service (without subproject paths)
/api/projects/*/subprojects → SubProject Service
/api/subprojects/* → SubProject Service
/api/structural-elements/* → Structural Elements Service (load balanced across 3 replicas)
/api/jobs/* → Jobs Service (load balanced across 3 replicas)
/api/reports/* → Metrics Service
/api/metrics/* → Metrics Service
/api/admin/* → Admin endpoints (distributed to relevant services)
```

## Database Strategy
- **Shared Database Pattern**: All services share MongoDB
- Each service accesses only its domain models
- Use MongoDB transactions for cross-service operations
- Future: Consider database-per-service pattern

## Communication
- **Synchronous**: REST APIs via Traefik
- **Asynchronous**: BullMQ for background jobs (Excel processing, metrics calculation)
- **Event Bus**: Future consideration for event-driven architecture

## Security
- JWT authentication at Auth Service
- Traefik handles SSL termination
- API Gateway security headers
- Rate limiting per service
- Secret management via Docker Secrets

## Scaling Configuration
```
UI Services: 2 replicas each
Auth Service: 1 replica (stateless, can scale)
Excel Service: 1 replica (handles heavy I/O)
Project Service: 1 replica (can scale)
SubProject Service: 1 replica (can scale)
Structural Elements Service: 3 replicas (high load)
Jobs Service: 3 replicas (high load)
Metrics Service: 1 replica (can scale)
```

## Health Checks
Each service exposes `/health` endpoint:
- Database connectivity
- Redis connectivity
- Service-specific health indicators

## Deployment Order
1. MongoDB + Redis
2. Auth Service
3. Project Service
4. SubProject Service
5. Structural Elements Service (3 replicas)
6. Jobs Service (3 replicas)
7. Excel Service
8. Metrics Service
9. UI Services (Admin + Engineer)
10. Traefik
11. Monitoring Services

## Resource Allocation
```
Structural Elements (3 instances): 0.5 CPU, 512MB RAM each
Jobs (3 instances): 0.5 CPU, 512MB RAM each
Excel Service: 1.0 CPU, 1GB RAM (heavy processing)
Metrics Service: 0.5 CPU, 512MB RAM
Other services: 0.25 CPU, 256MB RAM
```

## Benefits
1. **Scalability**: Scale high-load services independently
2. **Resilience**: Service failures don't crash entire system
3. **Development**: Teams can work independently on services
4. **Deployment**: Deploy services independently
5. **Resource Optimization**: Allocate resources based on service needs
6. **Maintenance**: Easier to maintain and debug isolated services
