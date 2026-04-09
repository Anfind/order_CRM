import useStore from '../store/useStore';
import { formatCurrency, STAFF_LIST, ORDER_TYPES } from '../data/mockData';
import {
  ChefHat, Flame, Timer, CircleCheck, Users,
  UserRound, PencilLine, Banknote
} from 'lucide-react';
import './KitchenView.css';

export default function KitchenView() {
  const orders = useStore(s => s.orders);
  const completeOrder = useStore(s => s.completeOrder);
  const addToast = useStore(s => s.addToast);

  const cooking = orders.filter(o => o.status === 'cooking' || o.status === 'pending');
  const done = orders.filter(o => o.status === 'done' || o.status === 'paid');
  const recentDone = done.slice(-8).reverse();

  const handleComplete = (orderId, tableName) => {
    completeOrder(orderId);
    addToast(`${tableName} đã ra món!`, 'success');
  };

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
          <span className="kitchen-stat kitchen-stat--cooking">
            <span className="kitchen-stat__dot" />
            {cooking.length} đang làm
          </span>
          <span className="kitchen-stat kitchen-stat--done">
            <span className="kitchen-stat__dot" />
            {done.length} hoàn thành
          </span>
        </div>
      </div>

      <div className="kitchen-board" id="kitchen-board">
        {/* Cooking Column */}
        <div className="kitchen-col">
          <div className="kitchen-col__header kitchen-col__header--cooking">
            <Flame size={16} className="kitchen-col__icon" />
            <span className="kitchen-col__title">Đang làm</span>
            <span className="kitchen-col__count">{cooking.length}</span>
          </div>
          <div className="kitchen-col__body">
            {cooking.length === 0 && (
              <div className="kitchen-empty">
                <Timer size={28} strokeWidth={1.5} />
                <p>Không có món đang làm</p>
              </div>
            )}
            {cooking.map(order => (
              <div key={order.id} className="kitchen-card kitchen-card--cooking" id={`kitchen-${order.id}`}>
                <div className="kitchen-card__head">
                  <span className="kitchen-card__table">{order.tableName}</span>
                  <span className="kitchen-card__time kitchen-card__time--live">
                    <Timer size={12} /> {getTimeSince(order.createdAt)}
                  </span>
                </div>
                <div className="kitchen-card__meta">
                  {order.guestCount > 0 && <span><Users size={11} /> {order.guestCount}</span>}
                  {order.staffId && <span><UserRound size={11} /> {STAFF_LIST.find(s => s.id === order.staffId)?.name}</span>}
                  {order.orderType && order.orderType !== 'dine_in' && (
                    <span className="kitchen-card__type">{ORDER_TYPES.find(t => t.id === order.orderType)?.label}</span>
                  )}
                </div>
                <div className="kitchen-card__items">
                  {order.items.map((item, i) => (
                    <div key={i} className="kitchen-card__item">
                      <img className="kitchen-card__item-img" src={item.image} alt={item.name} />
                      <span className="kitchen-card__item-name">{item.name}</span>
                      <span className="kitchen-card__item-qty">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
                {order.note && (
                  <div className="kitchen-card__note">
                    <PencilLine size={13} className="kitchen-card__note-icon" />
                    <span>{order.note}</span>
                  </div>
                )}
                <button
                  className="btn btn--accent btn--full"
                  onClick={() => handleComplete(order.id, order.tableName)}
                >
                  <CircleCheck size={15} /> Hoàn thành - Ra món
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Done Column */}
        <div className="kitchen-col">
          <div className="kitchen-col__header kitchen-col__header--done">
            <CircleCheck size={16} className="kitchen-col__icon" />
            <span className="kitchen-col__title">Đã xong</span>
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
              <div key={order.id} className="kitchen-card kitchen-card--done" id={`kitchen-${order.id}`}>
                <div className="kitchen-card__head">
                  <span className="kitchen-card__table">{order.tableName}</span>
                  <span className="kitchen-card__time">
                    {order.completedAt ? getTimeSince(order.completedAt) : ''}
                  </span>
                </div>
                <div className="kitchen-card__items kitchen-card__items--compact">
                  {order.items.map((item, i) => (
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
    </div>
  );
}
