# Module 2 — Projects / Workspace

> **Status:** ✅ Complete
> **Completed:** 2026-04-01
> **Scope:** Backend (NestJS) + Frontend (Next.js)

---

## Overview

Projects are the core entity of the platform. Every SEO feature (keywords, rank tracking, site audit, AI, reports) is scoped to a project. A project represents a website domain the user wants to track.

---

## What Was Built

### Backend (NestJS API)

**Project Endpoints — 8 routes under `/api/projects/`**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/projects` | JWT | List user's projects with counts (keywords, competitors, audits) |
| `POST` | `/api/projects` | JWT | Create project (domain normalized, plan limit enforced) |
| `GET` | `/api/projects/:id` | JWT + Owner | Get project detail + competitors + all counts |
| `PUT` | `/api/projects/:id` | JWT + Owner | Update name, timezone, active status |
| `DELETE` | `/api/projects/:id` | JWT + Owner | Delete project + all cascading data |
| `GET` | `/api/projects/:id/competitors` | JWT + Owner | List competitors |
| `POST` | `/api/projects/:id/competitors` | JWT + Owner | Add competitor (plan limit enforced) |
| `DELETE` | `/api/projects/:id/competitors/:cId` | JWT + Owner | Remove competitor |

**Business Logic:**

- **Domain normalization** on every create:
  - Strips `http://`, `https://`, `www.`
  - Lowercases everything
  - Removes trailing `/`
  - `https://WWW.MyWebsite.com/` → `mywebsite.com`

- **Uniqueness:** A user cannot add the same domain twice (enforced at DB + service level)

- **Plan limits enforced at creation:**

| Feature | FREE | PRO | AGENCY |
|---------|------|-----|--------|
| Max projects | 1 | 5 | 25 |
| Competitors per project | 2 | 5 | 10 |

- **Cascade deletion:** Deleting a project removes all related keywords, rankings, crawls, reports, conversations, WP/GitHub connections

**Guards:**

| Guard | Purpose |
|-------|---------|
| `ProjectOwnerGuard` | Verifies user owns the project (SUPER_ADMIN bypasses) |
| `PlanLimitGuard` | Generic guard for checking any plan limit via decorator |

**Shared Constants:**
- `PLAN_LIMITS` — centralized plan limits config used across all modules

---

### Frontend (Tenant Dashboard)

**Pages:**

| Route | Description |
|-------|-------------|
| `/dashboard` | Updated — shows project cards grid, "New Project" button with plan limit, delete confirmation |
| `/dashboard/projects/[id]` | Project detail — stats row, competitors CRUD, settings, danger zone |

**Components:**

| Component | Description |
|-----------|-------------|
| `ProjectCard` | Card showing domain icon, name, domain, source badge, stats (keywords/competitors/audits), delete button |
| `CreateProjectModal` | Modal with domain + name inputs, error handling, auto-close on success |
| `Modal` | Reusable modal component with overlay, header, body, footer, ESC to close |

---

## File Inventory

### Backend — `apps/backend/api/src/`

```
common/
  constants/
    plan-limits.ts             — PLAN_LIMITS config (FREE/PRO/AGENCY limits)
  guards/
    project-owner.guard.ts     — Verifies user owns the project
    plan-limit.guard.ts        — Generic plan limit checking guard
  decorators/
    plan-limit.decorator.ts    — @CheckPlanLimit() decorator

projects/
  projects.module.ts           — Module definition
  projects.controller.ts       — 8 endpoints (CRUD + competitors)
  projects.service.ts          — Business logic, domain normalization, plan enforcement
  dto/
    index.ts                   — Barrel export
    create-project.dto.ts      — domain + name + optional timezone/sourceType
    update-project.dto.ts      — optional name/timezone/isActive
    add-competitor.dto.ts      — domain + optional name
```

### Frontend — `apps/frontend/tenent-dashboard/`

```
types/
  project.ts                   — Project and Competitor TypeScript interfaces

hooks/
  useProjects.ts               — React Query hooks (useProjects, useProject, useCreateProject, etc.)

components/
  projects/
    ProjectCard.tsx            — Project card component with stats
    ProjectCard.module.css     — Card styles
    CreateProjectModal.tsx     — Create project modal form
  ui/
    Modal.tsx                  — Reusable modal component
    Modal.module.css           — Modal styles

pages/
  dashboard/
    index.tsx                  — Updated with projects grid, create modal, delete
    index.module.css           — Added projectsGrid, pageHeader, createBtn styles
  dashboard/projects/
    [id].tsx                   — Project detail page with competitors
    [id].module.css            — Detail page styles
```

### Modified Files

```
apps/backend/api/src/app.module.ts    — Added ProjectsModule, fixed throttler config
```

---

## Dependencies Added

No new dependencies — uses existing NestJS, Prisma, and React Query setup from Module 1.

---

## Known Limitations / TODOs

- [ ] **Edit project modal** — currently no inline editing UI (PUT endpoint exists, no frontend form yet)
- [ ] **WordPress connection** — POST `/projects/:id/wordpress/connect` not yet implemented
- [ ] **GitHub connection** — OAuth flow + repo selection not yet implemented
- [ ] **Project dashboard** — stats are showing counts only; actual keyword/audit data comes from future modules
- [ ] **Pagination** — project list not paginated (fine for Phase 1 limits of max 25 projects)
- [ ] **Search/filter** — no search bar on projects list yet

---

## How to Test

1. Login at `http://localhost:3001/login`
2. Click **"+ New Project"** on dashboard
3. Enter domain (e.g. `https://WWW.Example.com/`) and name → creates with normalized domain
4. Click project card → project detail page
5. Add competitors (up to plan limit) in the competitors section
6. Remove a competitor → click "Remove"
7. Delete project → "Danger Zone" section at bottom
8. Try creating more projects than plan allows → should show error
