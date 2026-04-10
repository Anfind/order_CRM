import React, { useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import './ShiftManager.css';

const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

const API = '/api/data';
const PRINT_API = '/api/print';

async function fetchShiftStats(shiftId) {
  const res = await fetch(`${API}/shifts/${shiftId}/stats`);
  if (!res.ok) throw new Error('Không tải được thống kê ca');
  return res.json();
}

async function fetchShiftTransactions(shiftId) {
  const res = await fetch(`${API}/shifts/${shiftId}/transactions`);
  if (!res.ok) throw new Error('Không tải được danh sách thu chi');
  return res.json();
}

async function printShiftReport(shiftData) {
  const res = await fetch(`${PRINT_API}/shift-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shiftData),
  });
  return res.json();
}

export default function ShiftManager({ onClose }) {
  const currentShift = useStore(s => s.currentShift);
  const openShift = useStore(s => s.openShift);
  const closeShift = useStore(s => s.closeShift);
  const addShiftTransaction = useStore(s => s.addShiftTransaction);
  const addToast = useStore(s => s.addToast);

  // Mode: open | manage | close
  const [mode, setMode] = useState(currentShift ? 'manage' : 'open');

  // Open shift state
  const [shiftName, setShiftName] = useState('Ca Sáng');
  const [startingCash, setStartingCash] = useState('');

  // Transaction form
  const [txType, setTxType] = useState('expense'); // 'expense' | 'income'
  const [txAmount, setTxAmount] = useState('');
  const [txReason, setTxReason] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Close shift state
  const [liveStats, setLiveStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [counts, setCounts] = useState(
    DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d]: '' }), {})
  );
  const [totalCounted, setTotalCounted] = useState(0);
  const [closing, setClosing] = useState(false);

  // Calculate counted total
  useEffect(() => {
    let total = 0;
    DENOMINATIONS.forEach(d => {
      total += d * (Number(counts[d]) || 0);
    });
    setTotalCounted(total);
  }, [counts]);

  // Load transactions for manage mode
  const loadTransactions = useCallback(async () => {
    if (!currentShift) return;
    setLoadingTx(true);
    try {
      const txs = await fetchShiftTransactions(currentShift.id);
      setTransactions(txs);
    } catch (err) {
      console.warn('Lỗi tải thu chi:', err.message);
    } finally {
      setLoadingTx(false);
    }
  }, [currentShift]);

  // Fetch live stats when entering close mode
  const loadLiveStats = useCallback(async () => {
    if (!currentShift) return;
    setLoadingStats(true);
    try {
      const stats = await fetchShiftStats(currentShift.id);
      setLiveStats(stats);
    } catch (err) {
      addToast('Lỗi tải thống kê ca: ' + err.message, 'error');
    } finally {
      setLoadingStats(false);
    }
  }, [currentShift, addToast]);

  useEffect(() => {
    if (mode === 'manage' && currentShift) loadTransactions();
    if (mode === 'close' && currentShift) loadLiveStats();
  }, [mode, currentShift, loadTransactions, loadLiveStats]);

  const formatMoney = (amount) => new Intl.NumberFormat('vi-VN').format(amount || 0);

  // ── Handle Transaction Submit ──
  const handleAddTransaction = async () => {
    const amt = Number(txAmount);
    if (!amt || amt <= 0) { addToast('Vui lòng nhập số tiền hợp lệ', 'warning'); return; }
    if (!txReason.trim()) { addToast('Vui lòng nhập lý do', 'warning'); return; }
    try {
      await addShiftTransaction(currentShift.id, amt, txReason.trim(), txType);
      setTxAmount('');
      setTxReason('');
      loadTransactions();
    } catch { /* handled in store */ }
  };

  // ── Open Shift ──
  const handleOpenShift = async () => {
    try {
      await openShift({
        name: shiftName,
        staffId: null,
        staffName: 'Quầy Thu Ngân',
        startingCash: Number(startingCash) || 0,
      });
      addToast(`Đã mở ${shiftName} thành công!`, 'success');
      onClose();
    } catch {
      // Handled in store
    }
  };

  // ── Close Shift ──
  const handleCloseShift = async () => {
    if (!window.confirm('Bạn có chắc muốn đóng ca và in biên bản bàn giao?')) return;
    setClosing(true);
    try {
      const closedShift = await closeShift(currentShift.id, {
        actualCash: totalCounted,
        handoverCash: totalCounted,
        denomination: counts,
      });

      // Print report
      try {
        await printShiftReport(closedShift);
        addToast('Đóng ca thành công — đang in biên bản!', 'success');
      } catch (printErr) {
        console.warn('[Print]', printErr);
        addToast('Đóng ca OK, nhưng in biên bản lỗi: ' + printErr.message, 'warning');
      }

      onClose();
    } catch {
      // Handled in store
    } finally {
      setClosing(false);
    }
  };

  const expectedCash = liveStats
    ? (currentShift?.starting_cash || 0) + (liveStats.cashIncome || 0) + (liveStats.extraIncome || 0) - (liveStats.cashExpense || 0)
    : 0;
  const difference = totalCounted - expectedCash;

  // ════════════════════════════════
  // RENDER: Open Shift
  // ════════════════════════════════
  if (mode === 'open' && !currentShift) {
    return (
      <div className="shift-overlay" onClick={onClose}>
        <div className="shift-dialog" onClick={e => e.stopPropagation()}>
          <div className="shift-header">
            <h3>🕐 Mở Ca Làm Việc</h3>
            <button className="shift-close-x" onClick={onClose}>✕</button>
          </div>

          <div className="shift-body">
            <div className="shift-field">
              <label>Tên ca</label>
              <select value={shiftName} onChange={e => setShiftName(e.target.value)}>
                <option value="Ca Sáng">☀️ Ca Sáng</option>
                <option value="Ca Chiều">🌤️ Ca Chiều</option>
                <option value="Ca Tối">🌙 Ca Tối</option>
                <option value="Ca Khuya">🌃 Ca Khuya</option>
              </select>
            </div>

            <div className="shift-field">
              <label>Tiền mặt đầu ca (đang có trong két)</label>
              <input
                type="number"
                placeholder="VD: 2000000"
                value={startingCash}
                onChange={e => setStartingCash(e.target.value)}
                className="money-input"
              />
              {startingCash && (
                <div className="money-hint">{formatMoney(startingCash)} đ</div>
              )}
            </div>
          </div>

          <div className="shift-footer">
            <button className="shift-btn secondary" onClick={onClose}>Hủy</button>
            <button className="shift-btn primary" onClick={handleOpenShift}>
              Bắt Đầu Ca
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════
  // RENDER: Manage Shift (Thu Chi)
  // ════════════════════════════════
  if (mode === 'manage' && currentShift) {
    return (
      <div className="shift-overlay" onClick={onClose}>
        <div className="shift-dialog wide" onClick={e => e.stopPropagation()}>
          <div className="shift-header">
            <h3>💰 Thu Chi Trong Ca — {currentShift.name}</h3>
            <button className="shift-close-x" onClick={onClose}>✕</button>
          </div>

          <div className="shift-body two-col">
            {/* Left: Transaction Form */}
            <div className="shift-col">
              <h4 className="col-title">Thêm khoản Thu / Chi</h4>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  className={`shift-btn ${txType === 'income' ? 'primary' : 'secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setTxType('income')}
                >
                  📥 Thu vào
                </button>
                <button
                  className={`shift-btn ${txType === 'expense' ? 'primary' : 'secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setTxType('expense')}
                >
                  📤 Chi ra
                </button>
              </div>

              <div className="shift-field">
                <label>Số tiền (VNĐ)</label>
                <input
                  type="number"
                  placeholder="VD: 50000"
                  value={txAmount}
                  onChange={e => setTxAmount(e.target.value)}
                  className="money-input"
                />
                {txAmount && (
                  <div className="money-hint">{formatMoney(txAmount)} đ</div>
                )}
              </div>

              <div className="shift-field">
                <label>Lý do / Ghi chú</label>
                <input
                  type="text"
                  placeholder="VD: Mua đá, Khách trả cọc..."
                  value={txReason}
                  onChange={e => setTxReason(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '6px', border: '1.5px solid var(--color-border)', width: '100%', fontSize: '14px' }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTransaction(); }}
                />
              </div>

              <button
                className="shift-btn primary"
                style={{ width: '100%', marginTop: '8px' }}
                onClick={handleAddTransaction}
              >
                {txType === 'income' ? '📥 Ghi nhận Thu' : '📤 Ghi nhận Chi'}
              </button>
            </div>

            {/* Right: Transaction History */}
            <div className="shift-col">
              <h4 className="col-title">Lịch sử Thu Chi ({transactions.length})</h4>
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {loadingTx ? (
                  <div className="stats-loading">Đang tải...</div>
                ) : transactions.length === 0 ? (
                  <div className="stats-loading" style={{ opacity: 0.5 }}>Chưa có khoản thu chi nào</div>
                ) : (
                  transactions.map(tx => (
                    <div key={tx.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', borderBottom: '1px solid var(--color-divider)',
                      background: tx.type === 'income' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                      borderRadius: '6px', marginBottom: '4px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text)' }}>{tx.reason}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {new Date(tx.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span style={{
                        fontWeight: 700, fontSize: '15px',
                        color: tx.type === 'income' ? '#16a34a' : '#dc2626'
                      }}>
                        {tx.type === 'income' ? '+' : '−'}{formatMoney(tx.amount)}đ
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="shift-footer">
            <button className="shift-btn secondary" onClick={onClose}>Đóng</button>
            <button className="shift-btn primary" onClick={() => setMode('close')}>
              📋 Kiểm Đếm & Đóng Ca
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════
  // RENDER: Close Shift (Kiểm đếm + Bàn giao)
  // ════════════════════════════════
  if (mode === 'close' && currentShift) {
    return (
      <div className="shift-overlay" onClick={onClose}>
        <div className="shift-dialog wide" onClick={e => e.stopPropagation()}>
          <div className="shift-header">
            <h3>📋 Kiểm Đếm & Bàn Giao Ca</h3>
            <button className="shift-close-x" onClick={onClose}>✕</button>
          </div>

          <div className="shift-body two-col">
            {/* Left: Denomination counting */}
            <div className="shift-col">
              <h4 className="col-title">Nhập số lượng tờ tiền</h4>
              <div className="denom-list">
                {DENOMINATIONS.map(d => (
                  <div key={d} className="denom-row">
                    <span className="denom-label">{formatMoney(d)}đ</span>
                    <span className="denom-x">×</span>
                    <input
                      type="number"
                      min="0"
                      className="denom-input"
                      value={counts[d]}
                      onChange={e => setCounts({ ...counts, [d]: e.target.value })}
                      placeholder="0"
                      onFocus={e => e.target.select()}
                    />
                    <span className="denom-result">
                      = {formatMoney(d * (Number(counts[d]) || 0))}đ
                    </span>
                  </div>
                ))}
              </div>
              <div className="denom-total">
                <span>Tổng kiểm đếm</span>
                <strong>{formatMoney(totalCounted)} đ</strong>
              </div>
            </div>

            {/* Right: Summary */}
            <div className="shift-col">
              <h4 className="col-title">Tổng kết ca</h4>

              {loadingStats ? (
                <div className="stats-loading">Đang tải thống kê...</div>
              ) : liveStats ? (
                <div className="summary-card">
                  <div className="summary-row">
                    <span>💰 Tổng doanh thu</span>
                    <strong className="text-primary">{formatMoney(liveStats.totalRevenue)} đ</strong>
                  </div>
                  <div className="summary-divider" />

                  <div className="summary-group-title">Tiền mặt (VND)</div>
                  <div className="summary-row indent">
                    <span>Đầu ca</span>
                    <span>{formatMoney(currentShift.starting_cash)} đ</span>
                  </div>
                  <div className="summary-row indent green">
                    <span>+ Thu tiền mặt</span>
                    <span>{formatMoney(liveStats.cashIncome)} đ</span>
                  </div>
                  {(liveStats.extraIncome || 0) > 0 && (
                    <div className="summary-row indent green">
                      <span>+ Thu phụ (két)</span>
                      <span>{formatMoney(liveStats.extraIncome)} đ</span>
                    </div>
                  )}
                  <div className="summary-row indent red">
                    <span>− Chi trong ca</span>
                    <span>{formatMoney(liveStats.cashExpense)} đ</span>
                  </div>
                  <div className="summary-divider dashed" />
                  <div className="summary-row">
                    <span>= Cần có trong két</span>
                    <strong className="text-primary">{formatMoney(expectedCash)} đ</strong>
                  </div>

                  <div className="summary-divider" />

                  <div className="summary-row">
                    <span>🔄 Chuyển khoản</span>
                    <span>{formatMoney(liveStats.transferIncome)} đ</span>
                  </div>
                  <div className="summary-row">
                    <span>📝 SL hóa đơn</span>
                    <span>{liveStats.totalOrders}</span>
                  </div>
                  <div className="summary-row">
                    <span>⏳ Chưa thanh toán</span>
                    <span className={liveStats.unpaidOrders > 0 ? 'text-danger' : ''}>
                      {liveStats.unpaidOrders}
                    </span>
                  </div>

                  <div className="summary-divider" />

                  <div className="summary-row big">
                    <span>Tiền kiểm đếm</span>
                    <strong>{formatMoney(totalCounted)} đ</strong>
                  </div>
                  <div className={`summary-row big ${difference < 0 ? 'red' : difference > 0 ? 'green' : ''}`}>
                    <span>Chênh lệch</span>
                    <strong>{difference > 0 ? '+' : ''}{formatMoney(difference)} đ</strong>
                  </div>
                </div>
              ) : (
                <div className="stats-loading">Không tải được dữ liệu</div>
              )}
            </div>
          </div>

          <div className="shift-footer">
            <button className="shift-btn secondary" onClick={() => setMode('manage')}>← Quay lại</button>
            <button
              className="shift-btn primary"
              onClick={handleCloseShift}
              disabled={closing || loadingStats}
            >
              {closing ? 'Đang xử lý...' : '🖨️ Bàn Giao & Đóng Ca'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
