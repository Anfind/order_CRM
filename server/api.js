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
  getCurrentShift, openShift, closeShift, getShift, getAllShifts, saveShiftExpense, getShiftTransactions, calculateShiftStats,
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

// Cancel entire order and free table
router.delete('/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  deleteOrder(req.params.id);
  if (order.table_id) {
    updateTable(order.table_id, { status: 'empty', order_id: null, guest_count: 0 });
  }
  res.json({ cancelled: true, tableId: order.table_id });
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
    // Only merge if same itemId AND neither has a note (to preserve notes correctly)
    const existing = mergedItems.find(
      mi => mi.itemId === cartItem.itemId && !mi.note && !cartItem.note
    );
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
    status: 'done',
  });
  res.json(updated);
});

// Transfer order to another table
router.post('/orders/:id/transfer', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { toTableId } = req.body;
  const toTable = getTable(toTableId);
  if (!toTable) return res.status(404).json({ error: 'Target table not found' });

  // Free old table
  if (order.table_id) {
    updateTable(order.table_id, { status: 'empty', order_id: null, guest_count: 0 });
  }
  // Assign to new table
  updateTable(toTableId, { status: 'served', order_id: order.id, guest_count: order.guest_count || 0 });
  // Update order
  const updated = updateOrder(req.params.id, { table_id: toTableId, table_name: toTable.name });
  res.json(updated);
});

// Split items from order to another table
router.post('/orders/:id/split', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { itemIndices, toTableId } = req.body;
  const toTable = getTable(toTableId);
  if (!toTable) return res.status(404).json({ error: 'Target table not found' });

  // Separate items
  const splitItems = itemIndices.map(i => order.items[i]).filter(Boolean);
  const remainItems = order.items.filter((_, i) => !itemIndices.includes(i));

  if (splitItems.length === 0) return res.status(400).json({ error: 'No items selected' });

  // Create new order on target table
  const newOrderId = `ORD-${Date.now()}`;
  const newOrder = {
    id: newOrderId,
    table_id: toTableId,
    table_name: toTable.name,
    items: splitItems,
    note: '',
    staff_id: order.staff_id,
    staff_name: order.staff_name,
    order_type: order.order_type,
    guest_count: 0,
    status: 'done',
    total: splitItems.reduce((s, i) => s + i.price * i.quantity, 0),
    shift_id: order.shift_id,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  };
  createOrder(newOrder);
  updateTable(toTableId, { status: 'served', order_id: newOrderId });

  // Update source order
  if (remainItems.length === 0) {
    // All items moved, delete source order and free table
    deleteOrder(req.params.id);
    if (order.table_id) {
      updateTable(order.table_id, { status: 'empty', order_id: null, guest_count: 0 });
    }
  } else {
    const newTotal = remainItems.reduce((s, i) => s + i.price * i.quantity, 0);
    updateOrder(req.params.id, { items: remainItems, total: newTotal });
  }

  res.json({ sourceOrder: remainItems.length > 0 ? getOrder(req.params.id) : null, newOrder });
});

// Merge orders from multiple tables into one
router.post('/orders/:id/merge', (req, res) => {
  const targetOrder = getOrder(req.params.id);
  if (!targetOrder) return res.status(404).json({ error: 'Target order not found' });

  const { sourceOrderIds } = req.body;
  const mergedItems = [...targetOrder.items];

  for (const srcId of sourceOrderIds) {
    const srcOrder = getOrder(srcId);
    if (!srcOrder) continue;

    // Merge items
    srcOrder.items.forEach(srcItem => {
      const existing = mergedItems.find(mi => mi.itemId === srcItem.itemId);
      if (existing) {
        existing.quantity += srcItem.quantity;
      } else {
        mergedItems.push({ ...srcItem });
      }
    });

    // Free source table
    if (srcOrder.table_id) {
      updateTable(srcOrder.table_id, { status: 'empty', order_id: null, guest_count: 0 });
    }
    deleteOrder(srcId);
  }

  const newTotal = mergedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const updated = updateOrder(req.params.id, { items: mergedItems, total: newTotal });
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
    const { amount, reason, type } = req.body;
    saveShiftExpense(req.params.id, amount, reason, type || 'expense');
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/shifts/:id/transactions', (req, res) => {
  try {
    const transactions = getShiftTransactions(req.params.id);
    res.json(transactions);
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
  try {
    res.json(insertEntity(req.params.table, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/config/:table/:id', (req, res) => {
  try {
    res.json(updateEntity(req.params.table, req.params.id, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/config/:table/:id', (req, res) => {
  try {
    deleteEntity(req.params.table, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
