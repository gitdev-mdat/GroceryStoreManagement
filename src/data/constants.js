// Danh mục tồn kho đầu năm (theo biên bản kiểm kê)
export const DEFAULT_INVENTORY_CATEGORIES = [
  {
    id: "hmpt",
    name: "Nhóm Hóa mỹ phẩm & Tẩy rửa",
    unit: "Cái/Chai",
    quantity: 600, // Hạ số lượng xuống
    unitPrice: 100000, // Điều chỉnh đơn giá bình quân
    // TĂNG CHI TIẾT Ở ĐÂY: Liệt kê các Brand lớn từ 6 tấm ảnh vào
    note: "Omo Matic, Aba, Hazeline, Lifebuoy, Sunsilk...",
    vatRate: 0,
  },
  {
    id: "ddgd",
    name: "Nhóm Đồ dùng gia đình & Tiện ích",
    unit: "Cái/Bộ",
    quantity: 400,
    unitPrice: 65000,
    // TĂNG CHI TIẾT: Thêm các món từ ảnh 3 (đồ thờ, bao bì)
    note: "Đồ nhựa, nhang hộp, nến ly, túi nilon, giấy tiền...",
    vatRate: 0,
  },
  {
    id: "tpdg",
    name: "Nhóm Thực phẩm đóng gói & Đồ uống",
    unit: "Thùng/Gói",
    quantity: 700,
    unitPrice: 100000,
    // TĂNG CHI TIẾT: Thêm Gạo (ảnh 6), Bánh hộp (ảnh 4), Sữa (ảnh 2)
    note: "Gạo Thơm Lài, bánh hộp Oreo/Custas, mì tôm, bia...",
    vatRate: 0,
  },
  {
    id: "tpts",
    name: "Nhóm hàng hóa tươi sống",
    unit: "Kg/Cân",
    quantity: 0,
    unitPrice: 0,
    note: "Rau, thịt, cá, trứng...",
    vatRate: 0,
  },
];

// Thuế suất VAT có thể chọn theo nhóm (0%, 5%, 8%, 10%)
export const VAT_RATE_OPTIONS = [0, 5, 8, 10];

// Nhóm S2A = đúng các nhóm tồn kho đầu năm (inventory[].id + inventory[].name)
// Chỉ dùng cho phiếu S2A cũ đã lưu với key khác (để báo cáo vẫn đúng)
// Nhóm 4 (Hàng hóa khác) đã gộp vào nhóm 2 (Đồ dùng gia đình & Tiện ích)
export const LEGACY_GROUP_TO_INVENTORY_ID = {
  "do-uong-thuc-pham": "tpdg",
  "hoa-my-pham-gia-dung": "hmpt",
  "do-cung-hang-khac": "ddgd",
  hhk: "ddgd",
};

// Thuế suất S2a-HKD (Thông tư 152/2025/TT-BTC): phân phối hàng hóa 1% GTGT, 0,5% TNCN
export const S2A_GTGT_RATE = 0.01;
export const S2A_TNCN_RATE = 0.005;

const STORAGE_KEY_INVENTORY = "haikieu-inventory";
const STORAGE_KEY_S2A = "haikieu-s2a";
const STORAGE_KEY_VAT_INVOICES = "haikieu-vat-invoices";
const STORAGE_KEY_COMPANIES = "haikieu-companies";
const STORAGE_KEY_S2A_SETTINGS = "haikieu-s2a-settings";
const STORAGE_KEY_S2A_CLOSED = "haikieu-s2a-closed-periods";
const STORAGE_KEY_FRESH_FOOD_PURCHASES = "haikieu-fresh-food-purchases";
const STORAGE_KEY_FRESH_FOOD_DAILY = "haikieu-fresh-food-daily";

// Ảnh hóa đơn lưu base64, giới hạn ~500KB mỗi ảnh để tránh tràn localStorage
export const VAT_IMAGE_MAX_SIZE = 500 * 1024;

function loadJson(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadInventory() {
  const defaultData = DEFAULT_INVENTORY_CATEGORIES.map((c) => ({ ...c }));
  const loaded = loadJson(STORAGE_KEY_INVENTORY, defaultData);
  const withVat = loaded.map((c) => ({ ...c, vatRate: c.vatRate ?? 0 }));
  // Đảm bảo nhóm mới (vd. Thực phẩm tươi sống) có trong danh sách nếu trước đó chưa có
  const defaultIds = DEFAULT_INVENTORY_CATEGORIES.map((c) => c.id);
  defaultIds.forEach((id) => {
    if (!withVat.some((x) => x.id === id)) {
      const def = DEFAULT_INVENTORY_CATEGORIES.find((c) => c.id === id);
      if (def) withVat.push({ ...def, vatRate: def.vatRate ?? 0 });
    }
  });
  // Nhóm 4 (hhk) đã gộp vào nhóm 2 (ddgd) — bỏ dòng hhk khỏi tồn kho
  let result = withVat.filter((c) => c.id !== "hhk");
  // Đảm bảo tên nhóm tươi sống đúng: "Nhóm hàng hóa tươi sống"
  const tptsDef = DEFAULT_INVENTORY_CATEGORIES.find((c) => c.id === "tpts");
  const beforeTpts = result;
  result = result.map((c) =>
    c.id === "tpts" && tptsDef && c.name !== tptsDef.name
      ? { ...c, name: tptsDef.name }
      : c,
  );
  if (
    result.length !== withVat.length ||
    result.some((c, i) => c.name !== (beforeTpts[i] && beforeTpts[i].name))
  )
    saveInventory(result);
  return result;
}

export function saveInventory(data) {
  saveJson(STORAGE_KEY_INVENTORY, data);
}

const DDGD_GROUP_NAME = "Nhóm Đồ dùng gia đình & Tiện ích";
const DDGD_DIEN_GIAI =
  "Bán lẻ Nhóm Đồ dùng gia đình & Tiện ích cho khách hàng cá nhân";

function migrateHhkToDdgd(entry) {
  const isHhk = entry.groupKey === "hhk";
  const dienGiaiCoHangHoaKhac = (entry.dienGiai || "").includes(
    "Hàng hóa khác",
  );
  if (isHhk || dienGiaiCoHangHoaKhac) {
    return {
      ...entry,
      groupKey: "ddgd",
      groupName: DDGD_GROUP_NAME,
      dienGiai: DDGD_DIEN_GIAI,
    };
  }
  return entry;
}

export function loadS2A() {
  const raw = loadJson(STORAGE_KEY_S2A, []);
  const data = Array.isArray(raw) ? raw : [];
  const migrated = data.map(migrateHhkToDdgd);
  const changed = migrated.some(
    (e, i) =>
      e.groupKey !== (data[i] && data[i].groupKey) ||
      e.groupName !== (data[i] && data[i].groupName) ||
      e.dienGiai !== (data[i] && data[i].dienGiai),
  );
  if (changed) saveS2A(migrated);
  return migrated;
}

export function saveS2A(data) {
  saveJson(STORAGE_KEY_S2A, data);
}

export function loadVatInvoices() {
  const raw = loadJson(STORAGE_KEY_VAT_INVOICES, []);
  const data = Array.isArray(raw) ? raw : [];
  const migrated = data.map(migrateHhkToDdgd);
  if (migrated.some((e, i) => e.groupKey !== (data[i] && data[i].groupKey)))
    saveVatInvoices(migrated);
  return migrated;
}

export function saveVatInvoices(data) {
  saveJson(STORAGE_KEY_VAT_INVOICES, data);
}

export function loadCompanies() {
  return loadJson(STORAGE_KEY_COMPANIES, []);
}

export function saveCompanies(data) {
  saveJson(STORAGE_KEY_COMPANIES, data);
}

// Cài đặt in sổ S2a-HKD: tên HKD, địa chỉ, MST
const DEFAULT_S2A_SETTINGS = { businessName: "", address: "", mst: "" };
export function loadS2aSettings() {
  return loadJson(STORAGE_KEY_S2A_SETTINGS, { ...DEFAULT_S2A_SETTINGS });
}
export function saveS2aSettings(data) {
  saveJson(STORAGE_KEY_S2A_SETTINGS, data);
}

// Các kỳ đã chốt sổ (không cho sửa/xóa phiếu): mảng ["yyyy-mm", ...]
export function loadS2aClosedPeriods() {
  const raw = loadJson(STORAGE_KEY_S2A_CLOSED, []);
  return Array.isArray(raw) ? raw : [];
}
export function saveS2aClosedPeriods(data) {
  saveJson(STORAGE_KEY_S2A_CLOSED, data);
}

// Bảng kê mua vào thực phẩm tươi sống (theo tháng): [{ month: 'yyyy-mm', amount: number }, ...]
export function loadFreshFoodPurchases() {
  const raw = loadJson(STORAGE_KEY_FRESH_FOOD_PURCHASES, []);
  return Array.isArray(raw) ? raw : [];
}
export function saveFreshFoodPurchases(data) {
  saveJson(STORAGE_KEY_FRESH_FOOD_PURCHASES, data);
}

// Bảng kê mua vào theo ngày: [{ date: 'yyyy-mm-dd', amount: number }, ...]
export function loadFreshFoodPurchasesDaily() {
  const raw = loadJson(STORAGE_KEY_FRESH_FOOD_DAILY, []);
  return Array.isArray(raw) ? raw : [];
}
export function saveFreshFoodPurchasesDaily(data) {
  saveJson(STORAGE_KEY_FRESH_FOOD_DAILY, data);
}
