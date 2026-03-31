# Environment Variables

## Required

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_db"

# Redis
REDIS_URL="redis://localhost:6379"
```

## Optional

```bash
# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# CORS
CORS_ORIGINS="http://localhost:3000"

# Email (for CI/CD notifications)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Docker

```bash
NODE_VERSION=20
REGISTRY=ghcr.io
IMAGE_TAG=latest
```

## GitHub Actions Secrets

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | Server IP/domain |
| `SSH_USER` | SSH username |
| `SSH_KEY` | Private SSH key |
| `DEPLOY_PATH` | Deployment directory |

## Service Ports

| Service | Port |
|---------|------|
| api | 4000 |
| tenent-dashboard | 3000 |
| super-admin | 3001 |
| customer-website | 3002 |
