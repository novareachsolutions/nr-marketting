# NR Marketing Komodo CI/CD Playbook

This folder defines the Komodo resources required to run automated CI/CD for
NR Marketing: Komodo orchestrates build, validation, and deployment after every
merge to `develop` and `staging-develop` branches.

## Files included

- `.komodo/variables.toml` – shared values consumed by every other resource.
- `.komodo/servers.toml` – Komodo server resource template for the VPS.
- `.komodo/stacks.toml` – stacks that monitor deployed docker compose services.
- `.komodo/actions.toml` – TypeScript actions that build images and deploy services.
- `.komodo/procedures.toml` – procedures wiring the build and deploy actions.
- `.komodo/resource-syncs.toml` – optional resource sync definition so Core can
  pull these files straight from git.

## 1. Set variables first

Edit `.komodo/variables.toml` so the defaults match your environment (server id,
repo path, branch names, directories). Komodo interpolates `[[VARIABLE_NAME]]`
placeholders in the other files.

```toml
[[variable]]
name = "NR_MARKETING_REPO_DIR"
description = "Absolute path to the NR Marketing repository on the VPS"
value = "/home/aahaddev/nr-marketting"
```

- Update `NR_MARKETING_SERVER_ID` to the name/id of your Komodo server resource.
- Adjust `NR_MARKETING_DEPLOY_DIR` and `NR_MARKETING_STAGING_DIR` if needed.
- Ensure `NR_MARKETING_GITHUB_REPOSITORY` matches your GitHub repo path.

## 2. Register the VPS server (if not already done)

Use `.komodo/servers.toml` as the source of truth when creating the server in
Komodo. Note: This reuses the same server as NRPOS since they run on the same VPS.

```toml
[[server]]
name = "server-nrpos"
[server.config]
address = "http://periphery:8120"
enabled = true
```

- Make sure Komodo Core can reach the Periphery agent before syncing resources.

## 3. Define the stacks for monitoring

`stacks.toml` defines stacks that allow Komodo to monitor the deployed services.
Actual deployment is handled by actions (not stacks) since RELEASE_TAG is dynamic.

```toml
[[stack]]
name = "nr-marketing-production-stack"
[stack.config]
server_id = "server-nrpos"
run_directory = "/home/aahaddev/nr-marketting/"
file_paths = ["docker-compose.prod.yml"]
```

- The stacks assume the compose files already live on the VPS
  (`files_on_host = true`).
- `run_build = false` because images are built by actions before deployment.

## 4. Actions powering the pipeline

`actions.toml` contains four actions you can paste directly into the Komodo UI if
needed.

### 4.1 Build action (`nr-marketing-build-images`)

Builds 4 Docker images from the `develop` branch for production deployment:
- api
- tenent-dashboard
- super-admin
- customer-website

The action:
1. Pulls latest code from the develop branch
2. Reads DATABASE_URL and NEXT_PUBLIC_API_URL from .env
3. Builds each Docker image with commit SHA as tag
4. Writes the SHA to `/tmp/nr-marketing-build-sha` for the deploy action
5. Sends email notifications on success/failure

### 4.2 Deploy action (`nr-marketing-deploy-production`)

Deploys the production stack using the images built in the previous step:
1. Reads SHA from `/tmp/nr-marketing-build-sha`
2. Runs `docker compose up` with RELEASE_TAG set to the SHA
3. Shows container health status
4. Sends email notifications on success/failure

### 4.3 Staging actions

Similar actions exist for staging:
- `nr-marketing-build-staging-images` – builds from `staging-develop` branch
- `nr-marketing-deploy-staging` – deploys to staging environment

Images built for staging are tagged with `staging-{SHA}` prefix.

## 5. Procedure wiring

`procedures.toml` exposes two procedures that tie everything together.

### Production procedure: `nr-marketing-develop-deploy`

```toml
[[procedure]]
name = "nr-marketing-develop-deploy"

[[procedure.config.stage]]
name = "Build production images"
executions = [
  { execution.type = "RunAction", execution.params.action = "nr-marketing-build-images" },
]

[[procedure.config.stage]]
name = "Deploy to production"
executions = [
  { execution.type = "RunAction", execution.params.action = "nr-marketing-deploy-production" },
]
```

### Staging procedure: `nr-marketing-staging-deploy`

Similar to production but runs staging build and deploy actions.

## 6. Sync the resources into Komodo

You have two options:

1. **Resource Sync (recommended):** Update `.komodo/resource-syncs.toml` with
   your git provider/account and point the sync at the repository. Trigger the
   sync from Komodo Core so it manages all of these resources automatically.
2. **Manual paste:** Copy each block above into the Komodo UI (Servers → Actions
   → Procedures → Stacks) and save.

If you use the Resource Sync, grant it `Execute` permissions on the server so
Komodo Core can run the actions.

## 7. Wire the GitHub webhooks

### For production (develop branch):

1. In Komodo, open the `nr-marketing-develop-deploy` procedure → _Config_ → copy
   the webhook URL for branch `develop`.
2. On GitHub, go to repository Settings → Webhooks → Add webhook:
   ```text
   https://<komodo-host>/listener/github/procedure/nr-marketing-develop-deploy/develop
   ```
   - Content type: `application/json`
   - Secret: Your `KOMODO_WEBHOOK_SECRET`
   - Events: Just the `push` event
   - Active: ✓

### For staging (staging-develop branch):

1. In Komodo, open the `nr-marketing-staging-deploy` procedure → _Config_ → copy
   the webhook URL for branch `staging-develop`.
2. On GitHub, create another webhook:
   ```text
   https://<komodo-host>/listener/github/procedure/nr-marketing-staging-deploy/staging-develop
   ```
   - Same settings as above

## 8. Environment setup

Ensure your `.env` file in the deployment directory contains:

```env
# Required for build
DATABASE_URL=postgresql://...
NEXT_PUBLIC_API_URL=https://api-nr-marketting.novareachsolutions.com

# Required for email notifications
SENDGRID_API_KEY=SG.xxxxx...

# Required for deployment
PROJECT_NAME=nr-marketing
GITHUB_REPOSITORY=novareachsolutions/nr-marketting
RELEASE_TAG=<will-be-set-by-actions>

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

## 9. Test the pipeline

### Manual test:

1. Trigger the procedure manually once from Komodo to confirm the VPS can build
   and deploy the images.
2. Observe the update logs to ensure each stage finishes successfully.
3. Check that containers are running: `docker ps`

### Automated test:

1. Create the `develop` and `staging-develop` branches in your GitHub repository:
   ```bash
   git checkout -b develop
   git push -u origin develop

   git checkout -b staging-develop
   git push -u origin staging-develop
   ```

2. Make a commit to the `develop` branch and push:
   ```bash
   git checkout develop
   echo "test" >> test.txt
   git add test.txt
   git commit -m "test: trigger CI/CD"
   git push
   ```

3. Check Komodo dashboard for the triggered procedure execution.
4. Verify you receive email notifications.

## 10. Operational notes

- The actions rely on `komodo.execute_terminal`, so the service user that runs
  them needs Terminal execute permissions on the server.
- Build artifacts (node_modules, docker layers) are cached by Docker.
- Email notifications are sent to the team on both success and failure.
- For rollbacks, manually set `RELEASE_TAG` to a previous SHA and redeploy:
  ```bash
  cd /home/aahaddev/nr-marketting
  RELEASE_TAG=abc1234 docker compose -f docker-compose.prod.yml up -d
  ```
- Images are tagged with commit SHAs for traceability.
- Staging images use `staging-{SHA}` prefix to avoid conflicts with production.

## 11. Differences from NRPOS setup

- **Package manager:** NR Marketing uses `pnpm` instead of `bun`
- **Services:** 4 services (api, tenent-dashboard, super-admin, customer-website)
- **Build args:** Requires DATABASE_URL and NEXT_PUBLIC_API_URL at build time
- **Compose file:** Uses `docker-compose.prod.yml` instead of `docker-compose.deploy.yml`
- **Project name:** Docker compose project is `app-deploy` (can be changed via PROJECT_NAME env var)

## 12. Troubleshooting

### Build fails:

- Check that DATABASE_URL is correctly set in .env
- Verify pnpm dependencies can be installed
- Check Docker build logs for specific errors

### Deploy fails:

- Ensure RELEASE_TAG is set correctly
- Verify docker compose file exists and is valid
- Check that previous containers are stopped properly

### Emails not sending:

- Verify SENDGRID_API_KEY is set in .env
- Check that the API key has send permissions
- Review SendGrid dashboard for delivery status
