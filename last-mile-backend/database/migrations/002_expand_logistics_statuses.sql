ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'pending',
    'assigned',
    'picking',
    'in_transit',
    'picked_up',
    'delivered',
    'failed',
    'cancelled'
  ) NOT NULL DEFAULT 'pending';

ALTER TABLE delivery_logs
  MODIFY COLUMN status ENUM(
    'pending',
    'assigned',
    'picking',
    'in_transit',
    'picked_up',
    'delivered',
    'failed',
    'cancelled'
  ) NOT NULL;
