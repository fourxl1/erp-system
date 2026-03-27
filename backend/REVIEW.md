# Engineering Review

This review focuses on the remaining risks after the refactor and migration work.

## Findings

### 1. Legacy columns still exist in the live database

The backend logic is now centered on `inventory_balance` and `inventory_ledger`, but the migrated database still contains older compatibility columns like `items.current_quantity`, `items.minimum_quantity`, and `items.cost_usd`.

Risk:

- future developers may accidentally read or write legacy columns and bypass the enterprise model

Recommended next step:

- add a controlled deprecation plan for legacy columns
- remove old-column references once every endpoint and script is fully off them

### 2. Input validation is now present, but not yet schema-library based

The backend now enforces route-level validation through shared middleware, but it still uses custom validation helpers rather than a dedicated schema library.

Risk:

- validation is better than before, but schema reuse and coercion are still custom
- API error responses are improved, but not yet fully standardized across every future extension

Recommended next step:

- adopt a formal schema validation library if you want stronger typing, coercion, and reusable contracts

### 3. Migration scripts are strong for the current local data set, but not yet generalized as versioned migrations

Current migration is implemented as SQL scripts, not a full migration chain with up/down version tracking.

Risk:

- deployment to new environments can become manual
- repeatable promotion across dev/test/prod is weaker than it should be

Recommended next step:

- adopt a migration runner or versioned migration strategy

### 4. Messaging remains on the older direct-controller pattern

Messaging is still mounted and working, but it has not yet been fully refactored into its own service/model layers.

Risk:

- architecture is mostly consistent, but not fully uniform

Recommended next step:

- refactor messages into service/model layers to match the rest of the backend

### 5. Reporting coverage is good, but not complete for every historical report variant from the older controller

The enterprise reporting endpoints are implemented, especially movement and valuation reporting, but the old all-in-one reporting controller had broader ad hoc exports.

Risk:

- if a specific old report variant is still expected by users, it may need explicit reimplementation on the new reporting service

Recommended next step:

- inventory all required report outputs and formalize each one under the new reporting API

## Overall Assessment

The backend is in a strong, handoff-ready state:

- architecture is substantially refactored
- live database migration has been applied
- major inventory logic now uses enterprise balance and ledger patterns
- current frontend compatibility has been preserved

The remaining work is mostly hardening, standardization, and cleanup rather than foundational architecture.
