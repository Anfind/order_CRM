// Data cho hệ thống Order - Hà Nội Xưa
// 220 Nguyễn Hoàng, P. An Phú, TP. Thủ Đức | 0901 681 567

export const RESTAURANT_INFO = {
  name: 'Hà Nội Xưa',
  subtitle: 'Bún riêu · Bún đậu',
  phone: '0901681567',
  address: '220 Nguyễn Hoàng, P. An Phú, TP. Thủ Đức',
  established: 2016,
};

export const MENU_CATEGORIES = [
  { id: 'popular', name: 'Bán Chạy' },
  { id: 'c1',      name: 'Bún Riêu Tóp Mỡ' },
  { id: 'c2',      name: 'Bún Đậu Mắm Tôm' },
  { id: 'c3',      name: 'Món Ngon Hà Nội' },
  { id: 'c4',      name: 'Lẩu Riêu Cua' },
  { id: 'c5',      name: 'Thêm Bún Đậu' },
  { id: 'c6',      name: 'Topping Bún Riêu' },
  { id: 'c7',      name: 'Thức Uống' },
  { id: 'c8',      name: 'Khác' },
];

// Image mapping per category
const IMG = {
  c1: '/food/bun-rieu.png',
  c2: '/food/bun-dau.png',
  c3: '/food/nem-ran.png',
  c4: '/food/lau.png',
  c5: '/food/topping.png',
  c6: '/food/topping.png',
  c7: '/food/drink.png',
  c8: '/food/topping.png',
};

export const MENU_ITEMS = [
  // ── Bún Riêu Tóp Mỡ ──
  { id: 'br1', name: 'Tô Ngon Miệng',  desc: 'Đậu, giò tai, mọc',                   price: 48000,  category: 'c1', image: IMG.c1 },
  { id: 'br2', name: 'Tô Đầy Đủ',      desc: 'Đậu, giò tai, mọc, bò',               price: 59000,  category: 'c1', image: IMG.c1, popular: true },
  { id: 'br3', name: 'Tô Đặc Biệt',    desc: 'Đậu, giò tai, mọc, bò, trứng lộn',    price: 68000,  category: 'c1', image: IMG.c1, popular: true },
  { id: 'br4', name: 'Tô Tự Chọn',     desc: 'Đậu, riêu',                            price: 31000,  category: 'c1', image: IMG.c1 },

  // ── Bún Đậu Mắm Tôm ──
  { id: 'bd1', name: 'Mẹt Thập Cẩm',      price: 63000,  category: 'c2', image: IMG.c2 },
  { id: 'bd2', name: 'Mẹt Tá Lả',         price: 78000,  category: 'c2', image: IMG.c2, popular: true },
  { id: 'bd3', name: 'Mẹt Bún Đậu',       price: 30000,  category: 'c2', image: IMG.c2 },
  { id: 'bd4', name: 'Bún Đậu Chả Cốm',   price: 49000,  category: 'c2', image: IMG.c2 },
  { id: 'bd5', name: 'Mẹt Bún Đậu Thịt',  price: 49000,  category: 'c2', image: IMG.c2 },

  // ── Món Ngon Hà Nội ──
  { id: 'mn1', name: 'Nem chua rán',         price: 69000,  category: 'c3', image: IMG.c3, popular: true },
  { id: 'mn2', name: 'Chả mực Hạ Long',      price: 69000,  category: 'c3', image: '/food/cha-muc.png', popular: true },
  { id: 'mn3', name: 'Thú linh chiên giòn',  price: 69000,  category: 'c3', image: '/food/ga-chien.png' },
  { id: 'mn4', name: 'Chân gà muối chiên',   price: 75000,  category: 'c3', image: '/food/ga-chien.png', popular: true },
  { id: 'mn5', name: 'Bánh dày rán ruốc',    price: 40000,  category: 'c3', image: IMG.c3 },
  { id: 'mn6', name: 'Giò tai rán',          price: 55000,  category: 'c3', image: IMG.c5 },

  // ── Lẩu Riêu Cua Bắp Bò ──
  { id: 'l1', name: 'Lẩu nhỏ (2-3 người)', price: 269000, category: 'c4', image: IMG.c4 },
  { id: 'l2', name: 'Lẩu lớn (4-5 người)', price: 379000, category: 'c4', image: IMG.c4 },

  // ── Món Thêm Bún Đậu ──
  { id: 'tbd1', name: 'Bún Lá',     price: 12000, category: 'c5', image: IMG.c5 },
  { id: 'tbd2', name: 'Đậu Hũ',    price: 20000, category: 'c5', image: IMG.c5 },
  { id: 'tbd3', name: 'Chả Cốm',   price: 28000, category: 'c5', image: IMG.c5 },
  { id: 'tbd4', name: 'Thịt Bắp',  price: 30000, category: 'c5', image: IMG.c5 },
  { id: 'tbd5', name: 'Dồi Tiết',  price: 43000, category: 'c5', image: IMG.c5 },

  // ── Topping Bún Riêu ──
  { id: 'tbr1', name: 'Mọc',            price: 10000, category: 'c6', image: IMG.c6 },
  { id: 'tbr2', name: 'Giò tai',        price: 10000, category: 'c6', image: IMG.c6 },
  { id: 'tbr3', name: 'Trứng vịt lộn',  price: 10000, category: 'c6', image: IMG.c6 },
  { id: 'tbr4', name: 'Bò tái',         price: 17000, category: 'c6', image: IMG.c6 },
  { id: 'tbr5', name: 'Tóp mỡ',        price: 17000, category: 'c6', image: IMG.c6 },
  { id: 'tbr6', name: 'Riêu cua',       price: 10000, category: 'c6', image: IMG.c6 },
  { id: 'tbr7', name: 'Đậu mơ',        price: 10000, category: 'c6', image: IMG.c6 },

  // ── Drink ──
  { id: 'd1',  name: 'Sấu đá',                price: 25000, category: 'c7', image: IMG.c7 },
  { id: 'd2',  name: 'Mơ đá',                 price: 25000, category: 'c7', image: IMG.c7 },
  { id: 'd3',  name: 'Trà tắc',               price: 18000, category: 'c7', image: IMG.c7 },
  { id: 'd4',  name: 'Sữa chua nếp cẩm',     price: 25000, category: 'c7', image: IMG.c7 },
  { id: 'd5',  name: 'Sữa chua dẻo ca cao',   price: 25000, category: 'c7', image: IMG.c7 },
  { id: 'd6',  name: 'Bia Hà Nội',            price: 26000, category: 'c7', image: IMG.c7 },
  { id: 'd7',  name: 'Bia Tiger',             price: 26000, category: 'c7', image: IMG.c7 },
  { id: 'd8',  name: 'Trà Ô Long',            price: 18000, category: 'c7', image: IMG.c7 },
  { id: 'd9',  name: 'Pepsi / Sting / 7up',   price: 20000, category: 'c7', image: IMG.c7 },
  { id: 'd10', name: 'Nước suối',             price: 12000, category: 'c7', image: IMG.c7 },
  { id: 'd11', name: 'Trà đá',                price: 3000,  category: 'c7', image: IMG.c7 },

  // ── Khác ──
  { id: 'k1', name: 'Khăn ướt', price: 2000, category: 'c8', image: IMG.c8 },
];

// Payment methods
export const PAYMENT_METHODS = [
  { id: 'cash',     label: 'Tiền mặt',     icon: 'cash' },
  { id: 'transfer', label: 'Chuyển khoản', icon: 'transfer' },
];

// Staff / NV Phục vụ
export const STAFF_LIST = [
  { id: 1, name: 'Minh', role: 'Phục vụ' },
  { id: 2, name: 'Hương', role: 'Phục vụ' },
  { id: 3, name: 'Tuấn', role: 'Phục vụ' },
  { id: 4, name: 'Linh', role: 'Phục vụ' },
  { id: 5, name: 'Đức', role: 'Thu ngân' },
];

// Order type tabs
export const ORDER_TYPES = [
  { id: 'dine_in',     label: 'Tại bàn' },
  { id: 'takeaway',    label: 'Mang về' },
  { id: 'delivery',    label: 'Giao hàng' },
  { id: 'reservation', label: 'Đặt trước' },
];

// Table areas
export const TABLE_AREAS = [
  { id: 'A', name: 'Khu A' },
  { id: 'B', name: 'Khu B' },
  { id: 'S', name: 'Khu S' },
  { id: 'MV', name: 'Mang về' },
];

export const INITIAL_TABLES = []; // Handled by backend

export const TABLE_STATUS_CONFIG = {
  empty:    { label: 'Trống',     color: 'empty',    icon: '○' },
  ordering: { label: 'Đang gọi', color: 'ordering', icon: '●' },
  waiting:  { label: 'Chờ món',  color: 'waiting',  icon: '●' },
  served:   { label: 'Đã ra',    color: 'served',   icon: '●' },
};

export function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateOrderId() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const r = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `ORD-${h}${m}-${r}`;
}
