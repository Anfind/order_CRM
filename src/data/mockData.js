// Mock data for OrderFlow restaurant system

export const MENU_CATEGORIES = [
  { id: 'popular', name: 'Hay Dùng', icon: '❤️' },
  { id: 'appetizer', name: 'Khai Vị', icon: '🥗' },
  { id: 'main', name: 'Món Chính', icon: '🍖' },
  { id: 'noodle', name: 'Mì & Phở', icon: '🍜' },
  { id: 'seafood', name: 'Hải Sản', icon: '🦐' },
  { id: 'drink', name: 'Đồ Uống', icon: '🥤' },
  { id: 'dessert', name: 'Tráng Miệng', icon: '🍰' },
];

export const MENU_ITEMS = [
  // Khai Vị
  { id: 1,  name: 'Gỏi cuốn tôm thịt',     price: 55000,  category: 'appetizer', image: '🌯', popular: true },
  { id: 2,  name: 'Chả giò rế',              price: 65000,  category: 'appetizer', image: '🥟' },
  { id: 3,  name: 'Salad trộn dầu giấm',     price: 45000,  category: 'appetizer', image: '🥗' },
  { id: 4,  name: 'Súp bào ngư',             price: 85000,  category: 'appetizer', image: '🍲', popular: true },

  // Món chính
  { id: 5,  name: 'Cơm chiên dương châu',    price: 75000,  category: 'main', image: '🍚', popular: true },
  { id: 6,  name: 'Sườn nướng mật ong',      price: 120000, category: 'main', image: '🍖', popular: true },
  { id: 7,  name: 'Gà rang muối',            price: 95000,  category: 'main', image: '🍗' },
  { id: 8,  name: 'Bò lúc lắc khoai tây',   price: 145000, category: 'main', image: '🥩', popular: true },
  { id: 9,  name: 'Cơm tấm sườn bì chả',    price: 65000,  category: 'main', image: '🍱' },
  { id: 10, name: 'Thịt kho tàu',            price: 85000,  category: 'main', image: '🥘' },

  // Mì & Phở
  { id: 11, name: 'Phở bò tái chín',         price: 65000,  category: 'noodle', image: '🍜', popular: true },
  { id: 12, name: 'Bún bò Huế',              price: 70000,  category: 'noodle', image: '🍜' },
  { id: 13, name: 'Mì xào hải sản',          price: 85000,  category: 'noodle', image: '🍝' },
  { id: 14, name: 'Hủ tiếu Nam Vang',        price: 60000,  category: 'noodle', image: '🥣' },

  // Hải sản
  { id: 15, name: 'Tôm rang muối',           price: 165000, category: 'seafood', image: '🍤', popular: true },
  { id: 16, name: 'Cua sốt tiêu đen',       price: 250000, category: 'seafood', image: '🦀' },
  { id: 17, name: 'Mực chiên giòn',          price: 130000, category: 'seafood', image: '🦑' },
  { id: 18, name: 'Cá lóc nướng trui',       price: 180000, category: 'seafood', image: '🐟' },

  // Đồ uống
  { id: 19, name: 'Trà đá',                  price: 5000,   category: 'drink', image: '🧊' },
  { id: 20, name: 'Cà phê sữa đá',          price: 25000,  category: 'drink', image: '☕', popular: true },
  { id: 21, name: 'Nước ép cam',             price: 35000,  category: 'drink', image: '🍊' },
  { id: 22, name: 'Sinh tố bơ',              price: 40000,  category: 'drink', image: '🥑' },
  { id: 23, name: 'Bia Sài Gòn',             price: 20000,  category: 'drink', image: '🍺' },
  { id: 24, name: 'Coca Cola',               price: 15000,  category: 'drink', image: '🥤' },

  // Tráng miệng
  { id: 25, name: 'Chè ba màu',              price: 30000,  category: 'dessert', image: '🍨' },
  { id: 26, name: 'Bánh flan',               price: 25000,  category: 'dessert', image: '🍮', popular: true },
  { id: 27, name: 'Trái cây dĩa',            price: 45000,  category: 'dessert', image: '🍉' },
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
  { id: 'dine_in',     label: 'Tại bàn',      icon: '🪑' },
  { id: 'takeaway',    label: 'Mang về',       icon: '🥡' },
  { id: 'delivery',    label: 'Giao hàng',     icon: '🛵' },
  { id: 'reservation', label: 'Đặt trước',     icon: '📅' },
];

// Table areas
export const TABLE_AREAS = [
  { id: 'A', name: 'Tầng 1' },
  { id: 'B', name: 'Tầng 2' },
  { id: 'C', name: 'Sân vườn' },
];

export const INITIAL_TABLES = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Bàn ${i + 1}`,
  seats: i < 4 ? 2 : i < 8 ? 4 : 6,
  area: i < 4 ? 'A' : i < 8 ? 'B' : 'C',
  status: 'empty', // empty | ordering | waiting | served
  orderId: null,
  guestCount: 0,
}));

export const TABLE_STATUS_CONFIG = {
  empty:    { label: 'Trống',     color: 'empty',    icon: '○' },
  ordering: { label: 'Đang gọi', color: 'ordering', icon: '📝' },
  waiting:  { label: 'Chờ món',  color: 'waiting',  icon: '⏳' },
  served:   { label: 'Đã ra',    color: 'served',   icon: '✅' },
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
