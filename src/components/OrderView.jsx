import { useState, useMemo, useEffect } from 'react';
import useStore from '../store/useStore';
import { TABLE_STATUS_CONFIG, STAFF_LIST, ORDER_TYPES, PAYMENT_METHODS, formatCurrency } from '../data/mockData';
import { printKitchenTicket, printReceipt } from '../services/printApi';
import {
  LayoutGrid, ClipboardList, UserRound, Search, X, Minus, Plus, Trash2,
  ShoppingCart, Send, Save, CircleDollarSign, Banknote, Clock, PencilLine,
  Users, ChevronDown, CircleCheck, Flame, Timer, PlusCircle, Utensils,
  ArrowUpFromLine, Landmark, Lock, Printer, ArrowRightLeft, Scissors, Merge
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
  const updateTable = useStore(s => s.updateTable);
  const transferTable = useStore(s => s.transferTable);
  const splitBill = useStore(s => s.splitBill);
  const mergeBills = useStore(s => s.mergeBills);
  const cancelOrder = useStore(s => s.cancelOrder);

  // --- UI State ---
  const [subTab, setSubTab] = useState('order'); // 'order' | 'floorplan'
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [printReceiptOnPay, setPrintReceiptOnPay] = useState(false);
  const [showPaymentMode, setShowPaymentMode] = useState(false);
  const [tableAreaFilter, setTableAreaFilter] = useState(tableAreas[0]?.id || 'T1');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [splitSelected, setSplitSelected] = useState([]);
  const [mergeSelected, setMergeSelected] = useState([]);
  const [pendingCancelOrder, setPendingCancelOrder] = useState(false);
  const [cancelPassInput, setCancelPassInput] = useState('');

  // --- Derived Data ---
  const selectedTable = tables.find(t => t.id === selectedTableId);
  const tableOrder = selectedTable?.orderId
    ? orders.find(o => o.id === selectedTable.orderId)
    : null;
  const canAddMore = selectedTable && ['waiting', 'served', 'billing'].includes(selectedTable.status) && tableOrder;

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
  }, [activeCategory, searchQuery, menuItems]);

  const filteredTables = useMemo(() => {
    if (tableAreaFilter === 'all') return tables;
    return tables.filter(t => t.area === tableAreaFilter);
  }, [tables, tableAreaFilter]);

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const canOrder = selectedTableId != null;

  useEffect(() => {
    if (tableAreas.length > 0 && !tableAreas.find(a => a.id === tableAreaFilter)) {
      setTableAreaFilter(tableAreas[0].id);
    }
  }, [tableAreas, tableAreaFilter]);

  // --- Handlers ---
  const staffName = (staffId) => {
    const s = STAFF_LIST.find(st => st.id === staffId);
    return s ? s.name : '—';
  };

  const handleSelectTable = (tableId) => {
    selectTable(tableId);
    setShowPaymentMode(false);
    setSubTab('order');
  };

  const handleAddToCart = (itemId) => {
    if (!selectedTableId) { addToast('Chọn bàn trước!', 'warning'); return; }
    addToCart(itemId);
  };

  const handleSendOrder = () => {
    if (!selectedTableId) { addToast('Vui lòng chọn bàn trước!', 'warning'); return; }
    if (!cart.length) { addToast('Vui lòng chọn món!', 'warning'); return; }
    if (canAddMore && tableOrder) {
      // Snapshot before cart is cleared
      const kitchenItems = cart.filter(item => !item.no_kitchen);
      const ok = addItemsToOrder(tableOrder.id);
      if (ok) {
        addToast(`Đã thêm món vào đơn ${tableOrder.id}!`, 'success');
        if (kitchenItems.length > 0) {
          printKitchenTicket({
            orderId: tableOrder.id + ' (THÊM)',
            tableName: selectedTable.name,
            items: kitchenItems,
            note: '',
            staffName: staffName(selectedStaffId),
          });
        }
      }
      return;
    }
    const currentCart = [...cart];
    const currentTableName = selectedTable.name;
    const currentStaffName = staffName(selectedStaffId);
    const orderId = sendOrderToKitchen();
    if (orderId) {
      addToast(`Đã gửi đơn ${orderId} cho bếp!`, 'success');
      const kitchenItems = currentCart.filter(item => !item.no_kitchen);
      if (kitchenItems.length > 0) {
        printKitchenTicket({
          orderId,
          tableName: currentTableName,
          items: kitchenItems,
          note: '',
          staffName: currentStaffName,
        });
      }
    }
  };

  const handleSaveDraft = () => {
    if (!selectedTableId) { addToast('Vui lòng chọn bàn trước!', 'warning'); return; }
    if (!cart.length) { addToast('Vui lòng chọn món!', 'warning'); return; }
    const draftId = saveDraft();
    if (draftId) addToast('Đã tạm lưu đơn hàng!', 'info');
  };

  const handlePay = (orderId) => {
    const methodLabel = PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label || 'Tiền mặt';
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
    setShowPaymentMode(false);
    setPaymentMethod('cash');
    if (payData && printReceiptOnPay) printReceipt(payData);
  };

  const handlePrePrint = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    printReceipt({
      orderId,
      tableName: order.tableName,
      items: order.items,
      total: order.total,
      paymentMethod: 'temp',
      staffName: staffName(order.staffId),
    });
    addToast('Đã in phiếu tạm tính!', 'info');
  };

  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="order-view" id="order-view">
      {/* ===== SUB-TAB SWITCHER ===== */}
      <div className="ov-tabs" id="ov-tabs">
        <button
          className={`ov-tab ${subTab === 'floorplan' ? 'ov-tab--active' : ''}`}
          onClick={() => setSubTab('floorplan')}
        >
          <LayoutGrid size={15} /> Sơ đồ phòng bàn
        </button>
        <button
          className={`ov-tab ${subTab === 'order' ? 'ov-tab--active' : ''}`}
          onClick={() => setSubTab('order')}
        >
          <Utensils size={15} /> Chọn món (Thực đơn)
          {cartCount > 0 && <span className="ov-tab__badge">{cartCount}</span>}
        </button>
      </div>

      <div className="ov-split" id="ov-split">
        {/* ── LEFT PANEL: Sơ đồ HOẶC Menu ── */}
        <div className="ov-left">
          {subTab === 'floorplan' ? (
            <section className="floorplan" id="floorplan-section" style={{ padding: 0, overflowY: 'visible', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="floorplan__header">
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

              <div className="table-grid" id="table-grid" style={{ paddingBottom: '20px' }}>
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
                      onClick={() => handleSelectTable(t.id)}
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
                <div className="guest-count-bar" id="guest-count-bar" style={{ marginTop: 'auto' }}>
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
                    <select className="order-type-select" value={orderType} onChange={e => setOrderType(e.target.value)}>
                      {ORDER_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <>
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

              {/* Menu Grid */}
              <div className="menu-grid" id="menu-grid" style={{ paddingBottom: '20px' }}>
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
                      {inCart && <span className="menu-card__qty">{inCart.quantity}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT PANEL: Cart / Order ── */}
        <div className="ov-right">
            {/* Right Header — Table info */}
            <div className="ov-right__header">
              {selectedTable ? (
                <>
                  <div className="ov-right__table-info">
                    <span className="ov-right__table-name">{selectedTable.name}</span>
                    <span className={`ov-right__table-status ov-right__table-status--${TABLE_STATUS_CONFIG[selectedTable.status]?.color}`}>
                      {TABLE_STATUS_CONFIG[selectedTable.status]?.label}
                    </span>
                  </div>
                  <div className="ov-right__meta">
                    <span><Users size={13} /> {selectedTable.guestCount || 0}</span>
                    {tableOrder && <span><Clock size={13} /> {new Date(tableOrder.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                </>
              ) : (
                <>
                  <span className="ov-right__no-table">Chọn bàn từ Sơ đồ để order</span>
                  {/* Active Tables Quick Access */}
                  {(() => {
                    const activeTables = tables.filter(t => t.status !== 'empty' && t.orderId);
                    if (activeTables.length === 0) return null;
                    return (
                      <div className="ov-right__active-tables">
                        <span className="ov-right__active-label">Bàn đang có đơn:</span>
                        <div className="ov-right__active-list">
                          {activeTables.map(t => {
                            const cfg = TABLE_STATUS_CONFIG[t.status];
                            return (
                              <button
                                key={t.id}
                                className={`ov-right__active-chip ov-right__active-chip--${cfg?.color || 'gray'}`}
                                onClick={() => handleSelectTable(t.id)}
                              >
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Items Table Header */}
            <div className="ov-right__items-header">
              <span className="col-name">Tên món</span>
              <span className="col-qty">SL</span>
              <span className="col-price">Thành tiền</span>
              <span className="col-del"></span>
            </div>

            {/* Items Body (scrollable) */}
            <div className="ov-right__items-body">
              {/* Existing order items */}
              {tableOrder && tableOrder.items.map((item, i) => (
                <div key={`order-${i}`} className="ov-item ov-item--existing">
                  <span className="col-name">{item.name} {item.note && <em className="ov-item__note">» {item.note}</em>}</span>
                  <span className="col-qty">{item.quantity}</span>
                  <span className="col-price">{formatCurrency(item.price * item.quantity)}</span>
                  <button
                    className="ov-item__del"
                    title="Xoá món (cần mật khẩu admin)"
                    onClick={() => setPendingDeleteItem({ orderId: tableOrder.id, itemIndex: i, itemName: item.name })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Separator between existing + new cart items */}
              {tableOrder && cart.length > 0 && (
                <div className="ov-item-separator">
                  <PlusCircle size={12} /> Món mới thêm
                </div>
              )}

              {/* Cart items (new) */}
              {cart.map(c => (
                <div key={`cart-${c.itemId}`} className="ov-item ov-item--new">
                  <div className="col-name">
                    <span>{c.name}</span>
                    <input 
                      type="text" 
                      className="ov-item__note-input"
                      placeholder="Ghi chú..."
                      value={c.note || ''}
                      onChange={(e) => updateCartItemNote(c.itemId, e.target.value)}
                    />
                  </div>
                  <div className="col-qty">
                    <div className="ov-item__qty-controls">
                      <button className="qty-btn qty-btn--sm" onClick={() => updateCartQty(c.itemId, -1)}><Minus size={12} /></button>
                      <span>{c.quantity}</span>
                      <button className="qty-btn qty-btn--sm" onClick={() => updateCartQty(c.itemId, +1)}><Plus size={12} /></button>
                    </div>
                  </div>
                  <span className="col-price">{formatCurrency(c.price * c.quantity)}</span>
                  <button className="ov-item__del" onClick={() => removeFromCart(c.itemId)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Empty state */}
              {!tableOrder && cart.length === 0 && (
                <div className="ov-right__empty">
                  <Utensils size={40} strokeWidth={1.2} />
                  <p>Vui lòng chọn món phía bên trái để ghi order</p>
                </div>
              )}
            </div>

            {/* ── Right Footer ── */}
            <div className="ov-right__footer">
              {/* Staff + Total */}
              <div className="ov-right__footer-info">
                <div className="staff-select" id="staff-select">
                  <UserRound size={14} className="staff-select__icon" />
                  <select
                    className="staff-select__dropdown"
                    value={selectedStaffId || ''}
                    onChange={e => setSelectedStaff(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Chọn NV</option>
                    {STAFF_LIST.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="ov-right__total">
                  <span>Tổng tiền</span>
                  <span className="ov-right__total-amount">
                    {formatCurrency((tableOrder?.total || 0) + cartTotal)}
                  </span>
                </div>
              </div>

              {/* Payment Mode — inline controls */}
              {showPaymentMode && tableOrder && (
                <div className="ov-payment-inline">
                  <div className="payment-method__options">
                    <button
                      className={`payment-method__btn ${paymentMethod === 'cash' ? 'payment-method__btn--active' : ''}`}
                      onClick={() => setPaymentMethod('cash')}
                    >
                      <Banknote size={18} /> Tiền mặt
                    </button>
                    <button
                      className={`payment-method__btn ${paymentMethod === 'transfer' ? 'payment-method__btn--active' : ''}`}
                      onClick={() => setPaymentMethod('transfer')}
                    >
                      <Landmark size={18} /> Chuyển khoản
                    </button>
                  </div>
                  <div className="ov-payment-inline__row">
                    <label className="ov-payment-inline__print">
                      <input 
                        type="checkbox" 
                        checked={printReceiptOnPay} 
                        onChange={() => setPrintReceiptOnPay(!printReceiptOnPay)} 
                      />
                      In bill
                    </label>
                    <button className="btn btn--secondary btn--sm" onClick={() => handlePrePrint(tableOrder.id)}>
                      <Printer size={13} /> In tạm
                    </button>
                  </div>
                  <div className="ov-payment-inline__actions">
                    <button className="btn btn--secondary btn--sm" onClick={() => { setActionModal('transfer'); }}>
                      <ArrowRightLeft size={13} /> Chuyển bàn
                    </button>
                    <button className="btn btn--secondary btn--sm" onClick={() => { setSplitSelected([]); setActionModal('split'); }}>
                      <Scissors size={13} /> Tách bill
                    </button>
                    <button className="btn btn--secondary btn--sm" onClick={() => { setMergeSelected([]); setActionModal('merge'); }}>
                      <Merge size={13} /> Gộp bill
                    </button>
                    <button
                      className="btn btn--sm"
                      style={{ background: '#dc2626', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontWeight: 600 }}
                      onClick={() => { setPendingCancelOrder(true); setCancelPassInput(''); }}
                    >
                      <Trash2 size={13} /> Huỷ đơn / Trống bàn
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="ov-right__actions">
                {cart.length > 0 ? (
                  <>
                    <button className="btn btn--action btn--send" id="btn-send-kitchen" onClick={handleSendOrder}>
                      <ArrowUpFromLine size={16} /> {canAddMore ? 'Gửi thêm bếp' : 'Gửi bếp'}
                    </button>
                    <button className="btn btn--action btn--cancel" onClick={() => clearCart()}>
                      <X size={16} /> Huỷ bỏ
                    </button>
                  </>
                ) : tableOrder ? (
                  <>
                    {showPaymentMode ? (
                      <>
                        <button className="btn btn--action btn--pay" id="btn-pay" onClick={() => handlePay(tableOrder.id)}>
                          <CircleDollarSign size={16} /> Thu tiền
                        </button>
                        <button className="btn btn--action btn--cancel" onClick={() => {
                          setShowPaymentMode(false);
                          if (selectedTableId) updateTable(selectedTableId, { status: 'served' });
                        }}>
                          <X size={16} /> Đóng
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn--action btn--pay" onClick={() => {
                          setShowPaymentMode(true);
                          if (selectedTableId) updateTable(selectedTableId, { status: 'billing' });
                        }}>
                          <CircleDollarSign size={16} /> Tính tiền
                        </button>
                        <button
                          className="btn btn--action btn--cancel"
                          title="Huỷ toàn bộ đơn, giải phóng bàn về trống"
                          onClick={() => { setPendingCancelOrder(true); setCancelPassInput(''); }}
                        >
                          <Trash2 size={16} /> Huỷ đơn
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="ov-right__actions-placeholder">
                    Chọn bàn và chọn món để thao tác
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* ===== MODALS (kept as-is, outside layout) ===== */}

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

      {/* Cancel Order Modal */}
      {pendingCancelOrder && tableOrder && (
        <div className="modal-overlay" onClick={() => { setPendingCancelOrder(false); setCancelPassInput(''); }}>
          <div className="admin-pass-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-pass-modal__header">
              <h3><Trash2 size={18} /> Huỷ toàn bộ đơn — {selectedTable?.name}</h3>
              <button className="modal-close" onClick={() => { setPendingCancelOrder(false); setCancelPassInput(''); }}><X size={16} /></button>
            </div>
            <div className="admin-pass-modal__body">
              <p className="admin-pass-modal__msg">
                Xoá <strong>toàn bộ {tableOrder.items.length} món</strong> và giải phóng <strong>{selectedTable?.name}</strong> về trạng thái trống?
              </p>
              <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>⚠️ Hành động này không thể hoàn tác.</p>
              <label className="admin-pass-modal__label">Mật khẩu Admin</label>
              <input
                type="password"
                className="admin-pass-modal__input"
                placeholder="Nhập mật khẩu..."
                value={cancelPassInput}
                onChange={e => setCancelPassInput(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    if (cancelPassInput === 'admin123') {
                      setPendingCancelOrder(false);
                      setShowPaymentMode(false);
                      await cancelOrder(tableOrder.id);
                    } else {
                      addToast('Sai mật khẩu!', 'warning');
                      setCancelPassInput('');
                    }
                  }
                }}
                autoFocus
              />
            </div>
            <div className="admin-pass-modal__actions">
              <button className="btn btn--secondary" onClick={() => { setPendingCancelOrder(false); setCancelPassInput(''); }}>Huỷ bỏ</button>
              <button className="btn btn--danger" onClick={async () => {
                if (cancelPassInput === 'admin123') {
                  setPendingCancelOrder(false);
                  setShowPaymentMode(false);
                  await cancelOrder(tableOrder.id);
                } else {
                  addToast('Sai mật khẩu!', 'warning');
                  setCancelPassInput('');
                }
              }}>
                <Trash2 size={16} /> Xác nhận huỷ đơn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Table Modal */}
      {actionModal === 'transfer' && tableOrder && (
        <div className="modal-overlay" onClick={() => setActionModal(null)}>
          <div className="admin-pass-modal" style={{ minWidth: '360px', maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="admin-pass-modal__header">
              <h3><ArrowRightLeft size={18} /> Chuyển bàn — {selectedTable?.name}</h3>
              <button className="modal-close" onClick={() => setActionModal(null)}><X size={16} /></button>
            </div>
            <div className="admin-pass-modal__body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <p style={{ marginBottom: '12px', color: 'var(--color-text-muted)', fontSize: '14px' }}>Chọn bàn trống để chuyển đơn sang:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {tables.filter(t => t.status === 'empty' && t.id !== selectedTableId).map(t => (
                  <button
                    key={t.id}
                    className="btn btn--secondary"
                    style={{ padding: '14px 8px', fontSize: '14px', fontWeight: 600 }}
                    onClick={async () => {
                      await transferTable(tableOrder.id, selectedTableId, t.id);
                      setActionModal(null);
                      setShowPaymentMode(false);
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {tables.filter(t => t.status === 'empty' && t.id !== selectedTableId).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px 0' }}>Không có bàn trống nào</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Split Bill Modal */}
      {actionModal === 'split' && tableOrder && (
        <div className="modal-overlay" onClick={() => setActionModal(null)}>
          <div className="admin-pass-modal" style={{ minWidth: '400px', maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div className="admin-pass-modal__header">
              <h3><Scissors size={18} /> Tách bill — {selectedTable?.name}</h3>
              <button className="modal-close" onClick={() => setActionModal(null)}><X size={16} /></button>
            </div>
            <div className="admin-pass-modal__body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <p style={{ marginBottom: '12px', color: 'var(--color-text-muted)', fontSize: '14px' }}>Chọn món để tách ra:</p>
              {tableOrder.items.map((item, idx) => (
                <label key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  borderBottom: '1px solid var(--color-divider)', cursor: 'pointer',
                  background: splitSelected.includes(idx) ? 'rgba(59,130,246,0.08)' : 'transparent',
                  borderRadius: '6px', marginBottom: '2px'
                }}>
                  <input type="checkbox" checked={splitSelected.includes(idx)} onChange={() => {
                    setSplitSelected(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
                  }} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                  <span style={{ flex: 1, fontWeight: 500 }}>{item.name} ×{item.quantity}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{formatCurrency(item.price * item.quantity)}</span>
                </label>
              ))}
              {splitSelected.length > 0 && (
                <>
                  <div style={{ margin: '16px 0 8px', fontWeight: 600, fontSize: '14px' }}>Chuyển {splitSelected.length} món sang bàn:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {tables.filter(t => t.status === 'empty' && t.id !== selectedTableId).map(t => (
                      <button key={t.id} className="btn btn--primary btn--sm" style={{ padding: '10px 6px' }} onClick={async () => {
                        const ok = await splitBill(tableOrder.id, splitSelected, t.id);
                        if (ok) { setActionModal(null); setShowPaymentMode(false); }
                      }}>{t.name}</button>
                    ))}
                  </div>
                  {tables.filter(t => t.status === 'empty' && t.id !== selectedTableId).length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '12px 0' }}>Không có bàn trống</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Merge Bill Modal */}
      {actionModal === 'merge' && tableOrder && (() => {
        const otherActiveOrders = orders.filter(o => o.status === 'done' && o.id !== tableOrder.id);
        return (
          <div className="modal-overlay" onClick={() => setActionModal(null)}>
            <div className="admin-pass-modal" style={{ minWidth: '400px', maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
              <div className="admin-pass-modal__header">
                <h3><Merge size={18} /> Gộp bill vào — {selectedTable?.name}</h3>
                <button className="modal-close" onClick={() => setActionModal(null)}><X size={16} /></button>
              </div>
              <div className="admin-pass-modal__body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <p style={{ marginBottom: '12px', color: 'var(--color-text-muted)', fontSize: '14px' }}>Chọn bàn muốn gộp vào bàn {selectedTable?.name}:</p>
                {otherActiveOrders.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px 0' }}>Không có bàn nào khác đang có đơn</p>
                ) : (
                  otherActiveOrders.map(o => (
                    <label key={o.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
                      borderBottom: '1px solid var(--color-divider)', cursor: 'pointer',
                      background: mergeSelected.includes(o.id) ? 'rgba(59,130,246,0.08)' : 'transparent',
                      borderRadius: '6px', marginBottom: '2px'
                    }}>
                      <input type="checkbox" checked={mergeSelected.includes(o.id)} onChange={() => {
                        setMergeSelected(prev => prev.includes(o.id) ? prev.filter(i => i !== o.id) : [...prev, o.id]);
                      }} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{o.tableName || 'Bàn ?'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {o.items.map(i => `${i.name}×${i.quantity}`).join(', ')}
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-primary)' }}>{formatCurrency(o.total)}</span>
                    </label>
                  ))
                )}
              </div>
              {mergeSelected.length > 0 && (
                <div className="admin-pass-modal__actions">
                  <button className="btn btn--secondary" onClick={() => setActionModal(null)}>Huỷ</button>
                  <button className="btn btn--primary" onClick={async () => {
                    const ok = await mergeBills(tableOrder.id, mergeSelected);
                    if (ok) { setActionModal(null); setShowPaymentMode(false); }
                  }}>
                    <Merge size={16} /> Gộp {mergeSelected.length} bàn
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
