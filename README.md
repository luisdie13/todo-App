# SecureCollab

A collaborative task management platform built with security-first principles. SecureCollab enforces multi-layer access control (ABAC), AES-256-GCM encryption for sensitive task descriptions, rate limiting, JWT-based authentication with silent token refresh, and a comprehensive audit trail — all deployable as a single `docker compose up -d` command.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Security Features](#security-features)
3. [Quick Start (Zero Configuration)](#quick-start-zero-configuration)
4. [Environment Variables](#environment-variables)
5. [API Reference](#api-reference)
6. [Role & Permission Matrix](#role--permission-matrix)
7. [Seeded Test Accounts](#seeded-test-accounts)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                                                          │
│  ┌──────────────────┐     ┌──────────────────────────┐  │
│  │  React Frontend  │────▶│   Node.js / Express API  │  │
│  │  (Vite, port 80) │     │   (port 3000)            │  │
│  └──────────────────┘     └────────────┬─────────────┘  │
│                                         │                │
│                            ┌────────────▼─────────────┐  │
│                            │     MongoDB 7             │  │
│                            │     (port 27017)          │  │
│                            └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Backend stack:** Node.js 20 · Express 4 · Mongoose 8 · JWT (RS256) · bcrypt · helmet · express-rate-limit · DOMPurify  
**Frontend stack:** React 18 · Vite · Axios (interceptor-based token refresh) · DOMPurify

---

## Security Features

| Feature | Implementation |
|---|---|
| Authentication | JWT access token (15 min) + HttpOnly refresh token (7 days) |
| Silent token refresh | Axios response interceptor with in-memory queue |
| Password hashing | bcrypt, 12 rounds |
| Sensitive task encryption | AES-256-GCM — description encrypted at rest; decrypted only for assignee / project_admin |
| ABAC policies | `src/policies/abac.policy.js` — evaluated per-resource, per-action |
| Role hierarchy | `super_admin` → `org_admin` → `project_admin` → `developer` → `viewer` |
| Rate limiting | 100 req / 15 min (global); 5 req / 15 min (auth endpoints) |
| Audit logging | Every auth, task, project, and admin action recorded in `AuditLog` collection |
| Input sanitisation | DOMPurify on all frontend string inputs before dispatch |
| Inactive account block | `isActive` check in JWT middleware — deactivated accounts are rejected in real time |

---

## Quick Start (Zero Configuration)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 4.x  
- Ports **3000**, **27017**, and **80** available on the host

### 1. Clone the repository

```bash
git clone https://github.com/luisdie13/todo-App.git
cd todo-App
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in the required values (see Environment Variables below)
```

### 3. Start all services

```bash
docker compose up -d
```

The compose file starts three services:

| Service | Container | Host port |
|---|---|---|
| MongoDB | `securecollab-mongo` | 27017 |
| API | `securecollab-api` | 3000 |
| Frontend | `securecollab-frontend` | 80 |

### 4. Seed the database (first run only)

```bash
docker compose exec api node scripts/seedDatabase.js
```

The seed script creates five users, two organisations, three projects, and sample tasks (including encrypted sensitive tasks).

### 5. Open the application

```
http://localhost
```

---

## Environment Variables

Copy `.env.example` to `.env` and replace every placeholder:

```env
# ── MongoDB ──────────────────────────────────────────────────────────────────
MONGO_URI=mongodb://mongo:27017/securecollab

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET=<replace-with-a-256-bit-random-string>
JWT_REFRESH_SECRET=<replace-with-a-different-256-bit-random-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── Encryption (AES-256-GCM for sensitive task descriptions) ──────────────────
ENCRYPTION_KEY=<replace-with-64-hex-chars-32-bytes>

# ── Server ───────────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=production

# ── CORS ─────────────────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost
```

> **Never commit your `.env` file.** It is listed in `.gitignore`.

---

## API Reference

All endpoints are prefixed with `/api`.

### Authentication

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Login — returns access token + sets refresh cookie |
| `POST` | `/auth/registro` | Register a new user account |
| `POST` | `/auth/logout` | Invalidate the refresh token |
| `POST` | `/auth/refresh` | Silent token refresh via HttpOnly cookie |

### Projects

| Method | Path | Access |
|---|---|---|
| `GET` | `/projects` | Authenticated users |
| `GET` | `/projects/:id` | Project members |
| `PUT` | `/projects/:id` | `project_admin` |
| `DELETE` | `/projects/:id` | `project_admin` |
| `PUT` | `/projects/:id/archive` | `project_admin` |
| `GET` | `/projects/:id/members` | Project members |

### Tasks

| Method | Path | Access |
|---|---|---|
| `GET` | `/projects/:id/tasks` | Project members |
| `POST` | `/projects/:id/tasks` | `project_admin`, `developer` (viewers blocked) |
| `PUT` | `/tasks/:taskId` | `project_admin`; `developer` (own tasks only) |
| `DELETE` | `/tasks/:taskId` | `project_admin` only |

### Admin (super_admin only)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/users` | List all users (paginated, searchable) |
| `PUT` | `/admin/users/:id/toggle-status` | Toggle `isActive` flag |
| `PATCH` | `/admin/users/:id/deactivate` | Deactivate a user account |
| `GET` | `/admin/audit-logs` | Paginated audit log records |
| `GET` | `/admin/audit-stats` | Aggregate statistics |

---

## Role & Permission Matrix

| Action | `super_admin` | `org_admin` | `project_admin` | `developer` | `viewer` |
|---|:---:|:---:|:---:|:---:|:---:|
| View audit logs | ✅ | ❌ | ❌ | ❌ | ❌ |
| Toggle user status | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit organisation metadata | ❌¹ | ✅ | ❌ | ❌ | ❌ |
| Create project | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create task | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit any task | ✅ | — | ✅ | own only | ❌ |
| Delete task | ✅ | — | ✅ | ❌ | ❌ |
| View sensitive description | ✅ | — | ✅ | assignee only | ❌ |

> ¹ `super_admin` may **not** edit organisation metadata unless they hold an explicit membership in that organisation (minimum-privilege ABAC rule).

---

## Seeded Test Accounts

| Email | Password | Role | Notes |
|---|---|---|---|
| `admin@todoapp.com` | `Admin123!` | `super_admin` | Full platform access + admin console |
| `alice@todoapp.com` | `Alice123!` | `user` | `org_admin` of Org A; `project_admin` of Project 1 |
| `bob@todoapp.com` | `Bob123!` | `user` | `developer` in Project 1 |
| `carol@todoapp.com` | `Carol123!` | `user` | `viewer` in Project 1 — cannot create/edit tasks |
| `dave@todoapp.com` | `Dave123!` | `user` | Account **deactivated** — login rejected in real time |
