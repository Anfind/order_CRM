/**
 * database.js — SQLite local database for POS
 * Schema: tables, orders, drafts
 * Items stored as JSON text for simplicity (matches existing data model 1:1)
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'pos.db');

const db = new Database(DB_PATH);

// WAL mode for better concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ──────────────────────────────────────
// Schema
// ──────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    seats INTEGER DEFAULT 4,
    area TEXT DEFAULT 'A',
    status TEXT DEFAULT 'empty',
    order_id TEXT,
    guest_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    table_id INTEGER,
    table_name TEXT,
    items TEXT NOT NULL DEFAULT '[]',
    note TEXT DEFAULT '',
    staff_id INTEGER,
    staff_name TEXT,
    order_type TEXT DEFAULT 'dine_in',
    guest_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    total INTEGER DEFAULT 0,
    payment_method TEXT,
    shift_id INTEGER,
    created_at TEXT,
    completed_at TEXT,
    paid_at TEXT
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    table_id INTEGER,
    table_name TEXT,
    items TEXT NOT NULL DEFAULT '[]',
    note TEXT DEFAULT '',
    staff_id INTEGER,
    order_type TEXT DEFAULT 'dine_in',
    total INTEGER DEFAULT 0,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT 'Ca',
    staff_id INTEGER,
    staff_name TEXT,
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    starting_cash INTEGER DEFAULT 0,
    cash_income INTEGER DEFAULT 0,
    cash_expense INTEGER DEFAULT 0,
    transfer_income INTEGER DEFAULT 0,
    expected_cash INTEGER DEFAULT 0,
    actual_cash INTEGER DEFAULT 0,
    difference INTEGER DEFAULT 0,
    handover_cash INTEGER DEFAULT 0,
    denomination TEXT DEFAULT '{}',
    total_revenue INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    unpaid_orders INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    note TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS shift_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT,
    FOREIGN KEY (shift_id) REFERENCES shifts(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    order_idx INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    desc TEXT,
    price INTEGER DEFAULT 0,
    category TEXT,
    image TEXT,
    popular INTEGER DEFAULT 0,
    no_kitchen INTEGER DEFAULT 0,
    order_idx INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS table_areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    order_idx INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
  CREATE INDEX IF NOT EXISTS idx_drafts_table ON drafts(table_id);
  CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
`);

// Try to patch existing orders table if it doesn't have shift_id
try { db.exec('ALTER TABLE orders ADD COLUMN shift_id INTEGER;'); } catch (e) { /* ignore if exists */ }

// Try to patch existing menu_items table for no_kitchen flag
try { db.exec('ALTER TABLE menu_items ADD COLUMN no_kitchen INTEGER DEFAULT 0;'); } catch (e) { /* ignore if exists */ }

// Now safe to create index
db.exec('CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);');


import { MENU_CATEGORIES, MENU_ITEMS, TABLE_AREAS } from '../src/data/mockData.js';

// ──────────────────────────────────────
// Seed default tables if empty
// ──────────────────────────────────────

function seedTables() {
  const count = db.prepare('SELECT COUNT(*) as c FROM tables').get().c;
  if (count === 35) return;

  db.prepare('DELETE FROM tables').run();

  const insert = db.prepare(
    'INSERT INTO tables (id, name, seats, area, status, order_id, guest_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    let id = 1;
    for (let i = 1; i <= 10; i++) insert.run(id++, `A${i}`, 4, 'A', 'empty', null, 0);
    for (let i = 1; i <= 10; i++) insert.run(id++, `B${i}`, 4, 'B', 'empty', null, 0);
    for (let i = 1; i <= 5; i++) insert.run(id++, `S${i}`, 4, 'S', 'empty', null, 0);
    for (let i = 1; i <= 10; i++) insert.run(id++, `MV${i}`, 0, 'MV', 'empty', null, 0);
  });
  tx();
  console.log('[DB] Seeded 35 tables for Khu A, B, S, MV');
}

function seedAppConfig() {
  if (db.prepare('SELECT COUNT(*) as c FROM table_areas').get().c === 0) {
    const insertArea = db.prepare('INSERT INTO table_areas (id, name, order_idx) VALUES (?, ?, ?)');
    db.transaction(() => {
      TABLE_AREAS.forEach((area, i) => insertArea.run(area.id, area.name, i));
    })();
    console.log('[DB] Seeded table_areas');
  }

  if (db.prepare('SELECT COUNT(*) as c FROM categories').get().c === 0) {
    const insertCat = db.prepare('INSERT INTO categories (id, name, order_idx) VALUES (?, ?, ?)');
    db.transaction(() => {
      MENU_CATEGORIES.forEach((cat, i) => insertCat.run(cat.id, cat.name, i));
    })();
    console.log('[DB] Seeded categories');
  }

  if (db.prepare('SELECT COUNT(*) as c FROM menu_items').get().c === 0) {
    const insertItem = db.prepare('INSERT INTO menu_items (id, name, desc, price, category, image, popular, no_kitchen, order_idx) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    db.transaction(() => {
      MENU_ITEMS.forEach((item, i) => {
        insertItem.run(item.id, item.name, item.desc || '', item.price, item.category, item.image || '', item.popular ? 1 : 0, item.no_kitchen ? 1 : 0, i);
      });
    })();
    console.log('[DB] Seeded menu_items');
  }
}

seedTables();
seedAppConfig();

// ──────────────────────────────────────
// Config Entities CRUD (Areas, Categories, MenuItems)
// ──────────────────────────────────────

export function getAllAreas() {
  return db.prepare('SELECT * FROM table_areas ORDER BY order_idx').all();
}
export function getAllCategories() {
  return db.prepare('SELECT * FROM categories ORDER BY order_idx').all();
}
export function getAllMenuItems() {
  return db.prepare('SELECT * FROM menu_items ORDER BY order_idx').all();
}

export function insertEntity(table, data) {
  const keys = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = keys.map(() => '?').join(',');
  db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`).run(...vals);
  return data;
}
export function updateEntity(table, id, data) {
  const keys = Object.keys(data).filter(k => k !== 'id');
  const vals = keys.map(k => data[k]);
  const setString = keys.map(k => `${k} = ?`).join(',');
  db.prepare(`UPDATE ${table} SET ${setString} WHERE id = ?`).run(...vals, id);
  return { id, ...data };
}
export function deleteEntity(table, id) {
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

// ──────────────────────────────────────
// Tables CRUD
// ──────────────────────────────────────

export function getAllTables() {
  return db.prepare('SELECT * FROM tables ORDER BY id').all();
}

export function getTable(id) {
  return db.prepare('SELECT * FROM tables WHERE id = ?').get(id);
}

export function updateTable(id, updates) {
  const allowed = ['name', 'seats', 'area', 'status', 'order_id', 'guest_count'];
  const fields = Object.keys(updates).filter(k => allowed.includes(k));
  if (!fields.length) return null;

  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  values.push(id);

  db.prepare(`UPDATE tables SET ${sets} WHERE id = ?`).run(...values);
  return getTable(id);
}

export function resetTables() {
  db.prepare('DELETE FROM tables').run();
  seedTables();
}

// ──────────────────────────────────────
// Orders CRUD
// ──────────────────────────────────────

function parseOrder(row) {
  if (!row) return null;
  return { ...row, items: JSON.parse(row.items || '[]') };
}

export function getAllOrders() {
  return db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map(parseOrder);
}

export function getActiveOrders() {
  return db.prepare("SELECT * FROM orders WHERE status != 'paid' ORDER BY created_at DESC").all().map(parseOrder);
}

export function getOrder(id) {
  return parseOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(id));
}

export function createOrder(order) {
  // If no shift_id provided, use current open shift
  let shiftId = order.shiftId || order.shift_id;
  if (!shiftId) {
    const currentShift = getCurrentShift();
    if (currentShift) shiftId = currentShift.id;
  }

  db.prepare(`
    INSERT INTO orders (id, table_id, table_name, items, note, staff_id, staff_name, order_type, guest_count, status, total, shift_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.id, order.tableId, order.tableName,
    JSON.stringify(order.items), order.note || '',
    order.staffId || null, order.staffName || null,
    order.orderType || 'dine_in', order.guestCount || 0,
    order.status || 'pending', order.total || 0,
    shiftId || null,
    order.createdAt || new Date().toISOString()
  );
  return getOrder(order.id);
}

export function updateOrder(id, updates) {
  const allowed = ['status', 'total', 'items', 'note', 'payment_method', 'completed_at', 'paid_at', 'staff_name'];
  const fields = Object.keys(updates).filter(k => allowed.includes(k));
  if (!fields.length) return null;

  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => {
    if (f === 'items') return JSON.stringify(updates[f]);
    return updates[f];
  });
  values.push(id);

  db.prepare(`UPDATE orders SET ${sets} WHERE id = ?`).run(...values);
  return getOrder(id);
}

export function deleteOrder(id) {
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
}

// ──────────────────────────────────────
// Drafts CRUD
// ──────────────────────────────────────

function parseDraft(row) {
  if (!row) return null;
  return { ...row, items: JSON.parse(row.items || '[]') };
}

export function getAllDrafts() {
  return db.prepare('SELECT * FROM drafts ORDER BY created_at DESC').all().map(parseDraft);
}

export function getDraft(id) {
  return parseDraft(db.prepare('SELECT * FROM drafts WHERE id = ?').get(id));
}

export function createDraft(draft) {
  db.prepare(`
    INSERT INTO drafts (id, table_id, table_name, items, note, staff_id, order_type, total, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    draft.id, draft.tableId, draft.tableName,
    JSON.stringify(draft.items), draft.note || '',
    draft.staffId || null, draft.orderType || 'dine_in',
    draft.total || 0, draft.createdAt || new Date().toISOString()
  );
  return getDraft(draft.id);
}

export function deleteDraft(id) {
  db.prepare('DELETE FROM drafts WHERE id = ?').run(id);
}

export function getDraftsByTable(tableId) {
  return db.prepare('SELECT * FROM drafts WHERE table_id = ?').all(tableId).map(parseDraft);
}

// ──────────────────────────────────────
// Stats
// ──────────────────────────────────────

export function getStats() {
  const orders = getAllOrders();
  const paidOrders = orders.filter(o => o.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const totalGuests = paidOrders.reduce((sum, o) => sum + (o.guest_count || 0), 0);

  const itemCounts = {};
  orders.forEach(o => {
    o.items.forEach(item => {
      if (!itemCounts[item.name]) {
        itemCounts[item.name] = { name: item.name, image: item.image, count: 0, revenue: 0 };
      }
      itemCounts[item.name].count += item.quantity;
      itemCounts[item.name].revenue += item.price * item.quantity;
    });
  });
  const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 8);

  const revenueByHour = {};
  paidOrders.forEach(o => {
    const h = new Date(o.paid_at).getHours();
    revenueByHour[h] = (revenueByHour[h] || 0) + o.total;
  });

  const ordersByType = {};
  orders.forEach(o => {
    const t = o.order_type || 'dine_in';
    ordersByType[t] = (ordersByType[t] || 0) + 1;
  });

  return {
    totalRevenue,
    totalOrders: orders.length,
    completedOrders: orders.filter(o => o.status === 'done' || o.status === 'paid').length,
    paidOrders: paidOrders.length,
    topItems,
    revenueByHour,
    totalGuests,
    ordersByType,
  };
}

// ──────────────────────────────────────
// Shifts CRUD
// ──────────────────────────────────────

export function getCurrentShift() {
  return db.prepare("SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() || null;
}

export function openShift({ name, staffId, staffName, startingCash }) {
  const current = getCurrentShift();
  if (current) throw new Error('Đã có ca làm việc đang mở');

  const info = db.prepare(`
    INSERT INTO shifts (name, staff_id, staff_name, starting_cash, opened_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(name || 'Ca', staffId || null, staffName || '', startingCash || 0, new Date().toISOString());
  
  return db.prepare('SELECT * FROM shifts WHERE id = ?').get(info.lastInsertRowid);
}

export function calculateShiftStats(shiftId) {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
  if (!shift) return null;

  const getSum = (query) => {
    const res = db.prepare(query).get(shiftId);
    return res && res.sum ? res.sum : 0;
  };
  const getCount = (query) => {
    const res = db.prepare(query).get(shiftId);
    return res && res.count ? res.count : 0;
  };

  const cashIncome = getSum("SELECT SUM(total) as sum FROM orders WHERE shift_id = ? AND status = 'paid' AND payment_method = 'cash'");
  const transferIncome = getSum("SELECT SUM(total) as sum FROM orders WHERE shift_id = ? AND status = 'paid' AND payment_method = 'transfer'");
  const cashExpense = getSum("SELECT SUM(amount) as sum FROM shift_expenses WHERE shift_id = ?");
  const expectedCash = shift.starting_cash + cashIncome - cashExpense;
  const totalRevenue = cashIncome + transferIncome;
  const totalOrders = getCount("SELECT COUNT(*) as count FROM orders WHERE shift_id = ? AND status = 'paid'");
  const unpaidOrders = getCount("SELECT COUNT(*) as count FROM orders WHERE shift_id = ? AND status != 'paid'");

  return {
    cashIncome,
    transferIncome,
    cashExpense,
    expectedCash,
    totalRevenue,
    totalOrders,
    unpaidOrders
  };
}

export function saveShiftNote(shiftId, note) {
  db.prepare('UPDATE shifts SET note = ? WHERE id = ?').run(note, shiftId);
}

export function saveShiftExpense(shiftId, amount, reason) {
  const info = db.prepare(`
    INSERT INTO shift_expenses (shift_id, amount, reason, created_at)
    VALUES (?, ?, ?, ?)
  `).run(shiftId, amount, reason, new Date().toISOString());
  return info.lastInsertRowid;
}

export function closeShift(shiftId, { actualCash, handoverCash, denomination }) {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
  if (!shift) throw new Error('Ca làm việc không tồn tại');
  if (shift.status === 'closed') throw new Error('Ca làm việc đã đóng');

  const stats = calculateShiftStats(shiftId);
  const difference = (actualCash || 0) - stats.expectedCash;

  db.prepare(`
    UPDATE shifts SET
      closed_at = ?,
      cash_income = ?,
      cash_expense = ?,
      transfer_income = ?,
      expected_cash = ?,
      actual_cash = ?,
      difference = ?,
      handover_cash = ?,
      denomination = ?,
      total_revenue = ?,
      total_orders = ?,
      unpaid_orders = ?,
      status = 'closed'
    WHERE id = ?
  `).run(
    new Date().toISOString(),
    stats.cashIncome,
    stats.cashExpense,
    stats.transferIncome,
    stats.expectedCash,
    actualCash || 0,
    difference,
    handoverCash || 0,
    JSON.stringify(denomination || {}),
    stats.totalRevenue,
    stats.totalOrders,
    stats.unpaidOrders,
    shiftId
  );

  return db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
}

export function getShift(shiftId) {
  return db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
}

export function getAllShifts() {
  return db.prepare('SELECT * FROM shifts ORDER BY id DESC').all();
}

// ──────────────────────────────────────
// Transactions for complex ops
// ──────────────────────────────────────

export function runTransaction(fn) {
  return db.transaction(fn)();
}

// ──────────────────────────────────────
// Reset all
// ──────────────────────────────────────

export function resetAll() {
  db.prepare('DELETE FROM orders').run();
  db.prepare('DELETE FROM drafts').run();
  db.prepare('DELETE FROM tables').run();
  seedTables();
}

export default db;
