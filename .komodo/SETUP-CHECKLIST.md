# NR Marketing Komodo CI/CD Setup Checklist

## ✅ Completed

- [x] Created `.komodo/` directory with all configuration files
- [x] Created `variables.toml` with NR Marketing specific settings
- [x] Created `servers.toml` (reuses server-nrpos)
- [x] Created `stacks.toml` for production and staging monitoring
- [x] Created `actions.toml` with 4 actions (build/deploy for prod/staging)
- [x] Created `procedures.toml` with 2 webhook-enabled procedures
- [x] Created `resource-syncs.toml` for automatic resource syncing
- [x] Created `CI-CD.md` with complete documentation

## 📋 Next Steps

### 1. Create Git Branches

Currently, nr-marketting only has a `main` branch. You need to create:

```bash
cd /home/aahaddev/nr-marketting

# Create and push develop branch
git checkout -b develop
git push -u origin develop

# Create and push staging-develop branch
git checkout -b staging-develop
git push -u origin staging-develop

# Return to main
git checkout main
```

### 2. Commit Komodo Configuration to Git

```bash
cd /home/aahaddev/nr-marketting
git add .komodo/
git commit -m "feat: add Komodo CI/CD configuration"
git push origin main

# Also push to develop
git checkout develop
git merge main
git push origin develop
```

### 3. Configure Komodo Server (if needed)

If the server is not already configured in Komodo:

1. Open Komodo UI
2. Go to **Servers** → **Create Server**
3. Use settings from `.komodo/servers.toml`:
   - Name: `server-nrpos`
   - Address: `http://periphery:8120`
   - Region: `primary`
   - Enable: ✓

### 4. Sync Resources to Komodo

**Option A: Resource Sync (Recommended)**

1. In Komodo UI, go to **Resource Syncs**
2. Create new sync using `.komodo/resource-syncs.toml`:
   - Name: `nr-marketing-ci-cd`
   - Git Provider: `github.com`
   - Account: `novareachsolutions`
   - Repo: `novareachsolutions/nr-marketting`
   - Branch: `main`
   - Resource paths: (from resource-syncs.toml)
3. Trigger the sync to import all resources
4. Grant the sync **Execute** permissions on `server-nrpos`

**Option B: Manual Import**

Copy and paste content from each `.toml` file into Komodo UI:
1. Variables → Create from `variables.toml`
2. Servers → Create from `servers.toml`
3. Stacks → Create from `stacks.toml`
4. Actions → Create from `actions.toml`
5. Procedures → Create from `procedures.toml`

### 5. Configure GitHub Webhooks

#### For Production (develop branch):

1. Go to https://github.com/novareachsolutions/nr-marketting/settings/hooks
2. Click **Add webhook**
3. Configure:
   - **Payload URL:** `https://<your-komodo-host>/listener/github/procedure/nr-marketing-develop-deploy/develop`
   - **Content type:** `application/json`
   - **Secret:** Your `KOMODO_WEBHOOK_SECRET`
   - **Events:** Just the push event
   - **Active:** ✓
4. Save

#### For Staging (staging-develop branch):

1. Add another webhook:
   - **Payload URL:** `https://<your-komodo-host>/listener/github/procedure/nr-marketing-staging-deploy/staging-develop`
   - Same settings as above
2. Save

### 6. Verify Environment Variables

Ensure `.env` in `/home/aahaddev/nr-marketting/` contains:

```env
# Required for build
DATABASE_URL=postgresql://user:pass@host:5432/nr_marketing_db
NEXT_PUBLIC_API_URL=https://api-nr-marketting.novareachsolutions.com

# Required for email notifications
SENDGRID_API_KEY=SG.xxxxx...

# Required for deployment
PROJECT_NAME=nr-marketing
GITHUB_REPOSITORY=novareachsolutions/nr-marketting

# Service ports
API_PORT=4000
TENENT_DASHBOARD_PORT=3000
SUPER_ADMIN_PORT=3001
CUSTOMER_WEBSITE_PORT=3002

# Database credentials
DATABASE_USER=postgres
DATABASE_PASSWORD=<your-password>
DATABASE_NAME=nr_marketing_db
```

### 7. Create Staging Environment (if needed)

If staging will run on a different user's directory:

```bash
# Create staging directory
sudo mkdir -p /home/azizdev/nr-marketting
sudo chown azizdev:shared /home/azizdev/nr-marketting

# Clone repo for staging
cd /home/azizdev
git clone https://github.com/novareachsolutions/nr-marketting.git

# Copy .env and adjust for staging
cp /home/aahaddev/nr-marketting/.env /home/azizdev/nr-marketting/.env
# Edit the staging .env with staging-specific values
```

### 8. Test the Pipeline

#### Manual Test (Recommended First):

1. Open Komodo UI
2. Go to **Procedures** → `nr-marketing-develop-deploy`
3. Click **Run** to trigger manually
4. Watch the logs to ensure:
   - Build completes successfully
   - Deploy completes successfully
   - Containers are running
   - Email notification is sent

#### Automated Test:

1. Make a test commit to `develop`:
   ```bash
   cd /home/aahaddev/nr-marketting
   git checkout develop
   echo "# Test CI/CD" >> test-cicd.txt
   git add test-cicd.txt
   git commit -m "test: trigger CI/CD pipeline"
   git push origin develop
   ```

2. Webhook should trigger the procedure automatically
3. Check Komodo dashboard for execution status
4. Verify email notification received

### 9. Monitor First Deployment

After first successful deployment, verify:

```bash
# Check running containers
docker ps --filter "label=com.docker.compose.project=app-deploy"

# Check container logs
docker logs app-api
docker logs app-tenent-dashboard
docker logs app-super-admin
docker logs app-customer-website

# Check health endpoints
curl http://localhost:4000/health
curl http://localhost:3000/
curl http://localhost:3001/
curl http://localhost:3002/
```

## 🔄 Comparison with NRPOS Setup

| Aspect | NRPOS | NR Marketing |
|--------|-------|--------------|
| **Package Manager** | Bun | pnpm |
| **Services** | api, customer-web, admin, super-admin | api, tenent-dashboard, super-admin, customer-website |
| **Compose File** | docker-compose.deploy.yml | docker-compose.prod.yml |
| **Project Name** | nrpos-deploy | app-deploy |
| **Image Prefix** | ghcr.io/novareach-solutions/nrpos | ghcr.io/novareachsolutions/nr-marketting |
| **Build Args** | NEXT_PUBLIC_MAPBOX_TOKEN | DATABASE_URL, NEXT_PUBLIC_API_URL |
| **Dockerfile** | Dockerfile.base | Dockerfile |
| **Prod Directory** | /home/aahaddev/nrpos | /home/aahaddev/nr-marketting |
| **Staging Directory** | /home/azizdev/nrpos | /home/azizdev/nr-marketting |
| **Terminal Prefix** | nrpos-ci | nr-marketing-ci |

## 📝 Notes

- Both projects use the same VPS server (`server-nrpos`)
- Both use the same email notification recipients
- Both use SendGrid for email notifications
- Both follow the same webhook → procedure → actions → deployment flow
- Staging images are tagged with `staging-{SHA}` prefix
- Production images are tagged with just `{SHA}`

## ⚠️ Important

Before enabling webhooks, ensure:
1. Manual test passes successfully
2. `.env` files are properly configured
3. Docker images can be built without errors
4. Database is accessible
5. All services start correctly

## 🆘 Troubleshooting

If build fails:
- Check `DATABASE_URL` in .env
- Verify pnpm can install dependencies
- Check Docker build logs

If deploy fails:
- Verify RELEASE_TAG is set correctly
- Check compose file syntax
- Ensure previous containers stopped properly

If emails not sending:
- Verify `SENDGRID_API_KEY` in .env
- Check SendGrid dashboard for errors
- Verify API key has send permissions
