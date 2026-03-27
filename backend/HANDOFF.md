# Backend Handoff

## Architecture

The backend now follows a layered structure:

- `config/`
  - database pool and transaction helpers
- `controllers/`
  - HTTP request/response handling
- `services/`
  - business logic and workflow orchestration
- `models/`
  - database queries and persistence concerns
- `middleware/`
  - authentication, roles, upload handling
- `routes/`
  - route registration and endpoint grouping
- `utils/`
  - reusable domain helpers

## Inventory Design

The inventory domain is split into:

- `items`
  - product definition only
- `locations`
  - stores or stockholding sites
- `store_sections`
  - optional bins, shelves, or sections within a location
- `inventory_balance`
  - current stock by item and location
- `stock_movements`
  - movement history
- `inventory_ledger`
  - financial stock tracking
- `inventory_counts`
  - physical stock count sessions
- `inventory_count_items`
  - line items for a stock count session

This removes direct stock dependency from the `items` record for new logic. Compatibility fields from the legacy database still exist in the live database, but the refactored services read from the balance and ledger model.

## Core Backend Files

- Database connection: [config/db.js](./config/db.js)
- Auth controller: [controllers/authController.js](./controllers/authController.js)
- Item controller: [controllers/itemController.js](./controllers/itemController.js)
- Movement controller: [controllers/movementController.js](./controllers/movementController.js)
- Request controller: [controllers/requestController.js](./controllers/requestController.js)
- Maintenance controller: [controllers/maintenanceController.js](./controllers/maintenanceController.js)
- Report controller: [controllers/reportController.js](./controllers/reportController.js)
- Inventory service: [services/inventoryService.js](./services/inventoryService.js)
- Movement service: [services/movementService.js](./services/movementService.js)
- Report service: [services/reportService.js](./services/reportService.js)

## Compatibility

Legacy endpoint paths kept alive:

- `/api/stock-movements`
- `/api/stock-requests`

They delegate to the refactored movement/request route stack so the existing frontend keeps working.

## Data Migration

Canonical database files:

- Schema: [../database/schema.sql](../database/schema.sql)
- Migration: [../database/migrate_enterprise.sql](../database/migrate_enterprise.sql)
- Request routing migration: [../database/migrate_request_source_location.sql](../database/migrate_request_source_location.sql)
- Data repair: [../database/repair_enterprise_data.sql](../database/repair_enterprise_data.sql)

What the migration handled:

- role normalization to `Staff`, `Admin`, `SuperAdmin`
- creation of `Main Store`
- user store assignment
- item metadata migration to `reorder_level` and `image_path`
- population of `inventory_balance`
- addition of movement cost and location fields
- creation and backfill of `inventory_ledger`
- request numbering and approval metadata
- maintenance cost fields
- alert and audit log support

## Running the Backend

```powershell
cd C:\Users\Prince\Desktop\erp_system\backend
npm run dev
```

Request demo seed:

```powershell
cd C:\Users\Prince\Desktop\erp_system\backend
npm run seed:request-demo
```

Environment file:

- [backend/.env](./.env)

Default local values already in use:

- `PORT=5000`
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_NAME=erp_system`

## Verified Auth

- `superadmin@inventory.local` / `Test1234!`
- `admin@inventory.local` / `Test1234!`
- `staff@inventory.local` / `Test1234!`
- `annex.staff@inventory.local` / `Test1234!`

## Key Operational Notes

- `Admin` users are store-scoped by `location_id`.
- `SuperAdmin` users can operate across all stores.
- request validation middleware is now applied at the route layer for auth, items, movements, requests, maintenance, reports, dashboard, alerts, and messaging
- Movement posting updates both `inventory_balance` and `inventory_ledger`.
- Transfer movements create two records internally: source `OUT`, destination `IN`.
- Stock requests now treat `location_id` as the destination/requesting store and `source_location_id` as the approving/source store.
- Daily movement reporting is exposed via `/api/movements/daily`.
- Inventory valuation reporting is exposed via `/api/reports/inventory-value`.
