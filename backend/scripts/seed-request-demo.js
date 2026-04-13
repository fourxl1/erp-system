const bcryptjs = require("bcryptjs");
const { pool } = require("../config/db");

const DEMO_PASSWORD = "Test1234!";

function formatErrorDetails(error) {
  if (!error) {
    return "Unknown error";
  }

  const details = [];

  if (error.message) {
    details.push(error.message);
  }

  if (error.code) {
    details.push(`code=${error.code}`);
  }

  if (error.address) {
    details.push(`address=${error.address}`);
  }

  if (error.port) {
    details.push(`port=${error.port}`);
  }

  if (Array.isArray(error.errors)) {
    error.errors.forEach((innerError) => {
      const innerDetails = formatErrorDetails(innerError);
      if (innerDetails) {
        details.push(innerDetails);
      }
    });
  }

  return details.length > 0 ? details.join("; ") : String(error);
}

async function upsertLocations(client) {
  await client.query(
    `
      INSERT INTO locations (name, code, address, is_active)
      VALUES
        ('Main Store', 'MAIN', '123 Main St, New York, NY 10001', TRUE),
        ('Annex Store', 'ANNEX', '456 Annex Ave, Brooklyn, NY 11201', TRUE)
      ON CONFLICT (name) DO UPDATE
      SET
        code = EXCLUDED.code,
        address = EXCLUDED.address,
        is_active = TRUE
    `
  );

  const result = await client.query(
    `
      SELECT id, name
      FROM locations
      WHERE name IN ('Main Store', 'Annex Store')
    `
  );

  return Object.fromEntries(result.rows.map((row) => [row.name, row.id]));
}

async function getRoleIds(client) {
  await client.query(
    `
      INSERT INTO roles (name, description)
      VALUES
        ('Staff', 'Operational staff user'),
        ('Admin', 'Store administrator'),
        ('SuperAdmin', 'Global system administrator')
      ON CONFLICT (name) DO NOTHING
    `
  );

  const result = await client.query(
    `
      SELECT id, name
      FROM roles
      WHERE name IN ('Staff', 'Admin', 'SuperAdmin')
    `
  );

  const roles = Object.fromEntries(result.rows.map((row) => [row.name, row.id]));

  for (const roleName of ["Staff", "Admin", "SuperAdmin"]) {
    if (!roles[roleName]) {
      throw new Error(`Required role missing: ${roleName}`);
    }
  }

  return roles;
}

async function upsertUsers(client, locations, roles) {
  const hashedPassword = await bcryptjs.hash(DEMO_PASSWORD, 10);

  await client.query(
    `
      INSERT INTO users (email, full_name, password, role_id, location_id, is_active)
      VALUES
        ($1, 'Super Admin', $2, $3, NULL, TRUE),
        ($4, 'Main Store Admin', $2, $5, $6, TRUE),
        ($7, 'Main Store Staff', $2, $8, $6, TRUE),
        ($9, 'Annex Staff', $2, $8, $10, TRUE)
      ON CONFLICT (email) DO UPDATE
      SET
        full_name = EXCLUDED.full_name,
        password = EXCLUDED.password,
        role_id = EXCLUDED.role_id,
        location_id = EXCLUDED.location_id,
        is_active = TRUE
    `,
    [
      "superadmin@inventory.local",
      hashedPassword,
      roles.SuperAdmin,
      "admin@inventory.local",
      roles.Admin,
      locations["Main Store"],
      "staff@inventory.local",
      roles.Staff,
      "annex.staff@inventory.local",
      locations["Annex Store"]
    ]
  );

  const result = await client.query(
    `
      SELECT email
      FROM users
      WHERE email IN (
        'superadmin@inventory.local',
        'admin@inventory.local',
        'staff@inventory.local',
        'annex.staff@inventory.local'
      )
    `
  );

  return result.rowCount;
}

async function upsertCategoriesAndUnits(client) {
  await client.query(
    `
      INSERT INTO categories (name, description)
      VALUES
        ('Electronics', 'Electronic devices and components'),
        ('Office Supplies', 'General office materials'),
        ('Tools', 'Tools and equipment')
      ON CONFLICT (name) DO UPDATE
      SET description = EXCLUDED.description
    `
  );

  await client.query(
    `
      INSERT INTO units (name, description)
      VALUES ('pieces', 'Individual item count')
      ON CONFLICT (name) DO UPDATE
      SET description = EXCLUDED.description
    `
  );

  const result = await client.query(
    `
      SELECT id, name
      FROM categories
      WHERE name IN ('Electronics', 'Office Supplies', 'Tools')
    `
  );

  return Object.fromEntries(result.rows.map((row) => [row.name, row.id]));
}

async function upsertItem(client, item) {
  const existing = await client.query(
    `
      SELECT id
      FROM items
      WHERE LOWER(name) = LOWER($1)
      ORDER BY id
      LIMIT 1
    `,
    [item.name]
  );

  if (existing.rows[0]) {
    const result = await client.query(
      `
        UPDATE items
        SET
          category_id = $2,
          name = $3,
          description = $4,
          unit = $5,
          reorder_level = $6,
          is_active = TRUE,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [
        existing.rows[0].id,
        item.category_id,
        item.name,
        item.description,
        item.unit,
        item.reorder_level
      ]
    );

    return result.rows[0].id;
  }

  const result = await client.query(
    `
      INSERT INTO items (category_id, name, description, unit, reorder_level)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [item.category_id, item.name, item.description, item.unit, item.reorder_level]
  );

  return result.rows[0].id;
}

async function upsertItemsAndInventory(client, mainStoreId, categories) {
  const demoItems = [
    {
      name: "Laptop",
      description: "Dell Latitude 5000 Series",
      category_id: categories.Electronics,
      unit: "pieces",
      reorder_level: 5,
      quantity: 35
    },
    {
      name: "Office Chair",
      description: "Ergonomic office chair",
      category_id: categories["Office Supplies"],
      unit: "pieces",
      reorder_level: 10,
      quantity: 42
    },
    {
      name: "Screwdriver Set",
      description: "Multi-bit screwdriver set",
      category_id: categories.Tools,
      unit: "pieces",
      reorder_level: 3,
      quantity: 28
    }
  ];

  for (const item of demoItems) {
    const itemId = await upsertItem(client, item);

    await client.query(
      `
        INSERT INTO inventory_balance (item_id, location_id, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (item_id, location_id) DO UPDATE
        SET
          quantity = EXCLUDED.quantity,
          updated_at = NOW()
      `,
      [itemId, mainStoreId, item.quantity]
    );
  }

  return demoItems.length;
}

async function seedRequestDemo() {
  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const locations = await upsertLocations(client);
    const roles = await getRoleIds(client);
    const userCount = await upsertUsers(client, locations, roles);
    const categories = await upsertCategoriesAndUnits(client);
    const itemCount = await upsertItemsAndInventory(client, locations["Main Store"], categories);

    await client.query("COMMIT");

    console.log("Request demo seed completed successfully.");
    console.log(`Locations ready: ${Object.keys(locations).length}`);
    console.log(`Users ready: ${userCount}`);
    console.log(`Items stocked in Main Store: ${itemCount}`);
    console.log("");
    console.log("Demo credentials:");
    console.log(`  SuperAdmin: superadmin@inventory.local / ${DEMO_PASSWORD}`);
    console.log(`  Main Admin: admin@inventory.local / ${DEMO_PASSWORD}`);
    console.log(`  Main Staff: staff@inventory.local / ${DEMO_PASSWORD}`);
    console.log(`  Annex Staff: annex.staff@inventory.local / ${DEMO_PASSWORD}`);
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Seed rollback failed:", formatErrorDetails(rollbackError));
      }
    }

    console.error("Seed failed:", formatErrorDetails(error));
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }

    await pool.end();
  }
}

seedRequestDemo();
