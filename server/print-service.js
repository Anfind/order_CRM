/**
 * Print Service — ESC/POS via PowerShell (USB)
 */
import { spawnSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import iconv from 'iconv-lite';

// ──────────────────────────────────────
// ESC/POS Command Builder
// ──────────────────────────────────────

class EscPos {
  constructor() { this.data = []; }

  raw(...bytes) { this.data.push(...bytes); return this; }
  init() {
    return this.raw(0x1B, 0x40) // ESC @ — Initialize printer
               .raw(0x1B, 0x74, 27); // ESC t 27 — Set PC1258 (Vietnamese Code Page for XPrinter)
  }

  text(str) {
    // Encode Vietnamese via iconv-lite to Windows-1258
    const buf = iconv.encode(str, 'win1258');
    for (const b of buf) this.data.push(b);
    return this;
  }
  println(str = '') { return this.text(str).raw(0x0A); }
  newLine(n = 1) { for (let i = 0; i < n; i++) this.raw(0x0A); return this; }

  align(a = 0) { return this.raw(0x1B, 0x61, a); }
  alignLeft() { return this.align(0); }
  alignCenter() { return this.align(1); }
  alignRight() { return this.align(2); }

  bold(on = true) { return this.raw(0x1B, 0x45, on ? 1 : 0); }
  size(w = 0, h = 0) { return this.raw(0x1D, 0x21, (w << 4) | h); }

  // 80mm printer = 48 columns normal mode
  line(char = '-', len = 48) { return this.println(char.repeat(len)); }

  // PC437 Box Drawing grid helpers for solid lines
  cp437() { return this.raw(0x1B, 0x74, 0); }
  cp1258() { return this.raw(0x1B, 0x74, 27); }

  gridTop(widths) {
    this.cp437().raw(0xDA); // ┌
    for (let i=0; i<widths.length; i++) {
      for(let j=0; j<widths[i]; j++) this.raw(0xC4); // ─
      if (i < widths.length - 1) this.raw(0xC2); // ┬
    }
    return this.raw(0xBF).newLine().cp1258(); // ┐
  }

  gridMid(widths) {
    this.cp437().raw(0xC3); // ├
    for (let i=0; i<widths.length; i++) {
      for(let j=0; j<widths[i]; j++) this.raw(0xC4); // ─
      if (i < widths.length - 1) this.raw(0xC5); // ┼
    }
    return this.raw(0xB4).newLine().cp1258(); // ┤
  }

  gridBot(widths) {
    this.cp437().raw(0xC0); // └
    for (let i=0; i<widths.length; i++) {
      for(let j=0; j<widths[i]; j++) this.raw(0xC4); // ─
      if (i < widths.length - 1) this.raw(0xC1); // ┴
    }
    return this.raw(0xD9).newLine().cp1258(); // ┘
  }

  gridRow(widths, texts, aligns) {
    this.cp437().raw(0xB3).cp1258(); // │
    for (let i=0; i<widths.length; i++) {
      const w = widths[i];
      let t = String(texts[i] || '');
      const safeT = t.slice(0, w);
      
      if (aligns && aligns[i] === 'right') {
         this.text(' '.repeat(Math.max(0, w - safeT.length)) + safeT);
      } else if (aligns && aligns[i] === 'center') {
         const spL = Math.floor((w - safeT.length) / 2);
         const spR = w - safeT.length - spL;
         this.text(' '.repeat(Math.max(0, spL)) + safeT + ' '.repeat(Math.max(0, spR)));
      } else {
         // left
         if (safeT.startsWith(' ')) this.text(safeT + ' '.repeat(Math.max(0, w - safeT.length)));
         else this.text(' ' + safeT + ' '.repeat(Math.max(0, w - safeT.length - 1)));
      }
      this.cp437().raw(0xB3).cp1258(); // │
    }
    return this.newLine();
  }

  // Plain table row (no borders)
  tableRow(cols, total = 48) {
    let row = '';
    for (const col of cols) {
      const w = Math.round(col.width * total);
      let t = String(col.text).slice(0, w);
      if (col.align === 'right') t = t.padStart(w);
      else if (col.align === 'center') {
        const p = Math.floor((w - t.length) / 2);
        t = ' '.repeat(p) + t + ' '.repeat(w - t.length - p);
      } else t = t.padEnd(w);
      row += t;
    }
    return this.println(row);
  }

  cut() { return this.raw(0x1D, 0x56, 0x41, 0x00); }

  beep(times = 3, duration = 3) {
    return this.raw(0x1B, 0x42, Math.min(9, Math.max(1, times)), Math.min(9, Math.max(1, duration)));
  }

  build() { return Buffer.from(this.data); }
}

// ──────────────────────────────────────
// PowerShell raw print
// ──────────────────────────────────────

const KITCHEN_PRINTER = process.env.KITCHEN_PRINTER || 'XP-80C';
const RECEIPT_PRINTER = process.env.RECEIPT_PRINTER || 'XP-80C';

function printRaw(printerName, buffer) {
  const ts = Date.now();
  const tmpBin = join(tmpdir(), `escpos_${ts}.bin`);
  const tmpName = join(tmpdir(), `printer_name_${ts}.txt`);

  try {
    writeFileSync(tmpBin, buffer);
    writeFileSync(tmpName, printerName, 'utf8');

    const ps = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$printerName = [IO.File]::ReadAllText("${tmpName.replace(/\\/g, '\\\\')}", [System.Text.Encoding]::UTF8).Trim()
$fileName    = "${tmpBin.replace(/\\/g, '\\\\')}"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrint {
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern int StartDocPrinter(IntPtr h, int lvl, ref DOCINFO di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h, IntPtr p, int cnt, out int written);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  public static string Send(string printer, string file) {
    IntPtr hPrinter;
    if (!OpenPrinter(printer, out hPrinter, IntPtr.Zero))
      return "ERR_OPEN:" + Marshal.GetLastWin32Error();
    DOCINFO di = new DOCINFO { pDocName="POS", pDataType="RAW" };
    StartDocPrinter(hPrinter, 1, ref di);
    StartPagePrinter(hPrinter);
    byte[] bytes = System.IO.File.ReadAllBytes(file);
    IntPtr pb = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, pb, bytes.Length);
    int written;
    bool ok = WritePrinter(hPrinter, pb, bytes.Length, out written);
    Marshal.FreeCoTaskMem(pb);
    EndPagePrinter(hPrinter);
    EndDocPrinter(hPrinter);
    ClosePrinter(hPrinter);
    if (!ok) return "ERR_WRITE:" + Marshal.GetLastWin32Error();
    return "OK:" + written;
  }
}
"@

$result = [RawPrint]::Send($printerName, $fileName)
Write-Output $result
`;

    const result = spawnSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command', ps,
    ], { encoding: 'utf8', timeout: 10000, windowsHide: true });

    if (result.error) throw new Error('PowerShell error: ' + result.error.message);
    const out = (result.stdout || '').trim();
    console.log('[printRaw]', printerName, '->', out);

    if (out.startsWith('OK:')) return { success: true };
    return { success: false, error: out };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    if (existsSync(tmpBin)) try { unlinkSync(tmpBin); } catch {}
    if (existsSync(tmpName)) try { unlinkSync(tmpName); } catch {}
  }
}

// ──────────────────────────────────────
// Helper: format string to fixed length with spaces for borders
// ──────────────────────────────────────
function padRight(str, len) {
  let s = String(str || '');
  if (s.length > len) s = s.substring(0, len);
  return s + ' '.repeat(Math.max(0, len - s.length));
}

function padLeft(str, len) {
  let s = String(str || '');
  if (s.length > len) s = s.substring(0, len);
  return ' '.repeat(Math.max(0, len - s.length)) + s;
}

// ──────────────────────────────────────
// In phiếu bếp — dạng bảng kẻ dọc
// ──────────────────────────────────────

export async function printKitchenTicket({ orderId, tableName, items, note, time, staffName }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = time || now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const esc = new EscPos();
  esc.init()
    .beep(3, 3)

    // Header
    .alignCenter()
    .bold(true).size(1, 1) // Double size instead of quad
    .println('CHẾ BIẾN')
    .size(0, 0).bold(false)
    .newLine()

    // Order info
    .alignLeft()
    .size(1, 0) // Double width
    .println('Order: ' + orderId)
    .println('Ngày: ' + dateStr + ' (' + timeStr + ')')
    .size(0, 0)
    .newLine()

    // Table name
    .bold(true).size(1, 1) // Double size
    .println('Bàn: ' + (tableName || 'N/A'))
    .size(0, 0).bold(false)
    .size(1, 0)
    .println('Người gửi: ' + (staffName || 'Quầy Thu Ngân'))
    .size(0, 0)
    .newLine()

    // Bordered Table Header
    .bold(true).size(1, 1) // 24 columns mode for table
    .gridTop([3, 18])
    .gridRow([3, 18], ['SL', 'Tên món'], ['center', 'left'])
    .gridMid([3, 18])
    .bold(false);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const sl = String(item.quantity || 1);
    const name = item.name.slice(0, 18 - 1);
    esc.gridRow([3, 18], [sl, name], ['center', 'left']);
    if (i < items.length - 1) {
       esc.gridMid([3, 18]); // Horizontal line between items
    }
  }
  
  esc.gridBot([3, 18]).size(0, 0);

  if (note && note.trim()) {
    esc.bold(true).size(1, 0)
      .println('Ghi chú:')
      .bold(false)
      .println(note)
      .size(0, 0);
  }

  esc.newLine(3).cut();

  const result = printRaw(KITCHEN_PRINTER, esc.build());
  console.log('[PRINT] Kitchen:', orderId, '->', KITCHEN_PRINTER, result);
  return result;
}

// ──────────────────────────────────────
// In hóa đơn thanh toán
// ──────────────────────────────────────

export async function printReceipt({ orderId, tableName, items, total, paymentMethod, time, staffName }) {
  const now = new Date();
  const timeStr = time || now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmt = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

  const esc = new EscPos();
  esc.init()
    .alignCenter().bold(true).size(1, 1)
    .println('HÀ NỘI XƯA')
    .size(0, 0).bold(false)
    .println('Bún riêu - Bún đậu')
    .println('220 Nguyễn Hoàng, An Phú, Thủ Đức')
    .println('Tel: 0901 681 567')
    .line()
    .alignLeft()
    .println('Đơn: ' + orderId)
    .println('Ngày: ' + dateStr + '  |  ' + timeStr)
    .println('Bàn: ' + (tableName || 'N/A'));

  if (staffName) esc.println('NV: ' + staffName);

  // Bordered table header
  esc.gridTop([4, 22, 18]);
  esc.bold(true);
  esc.gridRow([4, 22, 18], ['SL', 'Tên món', 'Thành tiền'], ['center', 'left', 'right']);
  esc.bold(false);
  esc.gridMid([4, 22, 18]);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const sl = String(item.quantity || 1);
    const name = item.name.slice(0, 22 - 1);
    const price = fmt((item.price || 0) * (item.quantity || 1));
    esc.gridRow([4, 22, 18], [sl, name, price], ['center', 'left', 'right']);
  }

  esc.gridBot([4, 22, 18]);

  // Total
  esc.newLine()
    .bold(true).size(0, 1)
    .tableRow([
      { text: 'TỔNG CỘNG:', width: 0.5, align: 'left' },
      { text: fmt(total), width: 0.5, align: 'right' },
    ])
    .size(0, 0).bold(false)
    .println('TT: ' + (paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'))
    .line()
    .alignCenter()
    .println('Cảm ơn quý khách!')
    .println('Hẹn gặp lại :)')
    .newLine(3).cut();

  const result = printRaw(RECEIPT_PRINTER, esc.build());
  console.log('[PRINT] Receipt:', orderId, '->', RECEIPT_PRINTER, result);
  return result;
}

// ──────────────────────────────────────
// Test printer
// ──────────────────────────────────────

export async function testPrinter() {
  const esc = new EscPos();
  esc.init()
    .alignCenter().bold(true).size(1, 1)
    .println('=== TÌM MÃ TIẾNG VIỆT ===')
    .size(0, 0).bold(false)
    .println('Thời gian: ' + new Date().toLocaleString('vi-VN'))
    .line()
    .alignLeft();

  // Test various code pages that might contain Vietnamese
  const testPages = [16, 27, 30, 31, 40, 42, 48, 49, 77];
  
  for (const cp of testPages) {
    esc.raw(0x1B, 0x74, cp); // ESC t <cp>
    // In chữ "Bún riêu - Bún đậu" được encode qua win1258 
    const buf = iconv.encode(`[Mã ${cp}] Bún riêu - đậu\n`, 'win1258');
    for (const b of buf) esc.data.push(b);
  }

  esc.newLine(2)
     .raw(0x1B, 0x74, 27) // Reset
     .println('May in OK!')
     .newLine(3).cut();

  // Print to both to test
  printRaw(RECEIPT_PRINTER, esc.build());
  const kitchen = printRaw(KITCHEN_PRINTER, esc.build());
  return { kitchen, kitchenPrinter: KITCHEN_PRINTER, receiptPrinter: RECEIPT_PRINTER };
}

// ──────────────────────────────────────
// In bien ban ban giao ca
// ──────────────────────────────────────

const DENOM_ORDER = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

export async function printShiftReport(shift) {
  const fmt = n => new Intl.NumberFormat('vi-VN').format(n || 0);
  const fmtD = n => fmt(n) + 'd';

  const openedAt = new Date(shift.opened_at || shift.openedAt);
  const closedAt = shift.closed_at || shift.closedAt ? new Date(shift.closed_at || shift.closedAt) : new Date();
  const dateStr = openedAt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const openTime = openedAt.toLocaleDateString('vi-VN') + ' ' + openedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const closeTime = closedAt.toLocaleDateString('vi-VN') + ' ' + closedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const staffName = shift.staff_name || shift.staffName || 'Quầy Thu Ngân';
  const shiftName = shift.name || 'Ca';

  // Parse denomination
  let denom = {};
  try { denom = typeof shift.denomination === 'string' ? JSON.parse(shift.denomination) : (shift.denomination || {}); } catch { denom = {}; }

  const esc = new EscPos();
  esc.init()
    // Title
    .alignCenter()
    .bold(true).size(1, 1)
    .println('BIÊN BẢN')
    .println('BÀN GIAO CA')
    .size(0, 0).bold(false)
    .newLine()
    .println(shiftName + ' ngày ' + dateStr)
    .newLine()

    // Shift info
    .alignLeft()
    .println('Giờ mở ca:    ' + openTime)
    .println('Giờ đóng ca:  ' + closeTime)
    .println('Người bàn giao: ' + staffName)
    .newLine()

    // Section
    .alignCenter().bold(true)
    .println('NỘI DUNG BÀN GIAO')
    .bold(false).alignLeft()
    .line('=')
    .newLine()

    // Revenue
    .tableRow([
      { text: 'Tổng doanh thu', width: 0.55, align: 'left' },
      { text: fmtD(shift.total_revenue || shift.totalRevenue), width: 0.45, align: 'right' },
    ])
    .newLine()

    // Cash
    .bold(true).println('Tiền mặt (VNĐ)').bold(false)
    .tableRow([
      { text: '  Đầu ca', width: 0.55, align: 'left' },
      { text: fmtD(shift.starting_cash || shift.startingCash), width: 0.45, align: 'right' },
    ])
    .tableRow([
      { text: '  Thu trong ca', width: 0.55, align: 'left' },
      { text: fmtD(shift.cash_income || shift.cashIncome), width: 0.45, align: 'right' },
    ])
    .tableRow([
      { text: '  Chi trong ca', width: 0.55, align: 'left' },
      { text: fmtD(shift.cash_expense || shift.cashExpense), width: 0.45, align: 'right' },
    ])
    .tableRow([
      { text: '  Cuối ca', width: 0.55, align: 'left' },
      { text: fmtD(shift.expected_cash || shift.expectedCash), width: 0.45, align: 'right' },
    ])
    .tableRow([
      { text: '  Thực tế trong két', width: 0.55, align: 'left' },
      { text: fmtD(shift.actual_cash || shift.actualCash), width: 0.45, align: 'right' },
    ])
    .bold(true)
    .tableRow([
      { text: '  Chênh lệch', width: 0.55, align: 'left' },
      { text: fmtD(shift.difference), width: 0.45, align: 'right' },
    ])
    .tableRow([
      { text: '  Bàn giao lại', width: 0.55, align: 'left' },
      { text: fmtD(shift.handover_cash || shift.handoverCash), width: 0.45, align: 'right' },
    ])
    .bold(false)
    .newLine()

    // Transfer
    .tableRow([
      { text: 'Chuyển khoản', width: 0.55, align: 'left' },
      { text: fmtD(shift.transfer_income || shift.transferIncome), width: 0.45, align: 'right' },
    ])
    .newLine()

    // Other
    .bold(true).println('Nội dung khác').bold(false)
    .tableRow([
      { text: '  SL hóa đơn', width: 0.55, align: 'left' },
      { text: String(shift.total_orders || shift.totalOrders || 0), width: 0.45, align: 'right' },
    ])
    .tableRow([
      { text: '  SL chưa thanh toán', width: 0.55, align: 'left' },
      { text: String(shift.unpaid_orders || shift.unpaidOrders || 0), width: 0.45, align: 'right' },
    ])
    .newLine()

    // Denomination detail
    .bold(true).println('Chi tiết kiểm đếm').bold(false)
    .line();

  // Table header
  esc.tableRow([
    { text: 'Mệnh giá', width: 0.4, align: 'left' },
    { text: 'SL', width: 0.2, align: 'center' },
    { text: 'Thành tiền', width: 0.4, align: 'right' },
  ]).line();

  // Denomination rows
  let totalPieces = 0;
  let totalDenom = 0;
  for (const dd of DENOM_ORDER) {
    const qty = Number(denom[dd]) || 0;
    if (qty === 0) continue;
    totalPieces += qty;
    totalDenom += dd * qty;
    esc.tableRow([
      { text: fmt(dd) + 'đ', width: 0.4, align: 'left' },
      { text: String(qty), width: 0.2, align: 'center' },
      { text: fmt(dd * qty) + 'đ', width: 0.4, align: 'right' },
    ]);
  }

  esc.line()
    .bold(true)
    .tableRow([
      { text: 'Tổng kiểm đếm:', width: 0.4, align: 'left' },
      { text: String(totalPieces), width: 0.2, align: 'center' },
      { text: fmt(totalDenom) + 'đ', width: 0.4, align: 'right' },
    ])
    .bold(false)
    .newLine(2)

    // Signatures
    .alignCenter()
    .tableRow([
      { text: 'Người bàn giao', width: 0.5, align: 'center' },
      { text: 'Người nhận', width: 0.5, align: 'center' },
    ])
    .newLine(3)
    .tableRow([
      { text: staffName, width: 0.5, align: 'center' },
      { text: '___________', width: 0.5, align: 'center' },
    ])
    .newLine(2)
    .alignCenter()
    .println('QLNH / Cửa hàng trưởng')
    .newLine(2)
    .println('___________________')
    .newLine(4)
    .cut();

  const result = printRaw(RECEIPT_PRINTER, esc.build());
  console.log('[PRINT] Shift report:', shift.id, '->', RECEIPT_PRINTER, result);
  return result;
}
