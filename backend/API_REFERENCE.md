# API Reference

## Auth

### `POST /api/auth/login`

Body:

```json
{
  "email": "admin@inventory.local",
  "password": "Test1234!"
}
```

Returns:

- JWT token
- authenticated user payload

### `GET /api/auth/me`

Headers:

- `Authorization: Bearer <token>`

Returns current authenticated user.

## Items

### `GET /api/items`

Query params:

- `category_id`
- `search`
- `location_id`

Returns active items with computed `current_quantity`.

### `GET /api/items/:id`

Query params:

- `location_id`

Returns one item plus per-location balances.

### `POST /api/items`

Multipart form data:

- `name`
- `category_id`
- `unit`
- `description`
- `reorder_level`
- `image`

### `PUT /api/items/:id`

Same structure as create.

### `DELETE /api/items/:id`

Soft-deletes the item by marking it inactive.

### `GET /api/items/stats`

Query params:

- `location_id`

Returns:

```json
{
  "totalItems": 6,
  "lowStock": 2,
  "totalValue": 1144
}
```

## Movements

### `GET /api/movements`

Query params:

- `item_id`
- `location_id`
- `movement_type`
- `start_date`
- `end_date`

### `GET /api/movements/daily`

Query params:

- `date`
- `item_id`
- `location_id`
- `movement_type`

Returns:

- `item_name`
- `item_image`
- `movement_type`
- `quantity`
- `location`
- `section`
- `asset`
- `reference`
- `entered_by`
- `timestamp`

### `POST /api/movements`

Body for standard movement:

```json
{
  "item_id": 14,
  "location_id": 1,
  "movement_type": "OUT",
  "quantity": 1,
  "unit_cost": 1,
  "reference": "JOB-219"
}
```

Supported movement types:

- `IN`
- `OUT`
- `TRANSFER`
- `MAINTENANCE`
- `ADJUSTMENT`
- `ASSET_ISSUE`

Transfer body requires:

- `source_location_id`
- `destination_location_id`

Compatibility alias:

- `POST /api/stock-movements`

## Requests

### `GET /api/requests`

Query params:

- `location_id`
- `source_location_id`
- `status`

Notes:

- `location_id` is the destination/requesting store
- `source_location_id` is the source/approving store

### `GET /api/requests/locations`

Returns active locations for request routing.

### `GET /api/requests/:id`

Returns request header and request items.

### `POST /api/requests`

Body:

```json
{
  "location_id": 1,
  "source_location_id": 2,
  "notes": "Need stock for production",
  "items": [
    {
      "item_id": 1,
      "quantity": 2,
      "unit_cost": 900
    }
  ]
}
```

### `POST /api/requests/:id/approve`

Optional body:

```json
{
  "reference": "REQ-101"
}
```

### `POST /api/requests/:id/reject`

Body:

```json
{
  "reason": "Insufficient justification"
}
```

Compatibility alias:

- `/api/stock-requests`

## Maintenance

### `POST /api/maintenance/log`

Body:

```json
{
  "asset_id": 1,
  "location_id": 1,
  "description": "Routine service",
  "reference": "JOB-219",
  "items_used": [
    {
      "item_id": 1,
      "quantity": 1,
      "unit_cost": 900
    }
  ]
}
```

### `GET /api/maintenance/history`

Query params:

- `asset_id`
- `location_id`

### `GET /api/maintenance/:id/items`

Returns material consumed for one maintenance log.

### `GET /api/maintenance/asset/:asset_id`

Returns history for one asset.

## Reports

### `GET /api/reports/movements`

Query params:

- `item_id`
- `category_id`
- `location_id`
- `movement_type`
- `start_date`
- `end_date`

### `GET /api/reports/movements/pdf`

Exports professional item movement report PDF.

### `GET /api/reports/movements/csv`

Exports movement report CSV.

### `GET /api/reports/inventory-value`

Query params:

- `item_id`
- `category_id`
- `location_id`

Returns:

- `item`
- `current_quantity`
- `average_cost`
- `total_value`

## Dashboard

### `GET /api/dashboard`

Returns:

- summary stats
- recent movements
- low stock items
- recent requests

### `GET /api/dashboard/stats`
### `GET /api/dashboard/recent-movements`
### `GET /api/dashboard/low-stock`
### `GET /api/dashboard/recent-requests`
### `GET /api/dashboard/inventory-value`

## Alerts

### `GET /api/alerts`

Returns current stored system alerts.

## Messages

### `GET /api/messages`
### `POST /api/messages`
### `PUT /api/messages/:id/read`

These remain available for the internal messaging workflow.
