import { useState, useMemo, useEffect } from 'react';
import useStore from '../store/useStore';
import { TABLE_STATUS_CONFIG, STAFF_LIST, ORDER_TYPES, PAYMENT_METHODS, formatCurrency } from '../data/mockData';
import { printKitchenTicket, printReceipt } from '../services/printApi';
import {
  LayoutGrid, ClipboardList, UserRound, Search, X, Minus, Plus, Trash2,
  ShoppingCart, Send, Save, CircleDollarSign, Banknote, Clock, PencilLine,
  Users, ChevronDown, CircleCheck, Flame, Timer, PlusCircle, Utensils,
  ArrowUpFromLine, Landmark, Lock
} from 'lucide-react';
import './OrderView.css';

export default function OrderView() {
  const tableAreas = useStore(s => s.tableAreas);
  const categories = useStore(s => s.categories);
  const menuItems = useStore(s => s.menuItems);
  const tables = useStore(s => s.tables);
  const selectedTableId = useStore(s => s.selectedTableId);
  const selectTable = useStore(s => s.selectTable);
  const cart = useStore(s => s.cart);
  const addToCart = useStore(s => s.addToCart);
  const updateCartQty = useStore(s => s.updateCartQty);
  const updateCartItemNote = useStore(s => s.updateCartItemNote);
  const removeFromCart = useStore(s => s.removeFromCart);
  const clearCart = useStore(s => s.clearCart);
  const sendOrderToKitchen = useStore(s => s.sendOrderToKitchen);
  const orders = useStore(s => s.orders);
  const payOrder = useStore(s => s.payOrder);
  const addToast = useStore(s => s.addToast);
  const selectedStaffId = useStore(s => s.selectedStaffId);
  const setSelectedStaff = useStore(s => s.setSelectedStaff);
  const orderType = useStore(s => s.orderType);
  const setOrderType = useStore(s => s.setOrderType);
  const setGuestCount = useStore(s => s.setGuestCount);
  const saveDraft = useStore(s => s.saveDraft);
  const drafts = useStore(s => s.drafts);
  const loadDraft = useStore(s => s.loadDraft);
  const deleteDraft = useStore(s => s.deleteDraft);
  const addItemsToOrder = useStore(s => s.addItemsToOrder);
  const removeItemFromOrder = useStore(s => s.removeItemFromOrder);

  const [activeCategory, setActiveCategory] = useState('all');
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderTab, setOrderTab] = useState('dine_in');
  const [showOrderList, setShowOrderList] = useState(false);
  const [tableAreaFilter, setTableAreaFilter] = useState(tableAreas[0]?.id || 'T1');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null); // { orderId, itemIndex, itemName }

  const selectedTable = tables.find(t => t.id === selectedTableId);
  const tableOrder = selectedTable?.orderId
    ? orders.find(o => o.id === selectedTable.orderId)
    : null;

  const canAddMore = selectedTable && selectedTable.status === 'waiting' && tableOrder;

  const filteredItems = useMemo(() => {
    let items = menuItems;
    if (activeCategory === 'popular') {
      items = items.filter(m => m.popular);
    } else if (activeCategory !== 'all') {
      items = items.filter(m => m.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
      const q = normalize(searchQuery.trim());
      items = items.filter(m => normalize(m.name).includes(q));
    }
    return items;
  }, [activeCategory, searchQuery]);

  const filteredTables = useMemo(() => {
    if (tableAreaFilter === 'all') return tables;
    return tables.filter(t => t.area === tableAreaFilter);
  }, [tables, tableAreaFilter]);

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  useEffect(() => {
    if (tableAreas.length > 0 && !tableAreas.find(a => a.id === tableAreaFilter)) {
      setTableAreaFilter(tableAreas[0].id);
    }
  }, [tableAreas, tableAreaFilter]);

  useEffect(() => {
    if (!showCart) setPendingDeleteItem(null);
  }, [showCart]);

  const orderCounts = useMemo(() => {
    const active = orders.filter(o => o.status !== 'paid');
    const counts = { all: active.length };
    ORDER_TYPES.forEach(t => {
      counts[t.id] = active.filter(o => (o.orderType || 'dine_in') === t.id).length;
    });
    counts.draft = drafts.length;
    return counts;
  }, [orders, drafts]);

  const handleSendOrder = () => {
    if (!selectedTableId) { addToast('Vui lòng chọn bàn trước!', 'warning'); return; }
    if (!cart.length) { addToast('Vui lòng chọn món!', 'warning'); return; }
    if (canAddMore && tableOrder) {
      const ok = addItemsToOrder(tableOrder.id);
      if (ok) {
        addToast(`Đã thêm món vào đơn ${tableOrder.id}!`, 'success');
        setShowCart(false);
        printKitchenTicket({
          orderId: tableOrder.id + ' (THÊM)',
          tableName: selectedTable.name,
          items: cart,
          note: '',
          staffName: staffName(selectedStaffId),
        });
      }
      return;
    }
    const currentCart = [...cart];
    const currentTableName = selectedTable.name;
    const currentStaffName = staffName(selectedStaffId);
    const orderId = sendOrderToKitchen();
    if (orderId) {
      addToast(`Đã gửi đơn ${orderId} cho bếp!`, 'success');
      setShowCart(false);
      // Auto in phiếu bếp
      printKitchenTicket({
        orderId,
        tableName: currentTableName,
        items: currentCart,
        note: '',
        staffName: currentStaffName,
      });
    }
  };

  const handleSaveDraft = () => {
    if (!selectedTableId) { addToast('Vui lòng chọn bàn trước!', 'warning'); return; }
    if (!cart.length) { addToast('Vui lòng chọn món!', 'warning'); return; }
    const draftId = saveDraft();
    if (draftId) { addToast('Đã tạm lưu đơn hàng!', 'info'); setShowCart(false); }
  };

  const handlePay = (orderId) => {
    const methodLabel = PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label || 'Tiền mặt';
    // Lưu thông tin trước khi payOrder clear state
    const order = orders.find(o => o.id === orderId);
    const payData = order ? {
      orderId,
      tableName: order.tableName,
      items: order.items,
      total: order.total,
      paymentMethod,
      staffName: staffName(order.staffId),
    } : null;

    payOrder(orderId, paymentMethod);
    addToast(`Thanh toán ${methodLabel} thành công!`, 'success');
    setShowPayment(false);
    setPaymentMethod('cash');

    // Auto in hóa đơn
    if (payData) printReceipt(payData);
  };

  const handleAddToCart = (itemId) => {
    if (!selectedTableId) { addToast('Chọn bàn trước!', 'warning'); return; }
    if (selectedTable?.status === 'served') { addToast('Bàn này đã ra món, vui lòng thanh toán!', 'warning'); return; }
    addToCart(itemId);
  };

  const canOrder = selectedTableId && selectedTable?.status !== 'served';
  const servedOrders = orders.filter(o => o.status === 'done');

  const activeOrders = useMemo(() => {
    let result = orders.filter(o => o.status !== 'paid');
    if (orderTab !== 'all') {
      result = result.filter(o => (o.orderType || 'dine_in') === orderTab);
    }
    return result;
  }, [orders, orderTab]);

  const staffName = (staffId) => {
    const s = STAFF_LIST.find(st => st.id === staffId);
    return s ? s.name : '—';
  };

  return (
    <div className="order-view" id="order-view">
      {/* Top Action Bar */}
      <div className="order-topbar" id="order-topbar">
        <div className="order-topbar__left">
          <button
            className={`topbar-btn ${!showOrderList ? 'topbar-btn--active' : ''}`}
            onClick={() => setShowOrderList(false)}
          >
            <LayoutGrid size={15} /> Sơ đồ bàn
          </button>
          <button
            className={`topbar-btn ${showOrderList ? 'topbar-btn--active' : ''}`}
            onClick={() => setShowOrderList(true)}
          >
            <ClipboardList size={15} /> Đơn hàng
            {orderCounts.all > 0 && <span className="topbar-btn__badge">{orderCounts.all}</span>}
          </button>
        </div>
        <div className="order-topbar__right">
          <div className="staff-select" id="staff-select">
            <UserRound size={15} className="staff-select__icon" />
            <select
              className="staff-select__dropdown"
              value={selectedStaffId || ''}
              onChange={e => setSelectedStaff(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Chọn NV</option>
              {STAFF_LIST.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ========== ORDER LIST VIEW ========== */}
      {showOrderList ? (
        <section className="order-list-view" id="order-list-view">
          <div className="order-type-tabs" id="order-type-tabs">
            <button
              className={`order-type-tab ${orderTab === 'all' ? 'order-type-tab--active' : ''}`}
              onClick={() => setOrderTab('all')}
            >
              Tất cả ({orderCounts.all})
            </button>
            {ORDER_TYPES.map(t => (
              <button
                key={t.id}
                className={`order-type-tab ${orderTab === t.id ? 'order-type-tab--active' : ''}`}
                onClick={() => setOrderTab(t.id)}
              >
                {t.label} ({orderCounts[t.id] || 0})
              </button>
            ))}
            <button
              className={`order-type-tab order-type-tab--draft ${orderTab === 'draft' ? 'order-type-tab--active' : ''}`}
              onClick={() => setOrderTab('draft')}
            >
              <Save size={13} /> Tạm lưu ({drafts.length})
            </button>
          </div>

          <div className="order-cards" id="order-cards">
            {orderTab === 'draft' ? (
              drafts.length === 0 ? (
                <div className="order-list-empty">
                  <Save size={32} strokeWidth={1.5} />
                  <p>Không có đơn tạm lưu</p>
                </div>
              ) : (
                drafts.map(draft => (
                  <div key={draft.id} className="order-card order-card--draft" id={`draft-${draft.id}`}>
                    <div className="order-card__head">
                      <span className="order-card__table">{draft.tableName}</span>
                      <span className="order-card__type"><Save size={12} /> Tạm lưu</span>
                    </div>
                    <div className="order-card__items-preview">
                      {draft.items.slice(0, 3).map((item, i) => (
                        <span key={i}>{item.name} ×{item.quantity}</span>
                      ))}
                      {draft.items.length > 3 && <span>+{draft.items.length - 3} món khác</span>}
                    </div>
                    <div className="order-card__footer">
                      <span className="order-card__total">{formatCurrency(draft.total)}</span>
                      <div className="order-card__actions">
                        <button className="btn btn--sm btn--secondary" onClick={() => deleteDraft(draft.id)}>Xoá</button>
                        <button className="btn btn--sm btn--primary" onClick={() => {
                          loadDraft(draft.id);
                          setShowOrderList(false);
                          addToast('Đã nạp lại đơn tạm lưu!', 'info');
                        }}>Mở lại</button>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : activeOrders.length === 0 ? (
              <div className="order-list-empty">
                <ClipboardList size={32} strokeWidth={1.5} />
                <p>Không có đơn hàng</p>
              </div>
            ) : (
              activeOrders.map(order => (
                <div key={order.id} className={`order-card order-card--${order.status}`} id={`order-${order.id}`}>
                  <div className="order-card__head">
                    <div className="order-card__head-left">
                      <span className="order-card__table">{order.tableName}</span>
                      <span className="order-card__id">{order.id}</span>
                    </div>
                    <span className={`order-card__status order-card__status--${order.status}`}>
                      {order.status === 'pending' && <><Timer size={12} /> Chờ bếp</>}
                      {order.status === 'cooking' && <><Flame size={12} /> Đang nấu</>}
                      {order.status === 'done' && <><CircleCheck size={12} /> Đã ra</>}
                    </span>
                  </div>
                  {order.guestCount > 0 && (
                    <span className="order-card__guests"><Users size={12} /> {order.guestCount} khách</span>
                  )}
                  <div className="order-card__items-preview">
                    {order.items.map((item, i) => (
                      <span key={i}>{item.name} ×{item.quantity}</span>
                    ))}
                  </div>
                  {order.note && (
                    <div className="order-card__note"><PencilLine size={12} /> {order.note}</div>
                  )}
                  <div className="order-card__footer">
                    <span className="order-card__total">{formatCurrency(order.total)}</span>
                    <span className="order-card__time">
                      {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {order.status === 'done' && (
                      <button className="btn btn--sm btn--accent" onClick={() => {
                        selectTable(order.tableId);
                        setShowPayment(true);
                        setShowOrderList(false);
                      }}>
                        Thanh toán
                      </button>
                    )}
                    {(order.status === 'pending' || order.status === 'cooking') && (
                      <button className="btn btn--sm btn--secondary" onClick={() => {
                        selectTable(order.tableId);
                        setShowOrderList(false);
                      }}>
                        <Plus size={12} /> Thêm món
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : (
        <>
          {/* ========== TABLE GRID VIEW ========== */}
          <section className="order-view__tables" id="table-grid-section">
            <div className="section-header">
              <h2 className="section-title">Sơ đồ bàn</h2>
              <div className="section-header__right">
                <div className="area-filter">
                  {tableAreas.map(area => (
                    <button
                      key={area.id}
                      className={`area-btn ${tableAreaFilter === area.id ? 'area-btn--active' : ''}`}
                      onClick={() => setTableAreaFilter(area.id)}
                    >{area.name}</button>
                  ))}
                </div>
                <div className="table-legend">
                  {Object.entries(TABLE_STATUS_CONFIG).map(([key, cfg]) => (
                    <span key={key} className="table-legend__item">
                      <span className={`table-legend__dot table-legend__dot--${cfg.color}`} />
                      {cfg.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="table-grid" id="table-grid">
              {filteredTables.map(t => {
                const cfg = TABLE_STATUS_CONFIG[t.status];
                const isSelected = selectedTableId === t.id;
                const tOrder = t.orderId ? orders.find(o => o.id === t.orderId) : null;
                const tDraft = drafts.find(d => d.tableId === t.id);
                return (
                  <button
                    key={t.id}
                    id={`table-${t.id}`}
                    className={`table-card table-card--${cfg.color} ${isSelected ? 'table-card--selected' : ''}`}
                    onClick={() => {
                      selectTable(t.id);
                      if (t.status === 'served') {
                        setShowPayment(true);
                      } else {
                        setShowPayment(false);
                        const menuEl = document.getElementById('menu-section');
                        if (menuEl) menuEl.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    <span className="table-card__icon">{cfg.icon}</span>
                    <span className="table-card__name">{t.name}</span>
                    <div className="table-card__meta">
                      <span className="table-card__seats">{t.seats} ghế</span>
                      {t.guestCount > 0 && (
                        <span className="table-card__guests"><Users size={11} /> {t.guestCount}</span>
                      )}
                    </div>
                    <span className={`table-card__status table-card__status--${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {tOrder && (
                      <span className="table-card__total">{formatCurrency(tOrder.total)}</span>
                    )}
                    {tDraft && !tOrder && (
                      <span className="table-card__draft-badge"><Save size={10} /> Tạm lưu</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Guest count bar */}
            {selectedTable && selectedTable.status !== 'served' && (
              <div className="guest-count-bar" id="guest-count-bar">
                <div className="guest-count-bar__info">
                  <span className="guest-count-bar__table">{selectedTable.name}</span>
                  <span className="guest-count-bar__area">
                    {tableAreas.find(a => a.id === selectedTable.area)?.name}
                  </span>
                </div>
                <div className="guest-count-bar__input">
                  <label><Users size={14} /> Số khách:</label>
                  <div className="guest-count-controls">
                    <button className="qty-btn" onClick={() => setGuestCount(selectedTable.id, selectedTable.guestCount - 1)}><Minus size={14} /></button>
                    <span className="qty-value">{selectedTable.guestCount}</span>
                    <button className="qty-btn" onClick={() => setGuestCount(selectedTable.id, selectedTable.guestCount + 1)}><Plus size={14} /></button>
                  </div>
                </div>
                <div className="guest-count-bar__type">
                  <select
                    className="order-type-select"
                    value={orderType}
                    onChange={e => setOrderType(e.target.value)}
                  >
                    {ORDER_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* ========== CURRENT ORDER ITEMS (for waiting tables) ========== */}
          {canAddMore && tableOrder && (
            <section className="current-order-section">
              <div className="section-header">
                <h2 className="section-title">
                  <ClipboardList size={18} /> Đơn đang chờ — {selectedTable.name}
                </h2>
                <span className="current-order-total">
                  {formatCurrency(tableOrder.total)}
                </span>
              </div>
              <div className="current-order-items">
                <div className="current-order-items__header">
                  <span className="col-name">Tên món</span>
                  <span className="col-qty">SL</span>
                  <span className="col-price">Thành tiền</span>
                  <span className="col-del"></span>
                </div>
                {tableOrder.items.map((item, i) => (
                  <div key={i} className="current-order-item">
                    <span className="col-name">{item.name}</span>
                    <span className="col-qty">{item.quantity}</span>
                    <span className="col-price">{formatCurrency(item.price * item.quantity)}</span>
                    <button
                      className="current-order-item__delete"
                      title="Xoá món (cần mật khẩu admin)"
                      onClick={() => setPendingDeleteItem({ orderId: tableOrder.id, itemIndex: i, itemName: item.name })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {tableOrder.note && (
                <div className="current-order-note">
                  <PencilLine size={13} /> {tableOrder.note}
                </div>
              )}
            </section>
          )}

          {/* Payment Modal */}
          {showPayment && selectedTable && selectedTable.status === 'served' && tableOrder && (
            <div className="modal-overlay" onClick={() => setShowPayment(false)}>
              <div className="payment-modal" onClick={e => e.stopPropagation()}>
                <div className="payment-modal__header">
                  <h3><CircleDollarSign size={18} /> Thanh toán - {selectedTable.name}</h3>
                  <button className="modal-close" onClick={() => setShowPayment(false)}><X size={16} /></button>
                </div>
                <div className="payment-modal__body">
                  <div className="payment-meta">
                    <span><Users size={13} /> {tableOrder.guestCount || 0} khách</span>
                    <span><Clock size={13} /> {new Date(tableOrder.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    {tableOrder.staffId && <span><UserRound size={13} /> {staffName(tableOrder.staffId)}</span>}
                  </div>
                  <div className="payment-items">
                    <div className="payment-items__header">
                      <span>Tên món</span>
                      <span>SL</span>
                      <span>Thành tiền</span>
                    </div>
                    {tableOrder.items.map((item, i) => (
                      <div key={i} className="payment-item">
                        <span className="payment-item__name">{item.name}</span>
                        <span className="payment-item__qty">{item.quantity}</span>
                        <span className="payment-item__price">{formatCurrency(item.price * item.quantity)}</span>
                        <button
                          className="payment-item__delete"
                          title="Xoá món (cần mật khẩu admin)"
                          onClick={() => setPendingDeleteItem({ orderId: tableOrder.id, itemIndex: i, itemName: item.name })}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="payment-total">
                    <span>Tổng cộng</span>
                    <span className="payment-total__amount">{formatCurrency(tableOrder.total)}</span>
                  </div>
                </div>
                <div className="payment-method">
                  <span className="payment-method__label">Phương thức thanh toán</span>
                  <div className="payment-method__options">
                    <button
                      className={`payment-method__btn ${paymentMethod === 'cash' ? 'payment-method__btn--active' : ''}`}
                      onClick={() => setPaymentMethod('cash')}
                    >
                      <Banknote size={20} />
                      <span>Tiền mặt</span>
                    </button>
                    <button
                      className={`payment-method__btn ${paymentMethod === 'transfer' ? 'payment-method__btn--active' : ''}`}
                      onClick={() => setPaymentMethod('transfer')}
                    >
                      <Landmark size={20} />
                      <span>Chuyển khoản</span>
                    </button>
                  </div>
                </div>
                <div className="payment-modal__actions">
                  <button className="btn btn--secondary" onClick={() => setShowPayment(false)}>Huỷ bỏ</button>
                  <button className="btn btn--primary btn--lg" id="btn-pay" onClick={() => handlePay(tableOrder.id)}>
                    {paymentMethod === 'cash' ? <Banknote size={18} /> : <Landmark size={18} />}
                    Xác nhận thanh toán
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Admin Password Modal for item removal */}
          {pendingDeleteItem && (
            <div className="modal-overlay" onClick={() => { setPendingDeleteItem(null); setAdminPassInput(''); }}>
              <div className="admin-pass-modal" onClick={e => e.stopPropagation()}>
                <div className="admin-pass-modal__header">
                  <h3><Lock size={18} /> Xác nhận xoá món</h3>
                  <button className="modal-close" onClick={() => { setPendingDeleteItem(null); setAdminPassInput(''); }}><X size={16} /></button>
                </div>
                <div className="admin-pass-modal__body">
                  <p className="admin-pass-modal__msg">
                    Xoá <strong>{pendingDeleteItem.itemName}</strong> khỏi đơn hàng?
                  </p>
                  <label className="admin-pass-modal__label">Mật khẩu Admin</label>
                  <input
                    type="password"
                    className="admin-pass-modal__input"
                    placeholder="Nhập mật khẩu..."
                    value={adminPassInput}
                    onChange={e => setAdminPassInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (adminPassInput === 'admin123') {
                          removeItemFromOrder(pendingDeleteItem.orderId, pendingDeleteItem.itemIndex);
                          addToast(`Đã xoá: ${pendingDeleteItem.itemName}`, 'info');
                          setPendingDeleteItem(null);
                          setAdminPassInput('');
                          // close payment if order was deleted entirely
                          const orderStillExists = orders.find(o => o.id === pendingDeleteItem.orderId);
                          if (!orderStillExists || orderStillExists.items?.length <= 1) setShowPayment(false);
                        } else {
                          addToast('Sai mật khẩu!', 'warning');
                          setAdminPassInput('');
                        }
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="admin-pass-modal__actions">
                  <button className="btn btn--secondary" onClick={() => { setPendingDeleteItem(null); setAdminPassInput(''); }}>Huỷ</button>
                  <button className="btn btn--danger" onClick={() => {
                    if (adminPassInput === 'admin123') {
                      removeItemFromOrder(pendingDeleteItem.orderId, pendingDeleteItem.itemIndex);
                      addToast(`Đã xoá: ${pendingDeleteItem.itemName}`, 'info');
                      setPendingDeleteItem(null);
                      setAdminPassInput('');
                      const orderStillExists = orders.find(o => o.id === pendingDeleteItem.orderId);
                      if (!orderStillExists || orderStillExists.items?.length <= 1) setShowPayment(false);
                    } else {
                      addToast('Sai mật khẩu!', 'warning');
                      setAdminPassInput('');
                    }
                  }}>
                    <Trash2 size={16} /> Xác nhận xoá
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========== MENU SECTION ========== */}
          <section className="order-view__menu" id="menu-section">
            <div className="section-header">
              <h2 className="section-title">
                {canAddMore
                  ? <><PlusCircle size={18} /> Thêm món - {selectedTable.name}</>
                  : selectedTable
                    ? <><Utensils size={18} /> Gọi món - {selectedTable.name}</>
                    : <><Utensils size={18} /> Chọn bàn để gọi món</>
                }
              </h2>
            </div>

            {/* Search Bar */}
            <div className="menu-search" id="menu-search">
              <Search size={16} className="menu-search__icon" />
              <input
                type="text"
                className="menu-search__input"
                placeholder="Tìm món ăn..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                id="menu-search-input"
              />
              {searchQuery && (
                <button className="menu-search__clear" onClick={() => setSearchQuery('')}><X size={14} /></button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="category-tabs" id="category-tabs">
              <button
                className={`category-tab ${activeCategory === 'all' ? 'category-tab--active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                <Flame size={13} /> Tất cả
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`category-tab ${activeCategory === cat.id ? 'category-tab--active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            <div className="menu-grid" id="menu-grid">
              {filteredItems.length === 0 && (
                <div className="menu-empty">
                  <Search size={32} strokeWidth={1.5} />
                  <p>Không tìm thấy món &quot;{searchQuery}&quot;</p>
                </div>
              )}
              {filteredItems.map(item => {
                const inCart = cart.find(c => c.itemId === item.id);
                return (
                  <button
                    key={item.id}
                    id={`menu-item-${item.id}`}
                    className={`menu-card ${inCart ? 'menu-card--in-cart' : ''}`}
                    onClick={() => handleAddToCart(item.id)}
                    disabled={!canOrder}
                  >
                    <img className="menu-card__image" src={item.image} alt={item.name} loading="lazy" />
                    <span className="menu-card__name">{item.name}</span>
                    {item.desc && <span className="menu-card__desc">{item.desc}</span>}
                    <span className="menu-card__price">{formatCurrency(item.price)}</span>
                    {item.popular && <span className="menu-card__badge">HOT</span>}
                    {inCart && (
                      <span className="menu-card__qty">{inCart.quantity}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Floating Cart Button (Mobile) */}
      {cartCount > 0 && (
        <button className="fab-cart" id="fab-cart" onClick={() => setShowCart(true)}>
          <ShoppingCart size={18} />
          <span className="fab-cart__count">{cartCount}</span>
          <span className="fab-cart__total">{formatCurrency(cartTotal)}</span>
        </button>
      )}

      {/* Cart Panel */}
      {(showCart || cartCount > 0) && (
        <aside className={`cart-panel ${showCart ? 'cart-panel--open' : ''}`} id="cart-panel">
          <div className="cart-panel__header">
            <h3>
              {canAddMore
                ? <><PlusCircle size={16} /> Thêm món - {selectedTable?.name}</>
                : <><ShoppingCart size={16} /> Đơn hàng ({cartCount})</>
              }
            </h3>
            <button className="modal-close cart-panel__close-mobile" onClick={() => setShowCart(false)}>
              <X size={16} />
            </button>
          </div>

          {selectedTable && (
            <div className="cart-table-info">
              <span>{selectedTable.name}</span>
              <span><Users size={12} /> {selectedTable.guestCount}</span>
              {selectedStaffId && <span><UserRound size={12} /> {staffName(selectedStaffId)}</span>}
            </div>
          )}

          {cart.length === 0 ? (
            <div className="cart-empty">
              <Utensils size={32} strokeWidth={1.5} className="cart-empty__icon" />
              <p>Chưa có món nào</p>
              <p className="cart-empty__hint">Chọn món từ thực đơn bên trái</p>
            </div>
          ) : (
            <>
              <div className="cart-items-header">
                <span className="cart-items-header__name">Tên món</span>
                <span className="cart-items-header__qty">SL</span>
                <span className="cart-items-header__price">Thành tiền</span>
                <span className="cart-items-header__del"></span>
              </div>
              <div className="cart-items">
                {cart.map(c => (
                  <div key={c.itemId} className="cart-item">
                    <div className="cart-item__info">
                      <img className="cart-item__image" src={c.image} alt={c.name} />
                      <div>
                        <span className="cart-item__name">{c.name}</span>
                        <input 
                          type="text" 
                          className="cart-item__note-input"
                          placeholder="Ghi chú món (ít bún...)"
                          value={c.note || ''}
                          onChange={(e) => updateCartItemNote(c.itemId, e.target.value)}
                        />
                        <span className="cart-item__unit-price">{formatCurrency(c.price)}</span>
                      </div>
                    </div>
                    <div className="cart-item__qty-controls">
                      <button className="qty-btn" onClick={() => updateCartQty(c.itemId, -1)}><Minus size={14} /></button>
                      <span className="qty-value">{c.quantity}</span>
                      <button className="qty-btn" onClick={() => updateCartQty(c.itemId, +1)}><Plus size={14} /></button>
                    </div>
                    <span className="cart-item__subtotal">{formatCurrency(c.price * c.quantity)}</span>
                    <button className="cart-item__remove" onClick={() => removeFromCart(c.itemId)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>


              <div className="cart-footer">
                <div className="cart-total">
                  <span>Tổng tiền</span>
                  <span className="cart-total__amount">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="cart-footer__buttons">
                  <button className="btn btn--secondary btn--sm" onClick={() => clearCart()}>
                    <X size={13} /> Huỷ bỏ
                  </button>
                  <button className="btn btn--outline btn--sm" onClick={handleSaveDraft}>
                    <Save size={13} /> Tạm lưu
                  </button>
                  <button className="btn btn--primary btn--lg btn--full" id="btn-send-kitchen" onClick={handleSendOrder}>
                    <ArrowUpFromLine size={16} /> {canAddMore ? 'Gửi thêm cho bếp' : 'Gửi cho bếp'}
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      )}

      {/* Served Orders Notification Bar Removed */}
    </div>
  );
}
