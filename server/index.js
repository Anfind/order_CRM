/**
 * POS Server — Data API + Print Server
 * - /api/data/* → SQLite database CRUD
 * - /api/print/* → Xprinter ESC/POS
 */
import express from 'express';
import cors from 'cors';
import dataApi from './api.js';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { printKitchenTicket, printReceipt, printShiftReport, testPrinter } from './print-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ──────────────────────────────────────
// Data API (SQLite)
// ──────────────────────────────────────

app.use('/api/data', dataApi);

// ──────────────────────────────────────
// Upload API (Multer)
// ──────────────────────────────────────

import { existsSync, mkdirSync } from 'fs';

const uploadDir = join(__dirname, '../public/images');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
  console.log('[Server] Created upload directory:', uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split('.').pop() || 'png';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'upload-' + uniqueSuffix + '.' + ext);
  }
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ url: '/images/' + req.file.filename });
});

// ──────────────────────────────────────
// Print API (Xprinter)
// ──────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pos-server' });
});

// Test kết nối máy in
app.get('/api/printer/test', async (_req, res) => {
  try {
    const result = await testPrinter();
    res.json(result);
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// In phiếu bếp
app.post('/api/print/kitchen', async (req, res) => {
  try {
    const { orderId, tableName, items, note, time, staffName } = req.body;

    if (!orderId || !items?.length) {
      return res.status(400).json({ error: 'Thiếu orderId hoặc items' });
    }

    await printKitchenTicket({
      orderId,
      tableName: tableName || 'N/A',
      items,
      note: note || '',
      time: time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      staffName: staffName || '',
    });

    console.log(`[PRINT] Kitchen ticket: ${orderId} - ${tableName}`);
    res.json({ success: true, orderId });
  } catch (err) {
    console.error(`[PRINT ERROR] Kitchen: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// In hóa đơn
app.post('/api/print/receipt', async (req, res) => {
  try {
    const { orderId, tableName, items, total, paymentMethod, time, staffName } = req.body;

    if (!orderId || !items?.length) {
      return res.status(400).json({ error: 'Thiếu orderId hoặc items' });
    }

    await printReceipt({
      orderId,
      tableName: tableName || 'N/A',
      items,
      total: total || 0,
      paymentMethod: paymentMethod || 'cash',
      time: time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      staffName: staffName || '',
    });

    console.log(`[PRINT] Receipt: ${orderId} - ${total}`);
    res.json({ success: true, orderId });
  } catch (err) {
    console.error(`[PRINT ERROR] Receipt: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// In biên bản bàn giao ca
app.post('/api/print/shift-report', async (req, res) => {
  try {
    const shift = req.body;
    if (!shift || !shift.id) {
      return res.status(400).json({ error: 'Thiếu thông tin ca' });
    }
    await printShiftReport(shift);
    console.log(`[PRINT] Shift report: ${shift.id} - ${shift.name}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[PRINT ERROR] Shift report: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test tất cả mã tiếng Việt (Code Pages)
app.get('/api/print/test', async (req, res) => {
  try {
    const result = await testPrinter();
    res.json({ success: true, message: 'Đã gửi lệnh in test mã Tiếng Việt tới máy in', status: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🖥️  POS Server running on http://localhost:${PORT}`);
  console.log(`   📦 Database: SQLite (server/pos.db)`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /api/health          — Health check`);
  console.log(`     GET  /api/data/sync       — Load all data`);
  console.log(`     GET  /api/data/tables     — Tables`);
  console.log(`     GET  /api/data/orders     — Orders`);
  console.log(`     GET  /api/data/drafts     — Drafts`);
  console.log(`     GET  /api/data/stats      — Statistics`);
  console.log(`     POST /api/print/kitchen   — In phiếu bếp`);
  console.log(`     POST /api/print/receipt   — In hóa đơn\n`);
});
