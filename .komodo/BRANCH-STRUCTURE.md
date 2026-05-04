# NR Marketing Branch Structure

## Branch Strategy

**Production:** `main` branch
- Triggers: `nr-marketing-production-deploy` procedure
- Deploys to: `/home/aahaddev/nr-marketting/`
- Docker images tagged with: `{SHA}`

**Staging:** `develop` branch  
- Triggers: `nr-marketing-staging-deploy` procedure
- Deploys to: `/home/azizdev/nr-marketting/`
- Docker images tagged with: `staging-{SHA}`

## Workflow

1. Develop features on feature branches
2. Merge feature branches → `develop` (triggers staging deployment)
3. Test on staging environment
4. Merge `develop` → `main` (triggers production deployment)

## GitHub Webhooks

**Production webhook:**
```
https://<komodo-host>/listener/github/procedure/nr-marketing-production-deploy/main
```

**Staging webhook:**
```
https://<komodo-host>/listener/github/procedure/nr-marketing-staging-deploy/develop
```

## Comparison with NRPOS

| Project | Production Branch | Staging Branch |
|---------|------------------|----------------|
| NRPOS | develop | staging-develop |
| NR Marketing | **main** | **develop** |

NR Marketing follows a more standard Git workflow where `main` is the production branch.
