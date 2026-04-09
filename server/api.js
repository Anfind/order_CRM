/**
 * api.js — REST API routes for POS data
 * All data persisted to SQLite via database.js
 */
import { Router } from 'express';
import {
  getAllTables, getTable, updateTable,
  getAllOrders, getActiveOrders, getOrder, createOrder, updateOrder, deleteOrder,
  getAllDrafts, getDraft, createDraft, deleteDraft, getDraftsByTable,
  getStats, resetAll, runTransaction,
  getCurrentShift, openShift, closeShift, getShift, getAllShifts, saveShiftExpense, calculateShiftStats,
  getAllAreas, getAllCategories, getAllMenuItems, insertEntity, updateEntity, deleteEntity
} from './database.js';

const router = Router();

// ──────────────────────────────────────
// Tables
// ──────────────────────────────────────

router.get('/tables', (_req, res) => {
  res.json(getAllTables());
});

router.put('/tables/:id', (req, res) => {
  const result = updateTable(Number(req.params.id), req.body);
  if (!result) return res.status(404).json({ error: 'Table not found' });
  res.json(result);
});

// ──────────────────────────────────────
// Orders
// ──────────────────────────────────────

router.get('/orders', (_req, res) => {
  const status = _req.query.status;
  if (status === 'active') {
    res.json(getActiveOrders());
  } else {
    res.json(getAllOrders());
  }
});

router.get('/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

router.post('/orders', (req, res) => {
  try {
    // Feature: Instant Order Completion (No Kitchen 'served' tracking required)
    req.body.status = 'done';
    if (req.body.items) {
      req.body.items.forEach(it => { it.status = 'served'; });
    }
    const order = createOrder(req.body);
    // Update table status
    if (req.body.tableId) {
      updateTable(req.body.tableId, { status: 'served', order_id: req.body.id });
    }
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/orders/:id', (req, res) => {
  const order = updateOrder(req.params.id, req.body);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Side effects for status changes
  if (req.body.status === 'done' && order.table_id) {
    updateTable(order.table_id, { status: 'served' });
  }
  if (req.body.status === 'paid' && order.table_id) {
    updateTable(order.table_id, { status: 'empty', order_id: null, guest_count: 0 });
  }

  res.json(order);
});

// Remove an item from an order by index
router.delete('/orders/:id/items/:index', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const idx = Number(req.params.index);
  const newItems = order.items.filter((_, i) => i !== idx);

  if (newItems.length === 0) {
    // Remove entire order and free table
    deleteOrder(req.params.id);
    if (order.table_id) {
      updateTable(order.table_id, { status: 'empty', order_id: null, guest_count: 0 });
    }
    return res.json({ deleted: true });
  }

  const newTotal = newItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const updated = updateOrder(req.params.id, { items: newItems, total: newTotal });
  res.json(updated);
});

// Add items to existing order
router.post('/orders/:id/items', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const newCartItems = req.body.items || [];
  const mergedItems = [...order.items];

  newCartItems.forEach(cartItem => {
    const existing = mergedItems.find(mi => mi.itemId === cartItem.itemId);
    if (existing) {
      existing.quantity += cartItem.quantity;
    } else {
      mergedItems.push({ ...cartItem });
    }
  });

  const newTotal = mergedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const newNote = [order.note, req.body.note].filter(Boolean).join(' | ');

  const updated = updateOrder(req.params.id, {
    items: mergedItems,
    total: newTotal,
    note: newNote,
    status: 'done', // Auto-complete
  });
  res.json(updated);
});

// ──────────────────────────────────────
// Drafts
// ──────────────────────────────────────

router.get('/drafts', (_req, res) => {
  res.json(getAllDrafts());
});

router.post('/drafts', (req, res) => {
  try {
    const draft = createDraft(req.body);
    // Update table to ordering status
    if (req.body.tableId) {
      updateTable(req.body.tableId, { status: 'ordering' });
    }
    res.status(201).json(draft);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/drafts/:id', (req, res) => {
  const draft = getDraft(req.params.id);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });

  deleteDraft(req.params.id);

  // Check if table should be freed
  if (draft.table_id) {
    const remainingDrafts = getDraftsByTable(draft.table_id);
    // Check if there are active orders for this table
    const activeOrders = getAllOrders().filter(
      o => o.table_id === draft.table_id && o.status !== 'paid'
    );
    if (remainingDrafts.length === 0 && activeOrders.length === 0) {
      updateTable(draft.table_id, { status: 'empty', order_id: null, guest_count: 0 });
    }
  }

  res.json({ deleted: true });
});

// ──────────────────────────────────────
// Shifts
// ──────────────────────────────────────

router.get('/shifts', (_req, res) => {
  res.json(getAllShifts());
});

router.get('/shifts/current', (_req, res) => {
  const current = getCurrentShift();
  res.json(current || { status: 'none' });
});

router.post('/shifts', (req, res) => {
  try {
    const shift = openShift(req.body);
    res.status(201).json(shift);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/shifts/:id/close', (req, res) => {
  try {
    const shift = closeShift(req.params.id, req.body);
    res.json(shift);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/shifts/:id/expenses', (req, res) => {
  try {
    const { amount, reason } = req.body;
    saveShiftExpense(req.params.id, amount, reason);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Live stats for an open shift (calculated on-demand)
router.get('/shifts/:id/stats', (req, res) => {
  try {
    const shift = getShift(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    const stats = calculateShiftStats(req.params.id);
    res.json({ ...shift, ...stats });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ──────────────────────────────────────
// Stats
// ──────────────────────────────────────

router.get('/stats', (_req, res) => {
  res.json(getStats());
});

// ──────────────────────────────────────
// Reset
// ──────────────────────────────────────

router.post('/reset', (_req, res) => {
  resetAll();
  res.json({ success: true });
});

// ──────────────────────────────────────
// Config Management
// ──────────────────────────────────────

router.get('/config/:table', (req, res) => {
  const { table } = req.params;
  const data = (table === 'table_areas') ? getAllAreas() : 
               (table === 'categories') ? getAllCategories() : 
               (table === 'menu_items') ? getAllMenuItems() : 
               (table === 'tables') ? getAllTables() : [];
  res.json(data);
});

router.post('/config/:table', (req, res) => {
  res.json(insertEntity(req.params.table, req.body));
});

router.put('/config/:table/:id', (req, res) => {
  res.json(updateEntity(req.params.table, req.params.id, req.body));
});

router.delete('/config/:table/:id', (req, res) => {
  deleteEntity(req.params.table, req.params.id);
  res.json({ success: true });
});

// ──────────────────────────────────────
// Sync — bulk load initial state (for frontend boot)
// ──────────────────────────────────────

router.get('/sync', (_req, res) => {
  res.json({
    tables: getAllTables(),
    orders: getAllOrders(),
    drafts: getAllDrafts(),
    currentShift: getCurrentShift(),
    areas: getAllAreas(),
    categories: getAllCategories(),
    menuItems: getAllMenuItems(),
  });
});

export default router;
