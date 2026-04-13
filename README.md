# Inventory & Maintenance Management System

This project is a multi-store inventory and maintenance platform with a React frontend and a refactored Node.js/Express/PostgreSQL backend.

## Current State

- Frontend branding, login flow, dashboard shell, and API wiring are implemented.
- Backend is refactored into controller, service, model, and route layers.
- Legacy inventory storage has been migrated toward an enterprise inventory design.
- Live database migration and repair scripts are included.

## Project Layout

```text
erp_system/
  backend/
  database/
  frontend/
```

## Backend Highlights

- JWT authentication
- Role-based access control
- Multi-store inventory architecture
- Inventory balance and financial ledger tracking
- Stock movements and request approvals
- Maintenance logging and item usage deduction
- Reporting endpoints for movements and valuation
- Cross-store request routing with `source_location_id` and destination `location_id`

See [backend/HANDOFF.md](./backend/HANDOFF.md) for backend architecture and operational notes.

## Database

The canonical schema and migration scripts are in [database/schema.sql](./database/schema.sql), [database/migrate_enterprise.sql](./database/migrate_enterprise.sql), [database/migrate_request_source_location.sql](./database/migrate_request_source_location.sql), and [database/repair_enterprise_data.sql](./database/repair_enterprise_data.sql).

## Request Workflow Seed

To seed demo users, locations, and stock for the request approval workflow:

```powershell
cd C:\Users\Prince\Desktop\erp_system\backend
npm run seed:request-demo
```

That script creates a source-store admin, destination-store staff user, and demo stock so you can test request creation and approval immediately.

## Run

### Local Development

Backend:

```powershell
cd C:\Users\Prince\Desktop\erp_system\backend
npm install
npm run dev
```

Frontend:

```powershell
cd C:\Users\Prince\Desktop\erp_system\frontend
npm install
npm run dev
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

## Verified URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Demo Login

After running `npm run seed:request-demo` in `backend/`:

- SuperAdmin: `superadmin@inventory.local` / `Test1234!`
- Main Store Admin: `admin@inventory.local` / `Test1234!`
- Main Store Staff: `staff@inventory.local` / `Test1234!`
- Annex Staff: `annex.staff@inventory.local` / `Test1234!`

## Additional Docs

- Architecture and handoff: [backend/HANDOFF.md](./backend/HANDOFF.md)
- API reference: [backend/API_REFERENCE.md](./backend/API_REFERENCE.md)
- Engineering review: [backend/REVIEW.md](./backend/REVIEW.md)
