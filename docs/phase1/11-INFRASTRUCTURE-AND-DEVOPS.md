# Phase 1 - Infrastructure & DevOps

> **Hosting:** VPS (Hetzner/DigitalOcean) for MVP, AWS/GCP for scale
> **Containers:** Docker + Docker Compose
> **CI/CD:** GitHub Actions
> **Reverse Proxy:** Nginx with Let's Encrypt SSL

---

## Table of Contents

- [Production Architecture](#production-architecture)
- [Server Requirements](#server-requirements)
- [Docker Production Setup](#docker-production-setup)
- [Nginx Configuration](#nginx-configuration)
- [SSL / HTTPS](#ssl--https)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment Process](#deployment-process)
- [Database Backups](#database-backups)
- [Monitoring & Logging](#monitoring--logging)
- [Security Hardening](#security-hardening)
- [Scaling Strategy](#scaling-strategy)
- [Cost Estimates](#cost-estimates)

---

## Production Architecture

```
                     INTERNET
                        |
                   +----+----+
                   |  DNS    |
                   | (CF/R53)|
                   +----+----+
                        |
                   +----+----+
                   |  Nginx  |  SSL termination
                   |  :80/443|  Reverse proxy
                   +----+----+
                        |
         +--------------+--------------+
         |              |              |
    +----+----+   +----+----+   +----+----+
    | Tenant  |   | Super   |   | Customer|
    | Dashboard|  | Admin   |   | Website |
    | :3000   |   | :3001   |   | :3002   |
    +---------+   +---------+   +---------+
                        |
                   +----+----+
                   | NestJS  |
                   |  API    |
                   |  :4000  |
                   +----+----+
                        |
              +---------+---------+
              |                   |
         +----+----+        +----+----+
         |PostgreSQL|       |  Redis  |
         |  :5432  |        |  :6379  |
         +---------+        +----+----+
                                  |
                            +----+----+
                            | BullMQ  |
                            | Workers |
                            +---------+
```

---

## Server Requirements

### MVP (up to ~100 users)

**Single VPS:**
- CPU: 4 vCPU
- RAM: 8 GB
- Storage: 80 GB SSD
- Bandwidth: 20 TB/month
- OS: Ubuntu 22.04 LTS

**Estimated cost:**
- Hetzner CPX31: ~$16/month
- DigitalOcean: ~$48/month
- AWS t3.large: ~$60/month

### Growth (100-1,000 users)

**App Server:**
- CPU: 8 vCPU
- RAM: 16 GB
- Storage: 160 GB SSD

**Managed Database:**
- Separate PostgreSQL instance (Hetzner Managed DB, AWS RDS, or DO Managed DB)
- 4 GB RAM, 50 GB storage

**Managed Redis:**
- Separate Redis instance (or continue co-hosted if load is manageable)

---

## Docker Production Setup

### docker-compose.prod.yml Structure

```yaml
# Runs all services on a single host
# PostgreSQL and Redis are internal (not exposed to internet)
# Only Nginx exposes ports 80/443

services:
  postgres:
    - Internal only (no port mapping to host)
    - Data persisted in named volume
    - Health check enabled

  redis:
    - Internal only
    - Persistence: RDB snapshots every 60 seconds

  api:
    - Built from Dockerfile (api-production target)
    - Environment from .env
    - Depends on: postgres (healthy), redis (healthy)
    - Internal network only (Nginx proxies to it)
    - Restart: unless-stopped

  tenant-dashboard:
    - Built from Dockerfile (tenent-dashboard-production target)
    - Internal network only
    - Restart: unless-stopped

  super-admin:
    - Built from Dockerfile (super-admin-production target)
    - Internal network only
    - Restart: unless-stopped

  customer-website:
    - Built from Dockerfile (customer-website-production target)
    - Internal network only
    - Restart: unless-stopped

  nginx:
    - Ports: 80:80, 443:443
    - Volumes: SSL certs, nginx config
    - Depends on: all services
    - Restart: unless-stopped
```

### Build Targets

The existing Dockerfile already has multi-stage builds:
- `api-production` — NestJS compiled, running with `node dist/main.js`
- `tenent-dashboard-production` — Next.js built, running with `next start`
- `super-admin-production` — Next.js built, running with `next start`
- `customer-website-production` — Next.js built, running with `next start`

---

## Nginx Configuration

### Domain Mapping

| Domain | Service | Port |
|--------|---------|------|
| `app.yourdomain.com` | Tenant Dashboard | 3000 |
| `admin.yourdomain.com` | Super Admin | 3001 |
| `yourdomain.com` / `www.yourdomain.com` | Customer Website | 3002 |
| `api.yourdomain.com` | NestJS API | 4000 |

### Nginx Config Template

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com app.yourdomain.com
                admin.yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}

# Customer Website
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://customer-website:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Tenant Dashboard
server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://tenent-dashboard:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # WebSocket support
    location /socket.io {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Stripe webhook (needs raw body)
    location /api/billing/webhook {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 10m;
    }

    # GitHub webhook (needs raw body for signature verification)
    location /api/github/webhook {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Hub-Signature-256 $http_x_hub_signature_256;
        client_max_body_size 10m;
    }

    location / {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10m;
    }
}

# Super Admin (restrict by IP in production)
server {
    listen 443 ssl http2;
    server_name admin.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Optional: IP whitelist for extra security
    # allow 1.2.3.4;
    # deny all;

    location / {
        proxy_pass http://super-admin:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## SSL / HTTPS

### Setup with Let's Encrypt (Certbot)

```bash
# Install certbot on host
sudo apt install certbot

# Get wildcard cert (or individual certs per subdomain)
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -d app.yourdomain.com \
  -d api.yourdomain.com \
  -d admin.yourdomain.com

# Auto-renewal (certbot adds cron automatically)
sudo certbot renew --dry-run
```

### SSL Best Practices

- Use TLS 1.2+ only (disable TLS 1.0/1.1)
- HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- OCSP stapling enabled
- Auto-renewal cron runs twice daily

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml

Trigger: Push to main branch

Steps:
  1. Checkout code
  2. Setup Node.js 20
  3. Install dependencies (pnpm install --frozen-lockfile)
  4. Run linting (pnpm lint)
  5. Run type checking (pnpm type-check)
  6. Run tests (pnpm test)
  7. Build all packages (pnpm build)
  8. SSH to production server
  9. Pull latest code
  10. Build Docker images
  11. Run database migrations
  12. Restart services with zero downtime
```

### Pipeline Stages

```
[Push to main]
      |
[Lint + Type Check]  -- Fail fast on code quality issues
      |
[Unit Tests]         -- Fail fast on broken logic
      |
[Build]              -- Ensure everything compiles
      |
[Deploy]             -- SSH to server, docker compose up
      |
[Health Check]       -- Verify /api/health returns 200
      |
[Notify]             -- Slack/email notification on success or failure
```

---

## Deployment Process

### Zero-Downtime Deploy

```bash
# On production server:

# 1. Pull latest code
git pull origin main

# 2. Build new images
docker compose -f docker-compose.prod.yml build

# 3. Run database migrations
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy

# 4. Rolling restart (one service at a time)
docker compose -f docker-compose.prod.yml up -d --no-deps api
docker compose -f docker-compose.prod.yml up -d --no-deps tenent-dashboard
docker compose -f docker-compose.prod.yml up -d --no-deps super-admin
docker compose -f docker-compose.prod.yml up -d --no-deps customer-website

# 5. Health check
curl -f https://api.yourdomain.com/api/health || echo "DEPLOY FAILED"
```

### Rollback

```bash
# If deploy fails:
# 1. Revert to previous git commit
git checkout HEAD~1

# 2. Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 3. Rollback database migration (if needed)
# Manual SQL rollback — Prisma doesn't have auto-rollback
# This is why we test migrations on staging first
```

---

## Database Backups

### Automated Backups

```bash
# Cron job on host: daily at 1 AM
0 1 * * * /opt/scripts/backup-db.sh

# backup-db.sh:
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/backups/postgres
RETENTION_DAYS=30

# Dump database
docker exec seo-postgres pg_dump -U postgres seo_platform_db | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Optional: upload to S3/Spaces
# aws s3 cp $BACKUP_DIR/backup_$TIMESTAMP.sql.gz s3://my-backups/
```

### Restore from Backup

```bash
# Decompress and restore
gunzip -c backup_20260331_010000.sql.gz | docker exec -i seo-postgres psql -U postgres seo_platform_db
```

### Backup Strategy

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Full DB dump | Daily 1 AM | 30 days | Local + S3 |
| WAL archiving | Continuous | 7 days | Local (future) |
| Pre-migration snapshot | Before each deploy | 7 days | Local |

---

## Monitoring & Logging

### Application Logging (Pino)

```
All logs: structured JSON format
Output: stdout (Docker captures to log driver)
Levels: error, warn, info, debug

Log format:
{
  "level": "info",
  "time": 1711900000000,
  "pid": 1,
  "hostname": "api-container",
  "reqId": "req-abc-123",
  "method": "GET",
  "url": "/api/projects",
  "statusCode": 200,
  "responseTime": 45,
  "userId": "clxyz123"
}
```

### Docker Log Management

```bash
# docker-compose.prod.yml log configuration per service:
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "5"
```

### Uptime Monitoring

**Uptime Kuma** (self-hosted, free):
- Monitor: `https://api.yourdomain.com/api/health`
- Check interval: 60 seconds
- Alert on 2 consecutive failures
- Alert via email or Slack webhook

### What to Monitor

| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| API health | Uptime Kuma | Down for 2 min |
| Response time | Uptime Kuma | > 5 seconds |
| Disk space | Cron + script | > 80% usage |
| Docker containers | `docker ps` check | Any container stopped |
| Database connections | Prisma metrics | > 80% pool used |
| Redis memory | Redis CLI | > 80% max memory |
| Job queue depth | Health endpoint | > 100 pending jobs |
| Failed jobs | Health endpoint | > 10 in 1 hour |

---

## Security Hardening

### Server Level

```bash
# Firewall (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# SSH hardening
- Disable password auth (key-only)
- Change default SSH port (optional)
- Disable root login
- Use fail2ban for brute force protection

# Auto security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Docker Security

```
- Run containers as non-root user
- Don't expose database ports to host (internal network only)
- Don't expose Redis port to host (internal network only)
- Use read-only file systems where possible
- Limit container memory and CPU
- Scan images for vulnerabilities (Trivy)
```

### Application Security Checklist

- [ ] All env vars stored securely (not in git)
- [ ] Database not accessible from internet
- [ ] Redis not accessible from internet
- [ ] CORS configured to allow only frontend origins
- [ ] Helmet middleware enabled (security headers)
- [ ] Rate limiting on all endpoints
- [ ] Input validation on all DTOs
- [ ] SQL injection prevented (Prisma parameterized queries)
- [ ] XSS prevented (Next.js auto-escaping + CSP header)
- [ ] CSRF prevented (SameSite cookies)
- [ ] Stripe webhooks verified by signature
- [ ] Google refresh tokens encrypted at rest
- [ ] JWT secrets are strong random strings (64+ chars)
- [ ] Passwords hashed with bcrypt (12 rounds)
- [ ] Super admin panel IP-restricted or VPN-only

---

## Scaling Strategy

### Phase 1 (MVP): Single Server

All services on one VPS. Simple, cheap, sufficient for 100 users.

### Phase 2 (Growth): Separate Database

```
Server 1: App (API + Frontends + Workers + Redis)
Server 2: Managed PostgreSQL (Hetzner/DO/AWS)
```

Separating the database is the first scaling step because:
- DB is the bottleneck first (queries, connections, disk I/O)
- Managed DB provides automated backups, failover, scaling
- App server can be replaced without data loss

### Phase 3 (Scale): Multiple App Servers

```
Load Balancer (Nginx/HAProxy)
  |
  +-- App Server 1 (API + Workers)
  +-- App Server 2 (API + Workers)
  +-- App Server 3 (Frontends)
  |
Managed PostgreSQL (read replica)
Managed Redis (cluster)
S3 for file storage (reports, log uploads)
```

---

## Cost Estimates

### Phase 1 MVP Monthly Costs

| Item | Provider | Cost |
|------|----------|------|
| VPS (4 vCPU, 8 GB RAM) | Hetzner CPX31 | $16 |
| Domain name | Namecheap | $1 (amortized) |
| SSL | Let's Encrypt | Free |
| DataForSEO API | DataForSEO | $10-50 |
| Claude API | Anthropic | $20-50 |
| SendGrid email | SendGrid | Free tier |
| Stripe fees | Stripe | 2.9% + 30c per txn |
| DNS | Cloudflare | Free |
| **Total (before revenue)** | | **$47-117/month** |

### Break-Even Calculation

```
Monthly costs: ~$100
Pro plan:      $49/month
Agency plan:   $199/month

Break-even: 3 Pro subscribers OR 1 Agency subscriber
```
