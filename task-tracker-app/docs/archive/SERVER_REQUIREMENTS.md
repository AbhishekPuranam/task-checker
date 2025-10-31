# Server Hardware Requirements - Task Tracker Application

**Document Version**: 1.0  
**Date**: October 30, 2025  
**Application**: Task Tracker System  
**Deployment**: Private Server (Production)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Application Architecture](#application-architecture)
3. [Hardware Requirements by Tier](#hardware-requirements-by-tier)
4. [Detailed Component Requirements](#detailed-component-requirements)
5. [Scalability Considerations](#scalability-considerations)
6. [Cost Estimation](#cost-estimation)
7. [Network & Bandwidth](#network--bandwidth)
8. [Storage Planning](#storage-planning)
9. [Redundancy & High Availability](#redundancy--high-availability)

---

## Executive Summary

### Recommended Configuration (Medium Scale)

| Component | Specification |
|-----------|---------------|
| **CPU** | 8 vCPUs (4 cores @ 2.5GHz+) |
| **RAM** | 16 GB |
| **Storage** | 200 GB SSD (NVMe preferred) |
| **Network** | 1 Gbps bandwidth |
| **OS** | Ubuntu 22.04 LTS or CentOS 8+ |

**Estimated Concurrent Users**: 100-200  
**Estimated Monthly Cost**: $100-$200 (VPS) or $150-$300 (Dedicated)

---

## Application Architecture

### Services Running
1. **Backend API** (Node.js) - Port 5000
2. **Auth Service** (Node.js) - Port 4000
3. **Authorizer Service** (Node.js) - Port 4001
4. **Admin Client** (Next.js) - Port 3002
5. **Engineer Client** (Next.js) - Port 3001
6. **MongoDB** (Database) - Port 27017
7. **Redis** (Cache) - Port 6379
8. **Traefik** (Reverse Proxy) - Ports 80, 443

**Total Services**: 8 Docker containers

---

## Hardware Requirements by Tier

### Tier 1: Small Scale (10-50 Users)

**Ideal For**: Small teams, pilot deployment, development/staging

| Component | Specification | Notes |
|-----------|---------------|-------|
| **CPU** | 4 vCPUs (2 cores @ 2.0GHz+) | Sufficient for light load |
| **RAM** | 8 GB | Minimum for all services |
| **Storage** | 100 GB SSD | For OS, apps, and data |
| **Network** | 100 Mbps | Adequate for small teams |
| **Swap** | 4 GB | For memory overflow |

**Resource Breakdown**:
- MongoDB: 2 GB RAM
- Redis: 512 MB RAM
- Backend API: 1.5 GB RAM
- Auth Service: 512 MB RAM
- Authorizer: 512 MB RAM
- Admin Client: 1 GB RAM
- Engineer Client: 1 GB RAM
- Traefik: 256 MB RAM
- OS Overhead: ~1 GB RAM

**Estimated Cost**: $40-$80/month

**Recommended Providers**:
- DigitalOcean Droplet: $48/month (4 vCPUs, 8 GB)
- Linode: $60/month (4 vCPUs, 8 GB)
- Vultr: $48/month (4 vCPUs, 8 GB)

---

### Tier 2: Medium Scale (50-200 Users) ⭐ **RECOMMENDED**

**Ideal For**: Growing teams, production deployment, standard workload

| Component | Specification | Notes |
|-----------|---------------|-------|
| **CPU** | 8 vCPUs (4 cores @ 2.5GHz+) | Handles concurrent requests well |
| **RAM** | 16 GB | Comfortable headroom |
| **Storage** | 200 GB SSD (NVMe) | Fast I/O for database |
| **Network** | 1 Gbps | Smooth user experience |
| **Swap** | 8 GB | Safety buffer |

**Resource Breakdown**:
- MongoDB: 4 GB RAM (with indexes and cache)
- Redis: 2 GB RAM (for caching strategy)
- Backend API: 3 GB RAM (handles BullMQ workers)
- Auth Service: 1 GB RAM
- Authorizer: 1 GB RAM
- Admin Client: 2 GB RAM
- Engineer Client: 2 GB RAM
- Traefik: 512 MB RAM
- OS + Monitoring: 2 GB RAM

**Estimated Cost**: $100-$200/month

**Recommended Providers**:
- DigitalOcean: $120/month (8 vCPUs, 16 GB)
- Linode: $120/month (8 vCPUs, 16 GB)
- Vultr High Frequency: $144/month (8 vCPUs, 16 GB, NVMe)
- AWS EC2 t3.xlarge: ~$140/month (4 vCPUs, 16 GB)
- Azure Standard D4s v3: ~$150/month (4 vCPUs, 16 GB)

---

### Tier 3: Large Scale (200-500 Users)

**Ideal For**: Large organizations, high traffic, multiple concurrent projects

| Component | Specification | Notes |
|-----------|---------------|-------|
| **CPU** | 16 vCPUs (8 cores @ 3.0GHz+) | High performance |
| **RAM** | 32 GB | Extensive caching |
| **Storage** | 500 GB SSD (NVMe RAID) | Database growth + backups |
| **Network** | 2 Gbps+ | High bandwidth |
| **Swap** | 16 GB | Large workload buffer |

**Resource Breakdown**:
- MongoDB: 10 GB RAM (large datasets)
- Redis: 4 GB RAM (aggressive caching)
- Backend API (2 instances): 6 GB RAM
- Auth Service: 2 GB RAM
- Authorizer: 2 GB RAM
- Admin Client: 3 GB RAM
- Engineer Client: 3 GB RAM
- Traefik: 1 GB RAM
- OS + Monitoring + Telemetry: 3 GB RAM

**Estimated Cost**: $250-$500/month

**Recommended Providers**:
- DigitalOcean: $288/month (16 vCPUs, 32 GB)
- Linode: $288/month (16 vCPUs, 32 GB)
- AWS EC2 m5.2xlarge: ~$350/month (8 vCPUs, 32 GB)
- Dedicated Server: $200-$400/month

---

### Tier 4: Enterprise Scale (500+ Users)

**Ideal For**: Enterprise deployments, multi-tenancy, high availability

| Component | Specification | Notes |
|-----------|---------------|-------|
| **CPU** | 32+ vCPUs (16+ cores @ 3.0GHz+) | Multi-instance scaling |
| **RAM** | 64 GB+ | Large in-memory operations |
| **Storage** | 1 TB SSD (NVMe RAID 10) | Redundancy + performance |
| **Network** | 10 Gbps+ | Enterprise bandwidth |
| **Load Balancer** | Required | Distribute traffic |

**Architecture**: Multi-server setup recommended
- Application Servers: 2-3 instances
- Database Server: Dedicated MongoDB cluster (3 nodes)
- Cache Server: Dedicated Redis cluster (3 nodes)
- Load Balancer: HAProxy or cloud LB

**Estimated Cost**: $1,000-$2,500/month (cluster setup)

---

## Detailed Component Requirements

### 1. CPU Requirements

**Minimum**: 4 vCPUs  
**Recommended**: 8 vCPUs  
**Optimal**: 16+ vCPUs for high concurrency

**CPU-Intensive Operations**:
- Excel file processing (BullMQ workers)
- MongoDB query execution
- Next.js server-side rendering
- Image processing (avatar uploads)
- Background job processing

**CPU Allocation** (Medium Scale):
```
MongoDB:        2 vCPUs (25%)
Backend API:    3 vCPUs (37.5%) - includes worker threads
Next.js Apps:   2 vCPUs (25%)
Other Services: 1 vCPU (12.5%)
```

### 2. Memory (RAM) Requirements

**Minimum**: 8 GB  
**Recommended**: 16 GB  
**Optimal**: 32+ GB for caching and performance

**Memory Usage Breakdown** (Medium Scale):

| Service | Base RAM | Peak RAM | Notes |
|---------|----------|----------|-------|
| MongoDB | 2 GB | 4 GB | Caches indexes and working set |
| Redis | 1 GB | 2 GB | Caches API responses, sessions |
| Backend API | 2 GB | 3 GB | Node.js + worker processes |
| Auth Service | 512 MB | 1 GB | Lightweight service |
| Authorizer | 512 MB | 1 GB | Token validation |
| Admin Client | 1 GB | 2 GB | Next.js SSR |
| Engineer Client | 1 GB | 2 GB | Next.js SSR |
| Traefik | 256 MB | 512 MB | Reverse proxy |
| OS + Tools | 1.5 GB | 2 GB | Ubuntu + monitoring |
| **Total** | **~10 GB** | **~16 GB** | Comfortable headroom |

**Memory Optimization Tips**:
- Enable Redis LRU eviction for cache management
- Set MongoDB WiredTiger cache limit (50% of available RAM)
- Configure Node.js `--max-old-space-size` for each service
- Use swap space for overflow (not primary memory)

### 3. Storage Requirements

**Minimum**: 100 GB  
**Recommended**: 200 GB SSD  
**Optimal**: 500+ GB NVMe SSD with RAID

**Storage Breakdown**:

| Component | Size | Growth Rate | Notes |
|-----------|------|-------------|-------|
| OS (Ubuntu) | 10 GB | Minimal | System files |
| Docker Images | 5 GB | Slow | Application containers |
| MongoDB Data | 20 GB | 5-10 GB/month | Projects, tasks, users |
| MongoDB Indexes | 5 GB | 1-2 GB/month | Query optimization |
| Uploads (Avatars) | 2 GB | 500 MB/month | User avatars |
| Uploads (Excel) | 5 GB | 2 GB/month | Project data files |
| Application Logs | 5 GB | 1 GB/month | Rotated logs |
| MongoDB Logs | 2 GB | 500 MB/month | Database logs |
| Backups (Local) | 30 GB | 5 GB/month | Weekly backups |
| Redis Snapshots | 1 GB | Slow | Cache persistence |
| Reserved/Overhead | 15 GB | - | System overhead |
| **Initial Total** | **~100 GB** | **~20 GB/month** | 6-month capacity: 200 GB |

**Storage Performance**:
- **SSD Required**: MongoDB requires fast I/O for indexes
- **NVMe Preferred**: 3-5x faster than standard SSD
- **IOPS**: Minimum 3,000 IOPS, recommended 10,000+ IOPS
- **Throughput**: 200 MB/s read, 100 MB/s write minimum

**Backup Storage** (Additional):
- Off-site backups: 50-100 GB (S3, BackBlaze, etc.)
- Retention: 30 days minimum
- Estimated cost: $5-$10/month

### 4. Network & Bandwidth

**Minimum**: 100 Mbps  
**Recommended**: 1 Gbps  
**Optimal**: 2+ Gbps for large teams

**Bandwidth Estimation**:

| Users | Avg. Page Size | Daily Usage | Monthly Bandwidth |
|-------|----------------|-------------|-------------------|
| 50 | 2 MB | 100 pages/user | 10 GB |
| 100 | 2 MB | 100 pages/user | 20 GB |
| 200 | 2 MB | 100 pages/user | 40 GB |
| 500 | 2 MB | 100 pages/user | 100 GB |

**Additional Bandwidth**:
- API calls: 50-100 GB/month
- File uploads: 10-20 GB/month
- Backups: 10 GB/month
- **Total** (100 users): ~150-200 GB/month

**Bandwidth Providers**:
- Most VPS providers include 1-2 TB/month
- Overage charges: $0.01-$0.10 per GB
- Recommended buffer: 2x expected usage

**Latency Requirements**:
- Internal services: < 1 ms
- User to server: < 100 ms (regional)
- Database queries: < 50 ms

---

## Scalability Considerations

### Vertical Scaling (Single Server)

**Easy Upgrades**:
1. **Add RAM**: Instant performance boost for caching
2. **Add CPU**: Handles more concurrent requests
3. **Upgrade Storage**: Migrate to larger SSD

**Limitations**:
- Single point of failure
- Maximum server size constraints
- Requires downtime for hardware upgrades

### Horizontal Scaling (Multi-Server)

**When to Scale Horizontally**:
- More than 200 concurrent users
- 24/7 uptime requirements
- Geographic distribution needed

**Scaling Strategy**:
```
Load Balancer (HAProxy/Nginx)
    ├── App Server 1 (8 vCPUs, 16 GB)
    ├── App Server 2 (8 vCPUs, 16 GB)
    └── App Server 3 (8 vCPUs, 16 GB)

Database Cluster
    ├── MongoDB Primary (16 vCPUs, 32 GB)
    ├── MongoDB Secondary (16 vCPUs, 32 GB)
    └── MongoDB Arbiter (2 vCPUs, 4 GB)

Cache Cluster
    ├── Redis Master (4 vCPUs, 8 GB)
    └── Redis Replica (4 vCPUs, 8 GB)
```

**Total Cost**: $800-$1,500/month

---

## Cost Estimation

### Initial Setup Costs

| Item | Cost Range | Notes |
|------|------------|-------|
| Server Purchase (if owned) | $2,000-$5,000 | One-time |
| Server Setup/Configuration | $500-$1,500 | Professional services |
| SSL Certificate | $0-$200/year | Let's Encrypt is free |
| Domain Name | $10-$50/year | .com domain |
| Monitoring Tools | $0-$100/month | Free tier available |
| **Total Initial** | **$2,500-$7,000** | One-time + first year |

### Monthly Operating Costs

#### Small Scale (50 users)
| Item | Monthly Cost |
|------|--------------|
| VPS Hosting | $50-$80 |
| Bandwidth | Included |
| Backups (S3) | $5 |
| Monitoring (optional) | $0-$20 |
| SSL Renewal | $0 (Let's Encrypt) |
| **Total Monthly** | **$55-$105** |
| **Annual** | **$660-$1,260** |

#### Medium Scale (100-200 users) ⭐ RECOMMENDED
| Item | Monthly Cost |
|------|--------------|
| VPS Hosting | $120-$200 |
| Bandwidth | Included |
| Backups (S3) | $10 |
| Monitoring | $20-$50 |
| Coroot Monitoring | Self-hosted (free) |
| SSL Renewal | $0 |
| **Total Monthly** | **$150-$260** |
| **Annual** | **$1,800-$3,120** |

#### Large Scale (200-500 users)
| Item | Monthly Cost |
|------|--------------|
| Dedicated Server or High-tier VPS | $300-$500 |
| Additional Bandwidth | $20-$50 |
| Backups + Redundancy | $30-$50 |
| Monitoring & Alerting | $50-$100 |
| **Total Monthly** | **$400-$700** |
| **Annual** | **$4,800-$8,400** |

### 3-Year Total Cost of Ownership (Medium Scale)

| Component | Year 1 | Year 2 | Year 3 | Total |
|-----------|--------|--------|--------|-------|
| Initial Setup | $1,500 | - | - | $1,500 |
| Monthly Hosting | $2,400 | $2,400 | $2,400 | $7,200 |
| Backups | $120 | $120 | $120 | $360 |
| Monitoring | $600 | $600 | $600 | $1,800 |
| Maintenance | $500 | $500 | $500 | $1,500 |
| Upgrades | - | $500 | $500 | $1,000 |
| **Total** | **$5,120** | **$4,120** | **$4,120** | **$13,360** |

**Per User Cost** (100 users): **$44/user/year**

---

## Recommended Server Specifications

### Option 1: Cloud VPS (Recommended for Start)

**Provider**: DigitalOcean / Linode / Vultr

**Configuration**:
- **CPU**: 8 vCPUs (AMD EPYC or Intel Xeon)
- **RAM**: 16 GB DDR4
- **Storage**: 200 GB NVMe SSD
- **Network**: 1 Gbps (4-5 TB bandwidth included)
- **Cost**: $120-$160/month

**Pros**:
- Easy to scale up/down
- No hardware maintenance
- Automatic backups available
- Multiple data center regions
- 99.9% uptime SLA

**Cons**:
- Monthly recurring cost
- Less control over hardware
- Potential noisy neighbor issues

### Option 2: Dedicated Server

**Provider**: Hetzner / OVH / Vultr Bare Metal

**Configuration**:
- **CPU**: Intel Xeon E-2288G (8 cores @ 3.7GHz)
- **RAM**: 32 GB DDR4 ECC
- **Storage**: 2x 512 GB NVMe SSD (RAID 1)
- **Network**: 1 Gbps unmetered
- **Cost**: $80-$150/month

**Pros**:
- Dedicated resources (no sharing)
- Better price for high specs
- Full hardware control
- Unmetered bandwidth often included

**Cons**:
- Harder to scale quickly
- You manage hardware issues
- Higher initial commitment

### Option 3: On-Premise Server (Own Hardware)

**Hardware**: Dell PowerEdge R250 or Similar

**Configuration**:
- **CPU**: Intel Xeon E-2388G (8 cores @ 3.2GHz)
- **RAM**: 32 GB DDR4 ECC
- **Storage**: 2x 960 GB SSD (RAID 1)
- **Network**: 1 Gbps NIC
- **Power**: 350W PSU
- **Cost**: $2,500-$4,000 one-time

**Ongoing Costs**:
- Electricity: $20-$40/month
- Internet: $50-$100/month
- Cooling: Included
- Maintenance: DIY

**Pros**:
- One-time purchase
- Complete control
- No monthly hosting fees
- Data stays on-premise

**Cons**:
- Higher upfront cost
- You handle all maintenance
- No SLA or redundancy
- Requires stable internet and power

---

## Storage Planning

### Database Growth Projections

**Assumptions**:
- 100 active users
- 10 projects with 5,000 jobs each
- 50 structural elements per project
- Daily task updates

| Time Period | Projects | Jobs | Elements | DB Size | Total Storage |
|-------------|----------|------|----------|---------|---------------|
| Initial | 10 | 50,000 | 500 | 20 GB | 100 GB |
| 6 months | 25 | 125,000 | 1,250 | 50 GB | 150 GB |
| 1 year | 50 | 250,000 | 2,500 | 100 GB | 200 GB |
| 2 years | 100 | 500,000 | 5,000 | 200 GB | 350 GB |
| 3 years | 150 | 750,000 | 7,500 | 300 GB | 500 GB |

**Recommendation**: Start with 200 GB, plan for 500 GB expansion

### Backup Storage

**Strategy**: 3-2-1 Backup Rule
- **3** copies of data
- **2** different storage types
- **1** off-site copy

**Implementation**:
1. Production data (server)
2. Local backup (same server, different volume)
3. Off-site backup (S3, BackBlaze B2, or remote server)

**Backup Schedule**:
- Daily incremental: 7 days retention
- Weekly full: 4 weeks retention
- Monthly archive: 12 months retention

**Storage Required**:
- Daily: 7 × 5 GB = 35 GB
- Weekly: 4 × 30 GB = 120 GB
- Monthly: 12 × 30 GB = 360 GB
- **Total**: ~500 GB for backups

**Cost**:
- S3 Standard: $11.52/month (500 GB)
- BackBlaze B2: $2.50/month (500 GB) ⭐ Recommended
- Wasabi: $5.99/month (1 TB minimum)

---

## Network Requirements

### Port Requirements

**Inbound (from internet)**:
- 80 (HTTP) - Redirects to HTTPS
- 443 (HTTPS) - Main application access
- 22 (SSH) - Server management (restrict to admin IPs)

**Internal (between services)**:
- 4000 (Auth Service)
- 4001 (Authorizer)
- 5000 (Backend API)
- 3001 (Engineer Client)
- 3002 (Admin Client)
- 6379 (Redis)
- 27017 (MongoDB)

**Monitoring (optional)**:
- 4318 (Coroot OTLP)
- 8080 (Coroot UI)

### Firewall Configuration

**Recommended Rules**:
```bash
# Allow SSH from specific IPs only
Allow 22/tcp from 203.0.113.0/24

# Allow HTTP/HTTPS from anywhere
Allow 80/tcp from anywhere
Allow 443/tcp from anywhere

# Allow monitoring from internal network
Allow 4318/tcp from 10.0.0.0/8
Allow 8080/tcp from 10.0.0.0/8

# Block all other inbound
Deny all other inbound

# Allow all outbound
Allow all outbound
```

### SSL/TLS Certificate

**Options**:
1. **Let's Encrypt** (FREE, auto-renewal)
   - 90-day validity
   - Automatic renewal via certbot
   - Recommended for most deployments

2. **Commercial SSL** ($50-$200/year)
   - Extended validation available
   - Wildcard certificates
   - Better for enterprise compliance

---

## Monitoring & Observability

### Resource Monitoring

**Metrics to Track**:
- CPU utilization (target: < 70% average)
- Memory usage (target: < 80%)
- Disk I/O (IOPS, throughput)
- Network bandwidth
- Disk space (alert at 75% full)

**Tools** (choose one):
- **Coroot** (recommended, already configured)
- Prometheus + Grafana
- Netdata (free, real-time)
- DataDog (paid, comprehensive)
- New Relic (paid, APM)

**Costs**:
- Self-hosted (Coroot, Prometheus): $0
- Netdata Cloud: $0-$20/month
- DataDog: $15-$100/month
- New Relic: $25-$99/month

### Application Monitoring

**Already Implemented**:
- OpenTelemetry instrumentation
- Coroot integration ready
- Application logs in `/logs`

**Additional Recommendations**:
- Error tracking (Sentry - $26/month or self-hosted)
- Uptime monitoring (UptimeRobot - free tier available)
- Log aggregation (ELK stack or Loki)

---

## Redundancy & High Availability

### Single Server Setup (99.5% uptime)

**Features**:
- Automated backups
- Docker container auto-restart
- Health checks and automatic recovery
- Manual failover to backup server

**Limitations**:
- Single point of failure
- Downtime during maintenance
- No automatic failover

**Cost**: Base server cost only

### High Availability Setup (99.9% uptime)

**Architecture**:
```
                    Internet
                       ↓
                 Load Balancer
                  /         \
          Server 1          Server 2
        (Active)          (Standby)
              \            /
           Shared Storage + DB Cluster
```

**Components**:
- 2 application servers ($240-$400/month)
- Load balancer ($10-$40/month)
- Shared storage or DB cluster ($100-$200/month)
- **Total**: $350-$640/month

**Benefits**:
- Zero-downtime deployments
- Automatic failover
- Rolling updates
- Geographic redundancy option

---

## Operating System Requirements

### Recommended OS

**Primary Choice**: **Ubuntu Server 22.04 LTS**

**Reasons**:
- Long-term support (until 2027)
- Excellent Docker support
- Large community
- Well-documented
- Free

**Alternatives**:
- CentOS Stream 9 / Rocky Linux 9
- Debian 12
- Red Hat Enterprise Linux 9 (paid support)

### Software Requirements

**Pre-installed**:
- Docker Engine 24.0+
- Docker Compose 2.20+
- Git 2.34+
- Nginx or Traefik (reverse proxy)
- Certbot (for SSL)
- Curl, wget, vim, htop, etc.

**Optional**:
- Fail2ban (security)
- UFW or firewalld (firewall)
- Logrotate (log management)
- Cron (scheduled tasks)

---

## Migration & Deployment Checklist

### Pre-Deployment

- [ ] Server provisioned and accessible
- [ ] Domain name registered and configured
- [ ] DNS records pointed to server IP
- [ ] Firewall rules configured
- [ ] SSL certificate obtained
- [ ] Backup storage configured
- [ ] Monitoring tools installed

### Deployment

- [ ] Install Docker and Docker Compose
- [ ] Clone application repository
- [ ] Configure environment variables
- [ ] Set up MongoDB with initial admin user
- [ ] Configure Redis
- [ ] Build and start Docker containers
- [ ] Configure Traefik/Nginx reverse proxy
- [ ] Test all services are running
- [ ] Verify SSL/HTTPS working

### Post-Deployment

- [ ] Import initial data / create test users
- [ ] Run backup test
- [ ] Configure automated backups
- [ ] Set up monitoring alerts
- [ ] Document admin procedures
- [ ] Train administrators
- [ ] Load testing (optional)

---

## Quick Cost Summary Table

| Scale | Users | Server Spec | Monthly Cost | Annual Cost | Setup Cost |
|-------|-------|-------------|--------------|-------------|------------|
| **Small** | 10-50 | 4 vCPU, 8 GB, 100 GB | $50-$80 | $600-$960 | $500-$1,000 |
| **Medium** ⭐ | 50-200 | 8 vCPU, 16 GB, 200 GB | $120-$200 | $1,440-$2,400 | $1,000-$1,500 |
| **Large** | 200-500 | 16 vCPU, 32 GB, 500 GB | $300-$500 | $3,600-$6,000 | $1,500-$2,500 |
| **Enterprise** | 500+ | Multi-server cluster | $1,000-$2,500 | $12,000-$30,000 | $3,000-$5,000 |

---

## Recommendation for Quotation

### Standard Deployment (Recommended)

**Configuration**:
- **Server**: 8 vCPU, 16 GB RAM, 200 GB NVMe SSD
- **Provider**: DigitalOcean, Linode, or Vultr
- **Location**: Choose closest to user base
- **Bandwidth**: 1 Gbps (3-5 TB included)

**Costs**:
- **Setup Fee**: $1,200 (one-time)
  - Server configuration
  - Application deployment
  - SSL setup
  - Initial backups
  - Documentation

- **Monthly Hosting**: $150
  - Server rental: $120
  - Backups (S3): $10
  - Monitoring: $20

- **Annual Total**: $1,200 + ($150 × 12) = **$3,000 first year**
- **Subsequent Years**: $1,800/year

**Capacity**: 100-200 concurrent users

### Premium Deployment (High Availability)

**Costs**:
- **Setup Fee**: $2,500
- **Monthly Hosting**: $500
- **Annual Total**: **$8,500 first year**

**Capacity**: 500+ concurrent users, 99.9% uptime

---

## Contact & Support

For questions about server specifications or deployment planning:

**Technical Contact**: [Your Name]  
**Email**: [your-email@company.com]  
**Documentation**: See `docs/` folder for deployment guides

---

**Document Control**
- **Author**: Development Team
- **Last Updated**: October 30, 2025
- **Next Review**: January 30, 2026
- **Version**: 1.0
