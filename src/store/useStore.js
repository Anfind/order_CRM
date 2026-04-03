import { create } from 'zustand';
import { INITIAL_TABLES, MENU_ITEMS, generateOrderId } from '../data/mockData';

// Load from localStorage
function loadState(key, fallback) {
  try {
    const saved = localStorage.getItem(`orderflow_${key}`);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
}

function saveState(key, value) {
  try {
    localStorage.setItem(`orderflow_${key}`, JSON.stringify(value));
  } catch { /* quota exceeded */ }
}

const useStore = create((set, get) => ({
  // --- Role ---
  role: loadState('role', 'order'),
  setRole: (role) => {
    saveState('role', role);
    set({ role });
  },

  // --- Tables ---
  tables: loadState('tables', INITIAL_TABLES),
  selectedTableId: null,

  selectTable: (tableId) => set({ selectedTableId: tableId }),

  updateTable: (tableId, updates) => {
    const tables = get().tables.map(t =>
      t.id === tableId ? { ...t, ...updates } : t
    );
    saveState('tables', tables);
    set({ tables });
  },

  setGuestCount: (tableId, count) => {
    const tables = get().tables.map(t =>
      t.id === tableId ? { ...t, guestCount: Math.max(0, count) } : t
    );
    saveState('tables', tables);
    set({ tables });
  },

  // --- Current Cart (for ordering) ---
  cart: [],
  cartNote: '',
  selectedStaffId: loadState('selectedStaff', null),
  orderType: 'dine_in', // dine_in | takeaway | delivery | reservation

  setOrderType: (type) => set({ orderType: type }),

  setSelectedStaff: (staffId) => {
    saveState('selectedStaff', staffId);
    set({ selectedStaffId: staffId });
  },

  addToCart: (itemId) => {
    const cart = [...get().cart];
    const existing = cart.find(c => c.itemId === itemId);
    if (existing) {
      existing.quantity += 1;
    } else {
      const item = MENU_ITEMS.find(m => m.id === itemId);
      cart.push({ itemId, name: item.name, price: item.price, image: item.image, quantity: 1 });
    }
    set({ cart });
  },

  removeFromCart: (itemId) => {
    const cart = get().cart.filter(c => c.itemId !== itemId);
    set({ cart });
  },

  updateCartQty: (itemId, delta) => {
    const cart = get().cart.map(c => {
      if (c.itemId === itemId) {
        const qty = Math.max(0, c.quantity + delta);
        return { ...c, quantity: qty };
      }
      return c;
    }).filter(c => c.quantity > 0);
    set({ cart });
  },

  setCartNote: (note) => set({ cartNote: note }),

  clearCart: () => set({ cart: [], cartNote: '' }),

  // --- Draft Orders (tạm lưu) ---
  drafts: loadState('drafts', []),

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
    saveState('drafts', drafts);

    // Update table to ordering status
    const newTables = tables.map(t =>
      t.id === selectedTableId ? { ...t, status: 'ordering' } : t
    );
    saveState('tables', newTables);

    set({
      drafts,
      tables: newTables,
      cart: [],
      cartNote: '',
      selectedTableId: null,
    });

    return draftId;
  },

  loadDraft: (draftId) => {
    const draft = get().drafts.find(d => d.id === draftId);
    if (!draft) return;
    set({
      cart: [...draft.items],
      cartNote: draft.note || '',
      selectedTableId: draft.tableId,
      selectedStaffId: draft.staffId,
      orderType: draft.orderType || 'dine_in',
    });
    // Remove draft
    const drafts = get().drafts.filter(d => d.id !== draftId);
    saveState('drafts', drafts);
    set({ drafts });
  },

  deleteDraft: (draftId) => {
    const draft = get().drafts.find(d => d.id === draftId);
    const drafts = get().drafts.filter(d => d.id !== draftId);
    saveState('drafts', drafts);

    // Reset table if this was the only draft
    if (draft) {
      const hasOtherDrafts = drafts.some(d => d.tableId === draft.tableId);
      const hasOrders = get().orders.some(o => o.tableId === draft.tableId && o.status !== 'paid');
      if (!hasOtherDrafts && !hasOrders) {
        const tables = get().tables.map(t =>
          t.id === draft.tableId ? { ...t, status: 'empty', orderId: null, guestCount: 0 } : t
        );
        saveState('tables', tables);
        set({ drafts, tables });
        return;
      }
    }
    set({ drafts });
  },

  // --- Orders (sent to kitchen) ---
  orders: loadState('orders', []),

  sendOrderToKitchen: () => {
    const { cart, cartNote, selectedTableId, selectedStaffId, orderType, tables } = get();
    if (!cart.length || !selectedTableId) return null;

    const table = tables.find(t => t.id === selectedTableId);
    const orderId = generateOrderId();
    const order = {
      id: orderId,
      tableId: selectedTableId,
      tableName: table.name,
      items: [...cart],
      note: cartNote,
      staffId: selectedStaffId,
      staffName: null, // will be resolved in component
      orderType,
      guestCount: table.guestCount || 0,
      status: 'pending', // pending | cooking | done | paid
      total: cart.reduce((sum, c) => sum + c.price * c.quantity, 0),
      createdAt: new Date().toISOString(),
      completedAt: null,
      paidAt: null,
    };

    const orders = [...get().orders, order];
    saveState('orders', orders);

    // Update table status
    const newTables = tables.map(t =>
      t.id === selectedTableId
        ? { ...t, status: 'waiting', orderId }
        : t
    );
    saveState('tables', newTables);

    set({
      orders,
      tables: newTables,
      cart: [],
      cartNote: '',
      selectedTableId: null,
    });

    return orderId;
  },

  // Add more items to an existing order (gọi thêm món)
  addItemsToOrder: (orderId) => {
    const { cart, cartNote } = get();
    if (!cart.length) return false;

    const orders = get().orders.map(o => {
      if (o.id !== orderId) return o;
      const mergedItems = [...o.items];
      cart.forEach(cartItem => {
        const existing = mergedItems.find(mi => mi.itemId === cartItem.itemId);
        if (existing) {
          existing.quantity += cartItem.quantity;
        } else {
          mergedItems.push({ ...cartItem });
        }
      });
      const newTotal = mergedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const newNote = [o.note, cartNote].filter(Boolean).join(' | ');
      return { ...o, items: mergedItems, total: newTotal, note: newNote, status: 'pending' };
    });

    saveState('orders', orders);
    set({ orders, cart: [], cartNote: '' });
    return true;
  },

  // Kitchen actions
  startCooking: (orderId) => {
    const orders = get().orders.map(o =>
      o.id === orderId ? { ...o, status: 'cooking' } : o
    );
    saveState('orders', orders);
    set({ orders });
  },

  completeOrder: (orderId) => {
    const orders = get().orders.map(o =>
      o.id === orderId ? { ...o, status: 'done', completedAt: new Date().toISOString() } : o
    );
    saveState('orders', orders);

    // Update table
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const tables = get().tables.map(t =>
        t.id === order.tableId ? { ...t, status: 'served' } : t
      );
      saveState('tables', tables);
      set({ orders, tables });
    } else {
      set({ orders });
    }
  },

  // Payment
  payOrder: (orderId) => {
    const orders = get().orders.map(o =>
      o.id === orderId ? { ...o, status: 'paid', paidAt: new Date().toISOString() } : o
    );
    saveState('orders', orders);

    const order = orders.find(o => o.id === orderId);
    if (order) {
      const tables = get().tables.map(t =>
        t.id === order.tableId ? { ...t, status: 'empty', orderId: null, guestCount: 0 } : t
      );
      saveState('tables', tables);
      set({ orders, tables, selectedTableId: null });
    } else {
      set({ orders });
    }
  },

  // --- Toasts / Notifications ---
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = Date.now();
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter(t => t.id !== id) });
    }, 3500);
  },

  // --- Admin helpers ---
  getStats: () => {
    const orders = get().orders;
    const paidOrders = orders.filter(o => o.status === 'paid');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'done' || o.status === 'paid').length;
    const totalGuests = paidOrders.reduce((sum, o) => sum + (o.guestCount || 0), 0);

    // Top items
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
    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Revenue by hour
    const revenueByHour = {};
    paidOrders.forEach(o => {
      const h = new Date(o.paidAt).getHours();
      revenueByHour[h] = (revenueByHour[h] || 0) + o.total;
    });

    // By order type
    const ordersByType = {};
    orders.forEach(o => {
      const t = o.orderType || 'dine_in';
      ordersByType[t] = (ordersByType[t] || 0) + 1;
    });

    return { totalRevenue, totalOrders, completedOrders, paidOrders: paidOrders.length, topItems, revenueByHour, totalGuests, ordersByType };
  },

  // Reset all data
  resetAll: () => {
    localStorage.removeItem('orderflow_tables');
    localStorage.removeItem('orderflow_orders');
    localStorage.removeItem('orderflow_drafts');
    set({ tables: INITIAL_TABLES, orders: [], drafts: [], cart: [], cartNote: '', selectedTableId: null });
  },
}));

export default useStore;
