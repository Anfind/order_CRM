import { useState, useMemo } from 'react';
import useStore from '../store/useStore';
import { MENU_ITEMS, MENU_CATEGORIES, TABLE_STATUS_CONFIG, STAFF_LIST, ORDER_TYPES, TABLE_AREAS, formatCurrency } from '../data/mockData';
import './OrderView.css';

export default function OrderView() {
  const tables = useStore(s => s.tables);
  const selectedTableId = useStore(s => s.selectedTableId);
  const selectTable = useStore(s => s.selectTable);
  const cart = useStore(s => s.cart);
  const cartNote = useStore(s => s.cartNote);
  const addToCart = useStore(s => s.addToCart);
  const updateCartQty = useStore(s => s.updateCartQty);
  const removeFromCart = useStore(s => s.removeFromCart);
  const setCartNote = useStore(s => s.setCartNote);
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

  const [activeCategory, setActiveCategory] = useState('all');
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderTab, setOrderTab] = useState('dine_in');
  const [showOrderList, setShowOrderList] = useState(false);
  const [tableAreaFilter, setTableAreaFilter] = useState('all');

  const selectedTable = tables.find(t => t.id === selectedTableId);
  const tableOrder = selectedTable?.orderId
    ? orders.find(o => o.id === selectedTable.orderId)
    : null;

  // Is current table in "waiting" state? Allow adding more items
  const canAddMore = selectedTable && selectedTable.status === 'waiting' && tableOrder;

  // Filter menu items
  const filteredItems = useMemo(() => {
    let items = MENU_ITEMS;

    // Category filter
    if (activeCategory === 'popular') {
      items = items.filter(m => m.popular);
    } else if (activeCategory !== 'all') {
      items = items.filter(m => m.category === activeCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(m => m.name.toLowerCase().includes(q));
    }

    return items;
  }, [activeCategory, searchQuery]);

  // Filter tables by area
  const filteredTables = useMemo(() => {
    if (tableAreaFilter === 'all') return tables;
    return tables.filter(t => t.area === tableAreaFilter);
  }, [tables, tableAreaFilter]);

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  // Order list counts by type
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
    if (!selectedTableId) {
      addToast('Vui lòng chọn bàn trước!', 'warning');
      return;
    }
    if (!cart.length) {
      addToast('Vui lòng chọn món!', 'warning');
      return;
    }

    // If adding to existing order
    if (canAddMore && tableOrder) {
      const ok = addItemsToOrder(tableOrder.id);
      if (ok) {
        addToast(`Đã thêm món vào đơn ${tableOrder.id}!`, 'success');
        setShowCart(false);
      }
      return;
    }

    const orderId = sendOrderToKitchen();
    if (orderId) {
      addToast(`Đã gửi đơn ${orderId} cho bếp!`, 'success');
      setShowCart(false);
    }
  };

  const handleSaveDraft = () => {
    if (!selectedTableId) {
      addToast('Vui lòng chọn bàn trước!', 'warning');
      return;
    }
    if (!cart.length) {
      addToast('Vui lòng chọn món!', 'warning');
      return;
    }
    const draftId = saveDraft();
    if (draftId) {
      addToast('Đã tạm lưu đơn hàng!', 'info');
      setShowCart(false);
    }
  };

  const handlePay = (orderId) => {
    payOrder(orderId);
    addToast('Thanh toán thành công! 🎉', 'success');
    setShowPayment(false);
  };

  const handleAddToCart = (itemId) => {
    if (!selectedTableId) {
      addToast('Chọn bàn trước!', 'warning');
      return;
    }
    if (selectedTable?.status === 'served') {
      addToast('Bàn này đã ra món, vui lòng thanh toán!', 'warning');
      return;
    }
    addToCart(itemId);
  };

  const canOrder = selectedTableId && selectedTable?.status !== 'served';

  // Served orders notification
  const servedOrders = orders.filter(o => o.status === 'done');

  // Active orders (for order list)
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
            🪑 Sơ đồ bàn
          </button>
          <button
            className={`topbar-btn ${showOrderList ? 'topbar-btn--active' : ''}`}
            onClick={() => setShowOrderList(true)}
          >
            📋 Đơn hàng
            {orderCounts.all > 0 && <span className="topbar-btn__badge">{orderCounts.all}</span>}
          </button>
        </div>
        <div className="order-topbar__right">
          {/* Staff Selector */}
          <div className="staff-select" id="staff-select">
            <span className="staff-select__icon">👨‍💼</span>
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
          {/* Order Type Tabs */}
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
                {t.icon} {t.label} ({orderCounts[t.id] || 0})
              </button>
            ))}
            <button
              className={`order-type-tab order-type-tab--draft ${orderTab === 'draft' ? 'order-type-tab--active' : ''}`}
              onClick={() => setOrderTab('draft')}
            >
              💾 Tạm lưu ({drafts.length})
            </button>
          </div>

          {/* Order Cards */}
          <div className="order-cards" id="order-cards">
            {orderTab === 'draft' ? (
              drafts.length === 0 ? (
                <div className="order-list-empty">
                  <span>💾</span>
                  <p>Không có đơn tạm lưu</p>
                </div>
              ) : (
                drafts.map(draft => (
                  <div key={draft.id} className="order-card order-card--draft" id={`draft-${draft.id}`}>
                    <div className="order-card__head">
                      <span className="order-card__table">{draft.tableName}</span>
                      <span className="order-card__type">💾 Tạm lưu</span>
                    </div>
                    <div className="order-card__items-preview">
                      {draft.items.slice(0, 3).map((item, i) => (
                        <span key={i}>{item.image} {item.name} ×{item.quantity}</span>
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
                <span>📋</span>
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
                      {order.status === 'pending' && '⏳ Chờ bếp'}
                      {order.status === 'cooking' && '🔥 Đang nấu'}
                      {order.status === 'done' && '✅ Đã ra'}
                    </span>
                  </div>
                  {order.guestCount > 0 && (
                    <span className="order-card__guests">👤 {order.guestCount} khách</span>
                  )}
                  <div className="order-card__items-preview">
                    {order.items.map((item, i) => (
                      <span key={i}>{item.image} ×{item.quantity}</span>
                    ))}
                  </div>
                  {order.note && (
                    <div className="order-card__note">📝 {order.note}</div>
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
                        + Thêm món
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
                {/* Area filter */}
                <div className="area-filter">
                  <button
                    className={`area-btn ${tableAreaFilter === 'all' ? 'area-btn--active' : ''}`}
                    onClick={() => setTableAreaFilter('all')}
                  >Tất cả</button>
                  {TABLE_AREAS.map(area => (
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
                      if (t.status === 'served') setShowPayment(true);
                      else setShowPayment(false);
                    }}
                  >
                    <span className="table-card__icon">{cfg.icon}</span>
                    <span className="table-card__name">{t.name}</span>
                    <div className="table-card__meta">
                      <span className="table-card__seats">{t.seats} ghế</span>
                      {t.guestCount > 0 && (
                        <span className="table-card__guests">👤 {t.guestCount}</span>
                      )}
                    </div>
                    <span className={`table-card__status table-card__status--${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {tOrder && (
                      <span className="table-card__total">{formatCurrency(tOrder.total)}</span>
                    )}
                    {tDraft && !tOrder && (
                      <span className="table-card__draft-badge">💾 Tạm lưu</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Guest count for selected table */}
            {selectedTable && selectedTable.status !== 'served' && (
              <div className="guest-count-bar" id="guest-count-bar">
                <div className="guest-count-bar__info">
                  <span className="guest-count-bar__table">{selectedTable.name}</span>
                  <span className="guest-count-bar__area">
                    {TABLE_AREAS.find(a => a.id === selectedTable.area)?.name}
                  </span>
                </div>
                <div className="guest-count-bar__input">
                  <label>👤 Số khách:</label>
                  <div className="guest-count-controls">
                    <button className="qty-btn" onClick={() => setGuestCount(selectedTable.id, selectedTable.guestCount - 1)}>−</button>
                    <span className="qty-value">{selectedTable.guestCount}</span>
                    <button className="qty-btn" onClick={() => setGuestCount(selectedTable.id, selectedTable.guestCount + 1)}>+</button>
                  </div>
                </div>
                {/* Order Type selector */}
                <div className="guest-count-bar__type">
                  <select
                    className="order-type-select"
                    value={orderType}
                    onChange={e => setOrderType(e.target.value)}
                  >
                    {ORDER_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* Payment Modal */}
          {showPayment && selectedTable && selectedTable.status === 'served' && tableOrder && (
            <div className="modal-overlay" onClick={() => setShowPayment(false)}>
              <div className="payment-modal" onClick={e => e.stopPropagation()}>
                <div className="payment-modal__header">
                  <h3>💰 Thanh toán - {selectedTable.name}</h3>
                  <button className="modal-close" onClick={() => setShowPayment(false)}>✕</button>
                </div>
                <div className="payment-modal__body">
                  <div className="payment-meta">
                    <span>👤 {tableOrder.guestCount || 0} khách</span>
                    <span>🕐 {new Date(tableOrder.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    {tableOrder.staffId && <span>👨‍💼 {staffName(tableOrder.staffId)}</span>}
                  </div>
                  <div className="payment-items">
                    <div className="payment-items__header">
                      <span>Tên món</span>
                      <span>SL</span>
                      <span>Thành tiền</span>
                    </div>
                    {tableOrder.items.map((item, i) => (
                      <div key={i} className="payment-item">
                        <span className="payment-item__name">{item.image} {item.name}</span>
                        <span className="payment-item__qty">{item.quantity}</span>
                        <span className="payment-item__price">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="payment-total">
                    <span>Tổng cộng</span>
                    <span className="payment-total__amount">{formatCurrency(tableOrder.total)}</span>
                  </div>
                </div>
                <div className="payment-modal__actions">
                  <button className="btn btn--secondary" onClick={() => setShowPayment(false)}>Huỷ bỏ</button>
                  <button className="btn btn--primary btn--lg" id="btn-pay" onClick={() => handlePay(tableOrder.id)}>
                    💵 Thanh toán tiền mặt
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
                  ? `➕ Thêm món - ${selectedTable.name}`
                  : selectedTable
                    ? `🍽️ Gọi món - ${selectedTable.name}`
                    : '🍽️ Chọn bàn để gọi món'
                }
              </h2>
            </div>

            {/* Search Bar */}
            <div className="menu-search" id="menu-search">
              <span className="menu-search__icon">🔍</span>
              <input
                type="text"
                className="menu-search__input"
                placeholder="Tìm món ăn..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                id="menu-search-input"
              />
              {searchQuery && (
                <button className="menu-search__clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="category-tabs" id="category-tabs">
              <button
                className={`category-tab ${activeCategory === 'all' ? 'category-tab--active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                🔥 Tất cả
              </button>
              {MENU_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`category-tab ${activeCategory === cat.id ? 'category-tab--active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            <div className="menu-grid" id="menu-grid">
              {filteredItems.length === 0 && (
                <div className="menu-empty">
                  <span>🔍</span>
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
                    <span className="menu-card__image">{item.image}</span>
                    <span className="menu-card__name">{item.name}</span>
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
          <span className="fab-cart__icon">🛒</span>
          <span className="fab-cart__count">{cartCount}</span>
          <span className="fab-cart__total">{formatCurrency(cartTotal)}</span>
        </button>
      )}

      {/* Cart Panel */}
      {(showCart || cartCount > 0) && (
        <aside className={`cart-panel ${showCart ? 'cart-panel--open' : ''}`} id="cart-panel">
          <div className="cart-panel__header">
            <h3>
              {canAddMore ? `➕ Thêm món - ${selectedTable?.name}` : `🛒 Đơn hàng (${cartCount})`}
            </h3>
            <button className="modal-close cart-panel__close-mobile" onClick={() => setShowCart(false)}>✕</button>
          </div>

          {/* Table info in cart */}
          {selectedTable && (
            <div className="cart-table-info">
              <span>{selectedTable.name}</span>
              <span>👤 {selectedTable.guestCount}</span>
              {selectedStaffId && <span>👨‍💼 {staffName(selectedStaffId)}</span>}
            </div>
          )}

          {cart.length === 0 ? (
            <div className="cart-empty">
              <span className="cart-empty__icon">🍽️</span>
              <p>Chưa có món nào</p>
              <p className="cart-empty__hint">Chọn món từ thực đơn bên trái</p>
            </div>
          ) : (
            <>
              {/* Cart Items Table */}
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
                      <span className="cart-item__image">{c.image}</span>
                      <div>
                        <span className="cart-item__name">{c.name}</span>
                        <span className="cart-item__unit-price">{formatCurrency(c.price)}</span>
                      </div>
                    </div>
                    <div className="cart-item__qty-controls">
                      <button className="qty-btn" onClick={() => updateCartQty(c.itemId, -1)}>−</button>
                      <span className="qty-value">{c.quantity}</span>
                      <button className="qty-btn" onClick={() => updateCartQty(c.itemId, +1)}>+</button>
                    </div>
                    <span className="cart-item__subtotal">{formatCurrency(c.price * c.quantity)}</span>
                    <button className="cart-item__remove" onClick={() => removeFromCart(c.itemId)}>🗑️</button>
                  </div>
                ))}
              </div>

              <div className="cart-note">
                <textarea
                  id="cart-note-input"
                  className="cart-note__input"
                  placeholder="Ghi chú cho bếp (ít cay, bỏ hành...)"
                  value={cartNote}
                  onChange={e => setCartNote(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="cart-footer">
                <div className="cart-total">
                  <span>Tổng tiền</span>
                  <span className="cart-total__amount">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="cart-footer__buttons">
                  <button className="btn btn--secondary btn--sm" onClick={() => clearCart()}>
                    ✕ Huỷ bỏ
                  </button>
                  <button className="btn btn--outline btn--sm" onClick={handleSaveDraft}>
                    💾 Tạm lưu
                  </button>
                  <button className="btn btn--primary btn--lg btn--full" id="btn-send-kitchen" onClick={handleSendOrder}>
                    📤 {canAddMore ? 'Gửi thêm cho bếp' : 'Gửi cho bếp'}
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      )}

      {/* Served Orders Notification Bar */}
      {servedOrders.length > 0 && !showOrderList && (
        <div className="served-bar" id="served-bar">
          {servedOrders.map(o => (
            <div key={o.id} className="served-bar__item">
              <span>✅ {o.tableName} đã ra món!</span>
              <button className="btn btn--accent btn--sm" onClick={() => {
                selectTable(o.tableId);
                setShowPayment(true);
              }}>
                Thanh toán
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
