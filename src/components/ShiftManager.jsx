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
  const addToast = useStore(s => s.addToast);

  // Mode: open | close
  const [mode, setMode] = useState(currentShift ? 'close' : 'open');

  // Open shift state
  const [shiftName, setShiftName] = useState('Ca Sáng');
  const [startingCash, setStartingCash] = useState('');

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
    if (mode === 'close' && currentShift) {
      loadLiveStats();
    }
  }, [mode, currentShift, loadLiveStats]);

  const formatMoney = (amount) => new Intl.NumberFormat('vi-VN').format(amount || 0);

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
    ? (currentShift?.starting_cash || 0) + (liveStats.cashIncome || 0) - (liveStats.cashExpense || 0)
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
                    <span>+ Thu trong ca</span>
                    <span>{formatMoney(liveStats.cashIncome)} đ</span>
                  </div>
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
            <button className="shift-btn secondary" onClick={onClose}>Hủy</button>
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
