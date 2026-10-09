-- Checkout InfinitePay: pedido e auditoria mínima, sem armazenar dados de cartão.
CREATE TABLE IF NOT EXISTS zion_orders (
  order_nsu TEXT PRIMARY KEY,
  handle TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  items_json TEXT NOT NULL,
  customer_json TEXT NOT NULL,
  address_json TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  checkout_url TEXT NOT NULL DEFAULT '',
  invoice_slug TEXT NOT NULL DEFAULT '',
  transaction_nsu TEXT NOT NULL DEFAULT '',
  receipt_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS zion_orders_status ON zion_orders(status,created_at);
CREATE TABLE IF NOT EXISTS zion_checkout_attempts (
  client_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS zion_checkout_attempts_window ON zion_checkout_attempts(client_hash,created_at);
