/**
 * Print Service — ESC/POS via PowerShell (USB)
 * Su dung printer-core logic inline, gui raw bytes qua winspool.drv
 */
import { spawnSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ──────────────────────────────────────
// ESC/POS Command Builder
// ──────────────────────────────────────

class EscPos {
  constructor() { this.data = []; }

  raw(...bytes) { this.data.push(...bytes); return this; }
  init() { return this.raw(0x1B, 0x40); }

  text(str) {
    for (const ch of str) this.data.push(ch.charCodeAt(0) & 0xFF);
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
// Bo dau tieng Viet (ESC/POS chi ho tro ASCII)
// ──────────────────────────────────────

function removeDiacritics(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D');
}

// ──────────────────────────────────────
// In phieu bep — chu to, bep de doc
// ──────────────────────────────────────

export async function printKitchenTicket({ orderId, tableName, items, note, time, staffName }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = time || now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const d = removeDiacritics;

  const esc = new EscPos();
  esc.init()
    .beep(3, 3)

    // Header
    .alignCenter()
    .bold(true).size(2, 2)
    .println('CHE BIEN')
    .size(0, 0).bold(false)
    .newLine()

    // Order info (size 1x0 = 24 effective cols)
    .alignLeft()
    .size(1, 0)
    .println('Order: ' + orderId)
    .println('Ngay: ' + dateStr + ' (' + timeStr + ')')
    .size(0, 0)
    .newLine()

    // Table name (size 1x1 = big)
    .bold(true).size(1, 1)
    .println('Ban: ' + d(tableName || 'N/A'))
    .size(0, 0).bold(false)
    .size(1, 0)
    .println('Nguoi gui: ' + d(staffName || 'Quay Thu Ngan'))
    .size(0, 0)
    .newLine()
    .line('=')

    // Table header
    .bold(true).size(1, 0)
    .println('SL  Ten mon')
    .size(0, 0).bold(false)
    .line('=');

  // Items (size 1x1 = 24 effective cols)
  for (const item of items) {
    const name = d(item.name);
    const qty = String(item.quantity || 1);
    esc.bold(true).size(1, 1);
    const ln = qty.padStart(2) + ' ' + name.slice(0, 21);
    esc.println(ln);
    esc.size(0, 0).bold(false);
  }

  esc.line('=');

  if (note && note.trim()) {
    esc.bold(true).size(1, 0)
      .println('Ghi chu:')
      .bold(false)
      .println(d(note))
      .size(0, 0);
  }

  esc.newLine(3).cut();

  const result = printRaw(KITCHEN_PRINTER, esc.build());
  console.log('[PRINT] Kitchen:', orderId, '->', KITCHEN_PRINTER, result);
  return result;
}

// ──────────────────────────────────────
// In hoa don thanh toan — bang ke doc |
// ──────────────────────────────────────
// +----+----------------------+----------------+
// | SL | Ten mon              |     Thanh tien |
// +----+----------------------+----------------+
// |  2 | Bun rieu             |       110.000d |
// +----+----------------------+----------------+

export async function printReceipt({ orderId, tableName, items, total, paymentMethod, time, staffName }) {
  const now = new Date();
  const timeStr = time || now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmt = n => new Intl.NumberFormat('vi-VN').format(n) + 'd';
  const d = removeDiacritics;

  // Bordered table: | SL | Ten mon              |     Thanh tien |
  // Widths:           4    22                      18          = 44 + 4 pipes = 48
  const W1 = 4, W2 = 22, W3 = 18;
  const border = '+' + '-'.repeat(W1) + '+' + '-'.repeat(W2) + '+' + '-'.repeat(W3) + '+';
  const brow = (c1, c2, c3) => {
    return '|' + c1.padStart(W1) + '| ' + c2.padEnd(W2 - 1) + '|' + c3.padStart(W3) + '|';
  };

  const esc = new EscPos();
  esc.init()
    .alignCenter().bold(true).size(1, 1)
    .println('HA NOI XUA')
    .size(0, 0).bold(false)
    .println('Bun rieu - Bun dau')
    .println('220 Nguyen Hoang, An Phu, Thu Duc')
    .println('Tel: 0901 681 567')
    .line()
    .alignLeft()
    .println('Don: ' + orderId)
    .println('Ngay: ' + dateStr + '  |  ' + timeStr)
    .println('Ban: ' + d(tableName || 'N/A'));

  if (staffName) esc.println('NV: ' + d(staffName));

  // Bordered table
  esc.println(border);
  esc.bold(true);
  esc.println(brow(' SL', 'Ten mon', 'Thanh tien '));
  esc.bold(false);
  esc.println(border);

  for (const item of items) {
    const sl = String(item.quantity || 1);
    const name = d(item.name).slice(0, W2 - 1);
    const price = fmt((item.price || 0) * (item.quantity || 1));
    esc.println(brow(sl, name, price));
  }

  esc.println(border);

  // Total
  esc.newLine()
    .bold(true).size(0, 1)
    .tableRow([
      { text: 'TONG CONG:', width: 0.5, align: 'left' },
      { text: fmt(total), width: 0.5, align: 'right' },
    ])
    .size(0, 0).bold(false)
    .println('TT: ' + (paymentMethod === 'transfer' ? 'Chuyen khoan' : 'Tien mat'))
    .line()
    .alignCenter()
    .println('Cam on quy khach!')
    .println('Hen gap lai :)')
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
    .println('=== TEST ===')
    .size(0, 0).bold(false)
    .println('Time: ' + new Date().toLocaleString('vi-VN'))
    .println('May in OK!')
    .newLine(3).cut();

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

  const staffName = removeDiacritics(shift.staff_name || shift.staffName || 'Quay Thu Ngan');
  const shiftName = removeDiacritics(shift.name || 'Ca');

  // Parse denomination
  let denom = {};
  try { denom = typeof shift.denomination === 'string' ? JSON.parse(shift.denomination) : (shift.denomination || {}); } catch { denom = {}; }

  const esc = new EscPos();
  esc.init()
    // Title
    .alignCenter()
    .bold(true).size(1, 1)
    .println('BIEN BAN')
    .println('BAN GIAO CA')
    .size(0, 0).bold(false)
    .newLine()
    .println(shiftName + ' ngay ' + dateStr)
    .newLine()

    // Shift info
    .alignLeft()
    .println('Gio mo ca:    ' + openTime)
    .println('Gio dong ca:  ' + closeTime)
    .println('Nguoi ban giao: ' + staffName)
    .newLine()

    // Section
    .alignCenter().bold(true)
    .println('NOI DUNG BAN GIAO')
    .bold(false).alignLeft()
    .line('=')
    .newLine()

    // Revenue
    .tableRow([
      { text: 'Tong doanh thu', width: 0.55, align: 'left' },
      { text: fmtD(shift.total_revenue || shift.totalRevenue), width: 0.45, align: 'right' },
    ])
    .newLine()

    // Cash
    .bold(true).println('Tien mat (VND)').bold(false)
    .tableRow([
      { text: '  Dau ca', width: 0.55, align: 'left' },
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
      { text: '  Cuoi ca', width: 0.55, align: 'left' },
      { text: fmtD(shift.expected_cash || shift.expectedCash), width: 0.45, align: 'right' },
    ])
    .tableRow([
      { text: '  Thuc te trong ket', width: 0.55, align: 'left' },
      { text: fmtD(shift.actual_cash || shift.actualCash), width: 0.45, align: 'right' },
    ])
    .bold(true)
    .tableRow([
      { text: '  Chenh lech', width: 0.55, align: 'left' },
      { text: fmtD(shift.difference), width: 0.45, align: 'right' },
    ])
    .tableRow([
      { text: '  Ban giao lai', width: 0.55, align: 'left' },
      { text: fmtD(shift.handover_cash || shift.handoverCash), width: 0.45, align: 'right' },
    ])
    .bold(false)
    .newLine()

    // Transfer
    .tableRow([
      { text: 'Chuyen khoan', width: 0.55, align: 'left' },
      { text: fmtD(shift.transfer_income || shift.transferIncome), width: 0.45, align: 'right' },
    ])
    .newLine()

    // Other
    .bold(true).println('Noi dung khac').bold(false)
    .tableRow([
      { text: '  SL hoa don', width: 0.55, align: 'left' },
      { text: String(shift.total_orders || shift.totalOrders || 0), width: 0.45, align: 'right' },
    ])
    .tableRow([
      { text: '  SL chua thanh toan', width: 0.55, align: 'left' },
      { text: String(shift.unpaid_orders || shift.unpaidOrders || 0), width: 0.45, align: 'right' },
    ])
    .newLine()

    // Denomination detail
    .bold(true).println('Chi tiet kiem dem').bold(false)
    .line();

  // Table header
  esc.tableRow([
    { text: 'Menh gia', width: 0.4, align: 'left' },
    { text: 'SL', width: 0.2, align: 'center' },
    { text: 'Thanh tien', width: 0.4, align: 'right' },
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
      { text: fmt(dd) + 'd', width: 0.4, align: 'left' },
      { text: String(qty), width: 0.2, align: 'center' },
      { text: fmt(dd * qty) + 'd', width: 0.4, align: 'right' },
    ]);
  }

  esc.line()
    .bold(true)
    .tableRow([
      { text: 'Tong kiem dem:', width: 0.4, align: 'left' },
      { text: String(totalPieces), width: 0.2, align: 'center' },
      { text: fmt(totalDenom) + 'd', width: 0.4, align: 'right' },
    ])
    .bold(false)
    .newLine(2)

    // Signatures
    .alignCenter()
    .tableRow([
      { text: 'Nguoi ban giao', width: 0.5, align: 'center' },
      { text: 'Nguoi nhan', width: 0.5, align: 'center' },
    ])
    .newLine(3)
    .tableRow([
      { text: staffName, width: 0.5, align: 'center' },
      { text: '___________', width: 0.5, align: 'center' },
    ])
    .newLine(2)
    .alignCenter()
    .println('QLNH/Thu truong DV')
    .newLine(2)
    .println('___________________')
    .newLine(4)
    .cut();

  const result = printRaw(RECEIPT_PRINTER, esc.build());
  console.log('[PRINT] Shift report:', shift.id, '->', RECEIPT_PRINTER, result);
  return result;
}
