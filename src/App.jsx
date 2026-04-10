import { useEffect, useState } from 'react';
import useStore from './store/useStore';
import Header from './components/Header';
import OrderView from './components/OrderView';
import KitchenView from './components/KitchenView';
import AdminView from './components/AdminView';
import ShiftManager from './components/ShiftManager';
import ToastContainer from './components/Toast';
import { Clock } from 'lucide-react';

export default function App() {
  const role = useStore(s => s.role);
  const serverLoading = useStore(s => s.serverLoading);
  const loadFromServer = useStore(s => s.loadFromServer);
  const currentShift = useStore(s => s.currentShift);
  const [showShiftModal, setShowShiftModal] = useState(false);

  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  // Warn on tab close if shift is still open
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (currentShift) {
        e.preventDefault();
        e.returnValue = 'Bạn chưa kết ca! Vui lòng kết ca trước khi thoát.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentShift]);

  const needsShift = !currentShift && role !== 'admin' && !serverLoading;

  return (
    <div className="app" id="app-root">
      <Header />
      <main className="app__main">
        {serverLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' }}>
            Đang kết nối...
          </div>
        ) : needsShift ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '20px', textAlign: 'center', padding: '20px' }}>
            <Clock size={48} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
            <h2 style={{ color: 'var(--color-text)', fontWeight: 700 }}>Chưa mở ca làm việc</h2>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: '360px', lineHeight: 1.6 }}>
              Vui lòng mở ca trước khi bắt đầu phục vụ. Tất cả đơn hàng sẽ được ghi nhận vào ca hiện tại.
            </p>
            <button
              className="btn btn--primary btn--lg"
              style={{ padding: '12px 32px', fontSize: '16px' }}
              onClick={() => setShowShiftModal(true)}
            >
              <Clock size={18} /> Mở Ca Ngay
            </button>
          </div>
        ) : (
          <>
            {role === 'order' && <OrderView />}
            {role === 'kitchen' && <KitchenView />}
            {role === 'admin' && <AdminView />}
          </>
        )}
      </main>
      <ToastContainer />
      {showShiftModal && <ShiftManager onClose={() => setShowShiftModal(false)} />}
    </div>
  );
}
