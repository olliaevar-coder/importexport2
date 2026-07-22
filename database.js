const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'orders.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
// Forward migration for databases created by an earlier project revision.
const columns = db.prepare('PRAGMA table_info(orders)').all().map((column) => column.name);
if (!columns.includes('requested_route')) db.exec('ALTER TABLE orders ADD COLUMN requested_route TEXT');

function getOrder(id) { return db.prepare('SELECT * FROM orders WHERE id = ?').get(id); }
function createOrder(order) {
  const result = db.prepare(`INSERT INTO orders
    (customer_id, customer_tag, guild_id, domestic, cargo_type, pickup, destination, preference, requested_route, priority, status)
    VALUES (@customer_id, @customer_tag, @guild_id, @domestic, @cargo_type, @pickup, @destination, @preference, @requested_route, @priority, 'awaiting_route')`).run(order);
  return getOrder(result.lastInsertRowid);
}
function updateOrder(id, changes) {
  const keys = Object.keys(changes);
  if (!keys.length) return getOrder(id);
  const assignments = keys.map((key) => `${key} = @${key}`).join(', ');
  db.prepare(`UPDATE orders SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`)
    .run({ id, ...changes });
  return getOrder(id);
}
module.exports = { db, createOrder, getOrder, updateOrder };
