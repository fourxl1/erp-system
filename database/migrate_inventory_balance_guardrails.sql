DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM inventory_balance
        WHERE quantity < 0
    ) THEN
        RAISE EXCEPTION 'Cannot add inventory_balance non-negative constraint while negative balances exist';
    END IF;
END $$;

ALTER TABLE inventory_balance
    DROP CONSTRAINT IF EXISTS inventory_balance_quantity_non_negative;

ALTER TABLE inventory_balance
    ADD CONSTRAINT inventory_balance_quantity_non_negative
    CHECK (quantity >= 0);
