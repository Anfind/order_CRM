import { useState } from 'react';
import useStore from '../store/useStore';
import { formatCurrency, STAFF_LIST, ORDER_TYPES } from '../data/mockData';
import {
  ChefHat, Flame, Timer, CircleCheck, Users,
  UserRound, PencilLine, Banknote, X, Receipt
} from 'lucide-react';
import './KitchenView.css';

export default function KitchenView() {
  const orders = useStore(s => s.orders);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const done = orders.filter(o => o.status === 'done' || o.status === 'paid');
  const recentDone = done.slice(-24).reverse(); // Show more items in grid

  const getTimeSince = (isoStr) => {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút`;
    return `${Math.floor(mins / 60)}h${mins % 60}p`;
  };

  return (
    <div className="kitchen-view" id="kitchen-view">
      <div className="kitchen-view__header">
        <h2 className="section-title"><ChefHat size={20} /> Bếp</h2>
        <div className="kitchen-stats">
          <span className="kitchen-stat kitchen-stat--done">
            <span className="kitchen-stat__dot" />
            {done.filter(o => o.status === 'done').length} đang phục vụ · {done.filter(o => o.status === 'paid').length} đã thanh toán
          </span>
        </div>
      </div>

      <div className="kitchen-board" id="kitchen-board">
        {/* Done Grid */}
        <div className="kitchen-col">
          <div className="kitchen-col__header kitchen-col__header--done">
            <CircleCheck size={16} className="kitchen-col__icon" />
            <span className="kitchen-col__title">Đơn hàng</span>
            <span className="kitchen-col__count">{done.length}</span>
          </div>
          <div className="kitchen-col__body">
            {recentDone.length === 0 && (
              <div className="kitchen-empty">
                <ChefHat size={28} strokeWidth={1.5} />
                <p>Chưa có món hoàn thành</p>
              </div>
            )}
            {recentDone.map(order => (
              <div 
                key={order.id} 
                className="kitchen-card kitchen-card--done" 
                id={`kitchen-${order.id}`}
                onClick={() => setSelectedOrder(order)}
                style={{ cursor: 'pointer' }}
                title="Nhấn để xem chi tiết"
              >
                <div className="kitchen-card__head">
                  <span className="kitchen-card__table">{order.tableName}</span>
                  <span className="kitchen-card__time">
                    {order.completedAt ? getTimeSince(order.completedAt) : ''}
                  </span>
                </div>
                <div className="kitchen-card__items kitchen-card__items--compact">
                  {(order.items || []).map((item, i) => (
                    <span key={i} className="kitchen-card__item-compact">
                      {item.name} ×{item.quantity}
                    </span>
                  ))}
                </div>
                <span className={`kitchen-card__badge ${order.status === 'paid' ? 'kitchen-card__badge--paid' : ''}`}>
                  {order.status === 'paid' ? <><Banknote size={12} /> Đã thanh toán</> : <><CircleCheck size={12} /> Đã phục vụ</>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3><Receipt size={18} /> Chi tiết đơn hàng - {selectedOrder.tableName}</h3>
              <button className="btn btn--sm btn--secondary" onClick={() => setSelectedOrder(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ background: 'var(--color-bg-secondary)', padding: '15px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                <div><strong>Mã đơn:</strong> {selectedOrder.id}</div>
                <div><strong>Bàn/Khu:</strong> {selectedOrder.tableName}</div>
                <div><strong>Giờ tạo:</strong> {new Date(selectedOrder.createdAt).toLocaleString('vi-VN')}</div>
                <div><strong>Thu ngân:</strong> {STAFF_LIST.find(s => s.id === selectedOrder.staffId)?.name || '—'}</div>
                <div><strong>Khách:</strong> {selectedOrder.guestCount}</div>
                <div><strong>Trạng thái:</strong> {selectedOrder.status === 'paid' ? 'Đã thu tiền' : 'Đã ra món'}</div>
              </div>

              {selectedOrder.note && (
                <div style={{ background: 'var(--color-warning-light)', color: '#8B6914', padding: '10px 15px', borderRadius: '8px', fontSize: '14px', display: 'flex', gap: '8px' }}>
                  <PencilLine size={16} /> <strong>Ghi chú đơn:</strong> {selectedOrder.note}
                </div>
              )}

              <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: 'var(--color-bg-secondary)', padding: '10px 15px', fontWeight: 'bold', borderBottom: '1px solid var(--color-border)' }}>
                  Danh sách món
                </div>
                <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(selectedOrder.items || []).map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--color-surface)', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={item.image} alt={item.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '600' }}>{item.name}</span>
                          {item.note && <span style={{ fontSize: '12px', color: 'var(--color-warning)', fontStyle: 'italic' }}>» {item.note}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>×{item.quantity}</span>
                        <span style={{ fontWeight: '600', minWidth: '70px', textAlign: 'right' }}>{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', background: 'var(--color-bg-secondary)', borderTop: '1px solid var(--color-border)', fontWeight: 'bold' }}>
                  <span>Tổng tiền:</span>
                  <span style={{ color: 'var(--color-accent)', fontSize: '16px' }}>{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
