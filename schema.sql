CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL,
  customer_tag TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  domestic INTEGER NOT NULL,
  cargo_type TEXT NOT NULL,
  pickup TEXT,
  destination TEXT,
  preference TEXT,
  requested_route TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  selected_route TEXT,
  tariff INTEGER,
  company_fee INTEGER,
  total INTEGER,
  eta_low INTEGER,
  eta_high INTEGER,
  status TEXT NOT NULL DEFAULT 'awaiting_route',
  paid INTEGER NOT NULL DEFAULT 0,
  customer_channel_id TEXT,
  customer_message_id TEXT,
  staff_channel_id TEXT,
  staff_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
