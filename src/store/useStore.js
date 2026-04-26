import { create } from 'zustand';
import { generateOrderId } from '../data/mockData';

// ──────────────────────────────────────
// API helper
// ──────────────────────────────────────

const API = '/api/data';

async function api(path, options = {}) {
  const { method = 'GET', body } = options;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

// ──────────────────────────────────────
// Zustand Store — API-backed with optimistic UI
// ──────────────────────────────────────

const useStore = create((set, get) => ({
  // --- Configs (Loaded from DB) ---
  tableAreas: [],
  categories: [],
  menuItems: [],

  // --- Server connection ---
  serverConnected: false,
  serverLoading: true,

  // --- Role (local only, UI preference) ---
  role: localStorage.getItem('orderflow_role') ? JSON.parse(localStorage.getItem('orderflow_role')) : 'order',
  setRole: (role) => {
    localStorage.setItem('orderflow_role', JSON.stringify(role));
    set({ role });
  },

  // --- Shifts ---
  currentShift: null, // null if no open shift

  openShift: async ({ name, staffId, staffName, startingCash }) => {
    try {
      const shift = await api('/shifts', {
        method: 'POST',
        body: { name, staffId, staffName, startingCash }
      });
      set({ currentShift: shift });
      return shift;
    } catch (err) {
      get().addToast(`Lỗi mở ca: ${err.message}`, 'error');
      throw err;
    }
  },

  closeShift: async (shiftId, details) => {
    try {
      const shift = await api(`/shifts/${shiftId}/close`, {
        method: 'POST',
        body: details
      });
      set({ currentShift: null });
      return shift;
    } catch (err) {
      get().addToast(`Lỗi đóng ca: ${err.message}`, 'error');
      throw err;
    }
  },

  addShiftTransaction: async (shiftId, amount, reason, type = 'expense') => {
    try {
      await api(`/shifts/${shiftId}/expenses`, {
        method: 'POST',
        body: { amount, reason, type }
      });
      get().addToast(type === 'income' ? 'Ghi nhận thu thành công' : 'Ghi nhận chi thành công', 'success');
    } catch (err) {
      get().addToast(`Lỗi ghi ${type === 'income' ? 'thu' : 'chi'}: ${err.message}`, 'error');
      throw err;
    }
  },

  refreshShift: async () => {
    try {
      const shift = await api('/shifts/current');
      set({ currentShift: shift.status === 'none' ? null : shift });
    } catch (err) {
      console.warn('Lỗi tải ca:', err.message);
    }
  },

  // --- Tables ---
  tables: [],
  selectedTableId: null,

  selectTable: (tableId) => set({ selectedTableId: tableId }),

  updateTable: (tableId, updates) => {
    // Optimistic
    const tables = get().tables.map(t =>
      t.id === tableId ? { ...t, ...updates } : t
    );
    set({ tables });
    // Persist
    api(`/tables/${tableId}`, { method: 'PUT', body: updates }).catch(console.error);
  },

  setGuestCount: (tableId, count) => {
    const guestCount = Math.max(0, count);
    const tables = get().tables.map(t =>
      t.id === tableId ? { ...t, guestCount: guestCount, guest_count: guestCount } : t
    );
    set({ tables });
    api(`/tables/${tableId}`, { method: 'PUT', body: { guest_count: guestCount } }).catch(console.error);
  },

  // --- Current Cart (in-memory only, not persisted) ---
  cart: [],
  cartNote: '',
  selectedStaffId: localStorage.getItem('orderflow_selectedStaff') ? JSON.parse(localStorage.getItem('orderflow_selectedStaff')) : null,
  orderType: 'dine_in',

  setOrderType: (type) => set({ orderType: type }),

  setSelectedStaff: (staffId) => {
    localStorage.setItem('orderflow_selectedStaff', JSON.stringify(staffId));
    set({ selectedStaffId: staffId });
  },

  addToCart: (itemId) => {
    const cart = [...get().cart];
    const existing = cart.find(c => c.itemId === itemId);
    if (existing) {
      existing.quantity += 1;
    } else {
      const item = get().menuItems.find(m => m.id === itemId);
      cart.push({ itemId, name: item.name, price: item.price, image: item.image, quantity: 1, no_kitchen: item.no_kitchen || 0 });
    }
    set({ cart });
  },

  removeFromCart: (itemId) => {
    set({ cart: get().cart.filter(c => c.itemId !== itemId) });
  },

  updateCartQty: (itemId, delta) => {
    const cart = get().cart.map(c => {
      if (c.itemId === itemId) {
        return { ...c, quantity: Math.max(0, c.quantity + delta) };
      }
      return c;
    }).filter(c => c.quantity > 0);
    set({ cart });
  },

  updateCartItemNote: (itemId, note) => {
    const cart = get().cart.map(c => {
      if (c.itemId === itemId) {
        return { ...c, note };
      }
      return c;
    });
    set({ cart });
  },

  setCartNote: (note) => set({ cartNote: note }),
  clearCart: () => set({ cart: [], cartNote: '' }),

  // --- Draft Orders ---
  drafts: [],

  saveDraft: () => {
    const { cart, cartNote, selectedTableId, selectedStaffId, orderType, tables } = get();
    if (!cart.length || !selectedTableId) return null;

    const table = tables.find(t => t.id === selectedTableId);
    const draftId = `DRF-${Date.now()}`;
    const draft = {
      id: draftId,
      tableId: selectedTableId,
      tableName: table.name,
      items: [...cart],
      note: cartNote,
      staffId: selectedStaffId,
      orderType,
      total: cart.reduce((sum, c) => sum + c.price * c.quantity, 0),
      createdAt: new Date().toISOString(),
    };

    const drafts = [...get().drafts, draft];

    // Optimistic table update
    const newTables = tables.map(t =>
      t.id === selectedTableId ? { ...t, status: 'ordering' } : t
    );

    set({
      drafts,
      tables: newTables,
      cart: [],
      cartNote: '',
      selectedTableId: null,
    });

    // Persist
    api('/drafts', { method: 'POST', body: draft }).catch(console.error);

    return draftId;
  },

  loadDraft: (draftId) => {
    const draft = get().drafts.find(d => d.id === draftId);
    if (!draft) return;

    set({
      cart: [...draft.items],
      cartNote: draft.note || '',
      selectedTableId: draft.tableId || draft.table_id,
      selectedStaffId: draft.staffId || draft.staff_id,
      orderType: draft.orderType || draft.order_type || 'dine_in',
    });

    // Remove draft
    const drafts = get().drafts.filter(d => d.id !== draftId);
    set({ drafts });
    api(`/drafts/${draftId}`, { method: 'DELETE' }).catch(console.error);
  },

  deleteDraft: (draftId) => {
    const draft = get().drafts.find(d => d.id === draftId);
    const drafts = get().drafts.filter(d => d.id !== draftId);

    // Reset table if no other drafts/orders
    if (draft) {
      const tableId = draft.tableId || draft.table_id;
      const hasOtherDrafts = drafts.some(d => (d.tableId || d.table_id) === tableId);
      const hasOrders = get().orders.some(o => (o.tableId || o.table_id) === tableId && o.status !== 'paid');
      if (!hasOtherDrafts && !hasOrders) {
        const tables = get().tables.map(t =>
          t.id === tableId ? { ...t, status: 'empty', orderId: null, order_id: null, guestCount: 0, guest_count: 0 } : t
        );
        set({ drafts, tables });
        api(`/drafts/${draftId}`, { method: 'DELETE' }).catch(console.error);
        return;
      }
    }
    set({ drafts });
    api(`/drafts/${draftId}`, { method: 'DELETE' }).catch(console.error);
  },

  // --- Orders ---
  orders: [],

  sendOrderToKitchen: () => {
    const { cart, cartNote, selectedTableId, selectedStaffId, orderType, tables } = get();
    if (!cart.length || !selectedTableId) return null;

    const table = tables.find(t => t.id === selectedTableId);
    const orderId = generateOrderId();
    // Deep clone cart items to prevent mutation
    const clonedItems = cart.map(c => ({ ...c }));
    const order = {
      id: orderId,
      tableId: selectedTableId,
      tableName: table.name,
      items: clonedItems,
      note: cartNote,
      staffId: selectedStaffId,
      staffName: null,
      orderType,
      guestCount: table.guestCount || table.guest_count || 0,
      status: 'done',
      total: clonedItems.reduce((sum, c) => sum + c.price * c.quantity, 0),
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      paidAt: null,
    };

    const orders = [...get().orders, order];
    const newTables = tables.map(t =>
      t.id === selectedTableId ? { ...t, status: 'served', orderId } : t
    );

    set({
      orders,
      tables: newTables,
      cart: [],
      cartNote: '',
    });

    // Persist
    api('/orders', { method: 'POST', body: order }).catch(console.error);

    return orderId;
  },

  addItemsToOrder: (orderId) => {
    const { cart, cartNote } = get();
    if (!cart.length) return false;

    // Snapshot cart BEFORE clearing (prevents race condition)
    const cartSnapshot = cart.map(c => ({ ...c }));
    const noteSnapshot = cartNote;

    const orders = get().orders.map(o => {
      if (o.id !== orderId) return o;
      // Deep clone existing items to avoid mutating Zustand state
      const mergedItems = o.items.map(item => ({ ...item }));
      cartSnapshot.forEach(cartItem => {
        const existing = mergedItems.find(mi => mi.itemId === cartItem.itemId && !cartItem.note);
        if (existing && !existing.note) {
          existing.quantity += cartItem.quantity;
        } else {
          mergedItems.push({ ...cartItem });
        }
      });
      const newTotal = mergedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const newNote = [o.note, noteSnapshot].filter(Boolean).join(' | ');
      return { 
        ...o, 
        items: mergedItems, 
        total: newTotal, 
        note: newNote, 
        status: 'done', 
        completedAt: new Date().toISOString() 
      };
    });

    set({ orders, cart: [], cartNote: '' });

    // Persist with snapshot (not cleared cart)
    api(`/orders/${orderId}/items`, {
      method: 'POST',
      body: { items: cartSnapshot, note: noteSnapshot },
    }).catch(console.error);

    return true;
  },

  startCooking: (orderId) => {
    const orders = get().orders.map(o =>
      o.id === orderId ? { ...o, status: 'cooking' } : o
    );
    set({ orders });
    api(`/orders/${orderId}`, { method: 'PUT', body: { status: 'cooking' } }).catch(console.error);
  },

  completeOrder: (orderId) => {
    const orders = get().orders.map(o =>
      o.id === orderId ? { ...o, status: 'done', completedAt: new Date().toISOString() } : o
    );

    const order = orders.find(o => o.id === orderId);
    if (order) {
      const tableId = order.tableId || order.table_id;
      const tables = get().tables.map(t =>
        t.id === tableId ? { ...t, status: 'served' } : t
      );
      set({ orders, tables });
    } else {
      set({ orders });
    }

    api(`/orders/${orderId}`, {
      method: 'PUT',
      body: { status: 'done', completed_at: new Date().toISOString() },
    }).catch(console.error);
  },

  removeItemFromOrder: (orderId, itemIndex) => {
    const originalOrder = get().orders.find(o => o.id === orderId);
    const orders = get().orders.map(o => {
      if (o.id !== orderId) return o;
      const newItems = o.items.filter((_, i) => i !== itemIndex);
      if (newItems.length === 0) return null;
      const newTotal = newItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
      return { ...o, items: newItems, total: newTotal };
    }).filter(Boolean);

    const stillExists = orders.find(o => o.id === orderId);
    if (!stillExists && originalOrder) {
      const tableId = originalOrder.tableId || originalOrder.table_id;
      const tables = get().tables.map(t =>
        t.id === tableId ? { ...t, status: 'empty', orderId: null, order_id: null, guestCount: 0, guest_count: 0 } : t
      );
      set({ orders, tables, selectedTableId: null });
    } else {
      set({ orders });
    }

    api(`/orders/${orderId}/items/${itemIndex}`, { method: 'DELETE' }).catch(console.error);
  },

  payOrder: (orderId, paymentMethod = 'cash') => {
    const orders = get().orders.map(o =>
      o.id === orderId ? { ...o, status: 'paid', paidAt: new Date().toISOString(), paymentMethod } : o
    );

    const order = orders.find(o => o.id === orderId);
    if (order) {
      const tableId = order.tableId || order.table_id;
      const tables = get().tables.map(t =>
        t.id === tableId ? { ...t, status: 'empty', orderId: null, order_id: null, guestCount: 0, guest_count: 0 } : t
      );
      set({ orders, tables, selectedTableId: null });
    } else {
      set({ orders });
    }

    api(`/orders/${orderId}`, {
      method: 'PUT',
      body: { status: 'paid', paid_at: new Date().toISOString(), payment_method: paymentMethod },
    }).catch(console.error);
  },

  // --- Table Transfer ---
  transferTable: async (orderId, fromTableId, toTableId) => {
    const toTable = get().tables.find(t => t.id === toTableId);
    if (!toTable) return false;

    // Optimistic UI
    const orders = get().orders.map(o =>
      o.id === orderId ? { ...o, tableId: toTableId, tableName: toTable.name } : o
    );
    const tables = get().tables.map(t => {
      if (t.id === fromTableId) return { ...t, status: 'empty', orderId: null, order_id: null, guestCount: 0, guest_count: 0 };
      if (t.id === toTableId) return { ...t, status: 'served', orderId, order_id: orderId };
      return t;
    });
    set({ orders, tables, selectedTableId: toTableId });

    try {
      await api(`/orders/${orderId}/transfer`, { method: 'POST', body: { toTableId } });
      get().addToast(`Đã chuyển sang ${toTable.name}!`, 'success');
    } catch (err) {
      get().addToast('Lỗi chuyển bàn: ' + err.message, 'error');
      get().loadFromServer();
    }
    return true;
  },

  // --- Split Bill ---
  splitBill: async (orderId, itemIndices, toTableId) => {
    try {
      await api(`/orders/${orderId}/split`, {
        method: 'POST',
        body: { itemIndices, toTableId }
      });
      get().addToast('Tách bill thành công!', 'success');
      await get().loadFromServer(); // Reload to sync all state
      return true;
    } catch (err) {
      get().addToast('Lỗi tách bill: ' + err.message, 'error');
      return false;
    }
  },

  // --- Merge Bills ---
  mergeBills: async (targetOrderId, sourceOrderIds) => {
    try {
      await api(`/orders/${targetOrderId}/merge`, {
        method: 'POST',
        body: { sourceOrderIds }
      });
      get().addToast('Gộp bill thành công!', 'success');
      await get().loadFromServer(); // Reload to sync all state
      return true;
    } catch (err) {
      get().addToast('Lỗi gộp bill: ' + err.message, 'error');
      return false;
    }
  },

  // --- Toasts ---
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = Date.now();
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter(t => t.id !== id) });
    }, 3500);
  },

  // --- Admin helpers ---
  getStats: (filteredOrders = null) => {
    const orders = filteredOrders || get().orders;
    const paidOrders = orders.filter(o => o.status === 'paid');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'done' || o.status === 'paid').length;
    const totalGuests = paidOrders.reduce((sum, o) => sum + (o.guestCount || o.guest_count || 0), 0);

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
      const h = new Date(o.paidAt || o.paid_at).getHours();
      revenueByHour[h] = (revenueByHour[h] || 0) + o.total;
    });

    const ordersByType = {};
    orders.forEach(o => {
      const t = o.orderType || o.order_type || 'dine_in';
      ordersByType[t] = (ordersByType[t] || 0) + 1;
    });

    return { totalRevenue, totalOrders, completedOrders, paidOrders: paidOrders.length, topItems, revenueByHour, totalGuests, ordersByType };
  },

  resetAll: () => {
    set({ orders: [], drafts: [], cart: [], cartNote: '', selectedTableId: null });
    api('/reset', { method: 'POST' })
      .then(() => get().loadFromServer())
      .catch(console.error);
  },

  // --- Boot: load from server ---
  loadFromServer: async () => {
    set({ serverLoading: true });
    try {
      const data = await api('/sync');

      // Normalize DB column names to match frontend expectations
      const tables = data.tables.map(t => ({
        ...t,
        guestCount: t.guest_count ?? t.guestCount ?? 0,
        orderId: t.order_id ?? t.orderId ?? null,
      }));

      const orders = data.orders.map(o => ({
        ...o,
        tableId: o.table_id ?? o.tableId,
        tableName: o.table_name ?? o.tableName,
        staffId: o.staff_id ?? o.staffId,
        staffName: o.staff_name ?? o.staffName,
        orderType: o.order_type ?? o.orderType ?? 'dine_in',
        guestCount: o.guest_count ?? o.guestCount ?? 0,
        paymentMethod: o.payment_method ?? o.paymentMethod,
        createdAt: o.created_at ?? o.createdAt,
        completedAt: o.completed_at ?? o.completedAt,
        paidAt: o.paid_at ?? o.paidAt,
      }));

      const drafts = data.drafts.map(d => ({
        ...d,
        tableId: d.table_id ?? d.tableId,
        tableName: d.table_name ?? d.tableName,
        staffId: d.staff_id ?? d.staffId,
        orderType: d.order_type ?? d.orderType ?? 'dine_in',
        createdAt: d.created_at ?? d.createdAt,
      }));

      // Maps current shift
      const currentShift = data.currentShift;

      // Maps configs
      const tableAreas = data.areas || [];
      const categories = data.categories || [];
      const menuItems = data.menuItems || [];

      set({ tables, orders, drafts, currentShift, tableAreas, categories, menuItems, serverConnected: true, serverLoading: false });
      console.log('[Store] Loaded from SQLite:', tables.length, 'tables,', orders.length, 'orders,', drafts.length, 'drafts, open shift:', !!currentShift);
    } catch (err) {
      console.warn('[Store] Server not available, using defaults:', err.message);
      set({ serverConnected: false, serverLoading: false });
    }
  },
}));

export default useStore;
