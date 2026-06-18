// src/lib/db.js
// =====================================================================
// Lớp CRUD HYBRID: Supabase (primary) + localStorage (fallback)
// =====================================================================
// MỤC ĐÍCH:
//   - Khi có mạng: đọc/ghi qua Supabase, đồng thời cache localStorage
//   - Khi mất mạng: đọc/ghi localStorage, queue write để sync sau
//   - Realtime: 2 tab trên 2 máy tự đồng bộ qua Supabase channel
//
// CÁCH DÙNG (sẽ thay thế dần cho AppContext):
//   import { db } from '@/lib/db';
//   const list = await db.s2a.list();
//   await db.s2a.create({ so_hieu: '01/BL', ... });
//   await db.s2a.update(id, { amount: 1500000 });
//   await db.s2a.remove(id);
// =====================================================================

import { supabase, isSupabaseConfigured } from './supabase';

// ---------- 0. Tiện ích chung ---------------------------------------
const LS_PREFIX = 'haikieu-';
const PENDING_QUEUE_KEY = 'haikieu-pending-writes';

const lsGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const lsSet = (key, value) => {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('[db] localStorage.setItem failed:', e);
  }
};

const isOnline = () => navigator.onLine && isSupabaseConfigured();

// Hàng chờ ghi khi offline — mỗi item: { table, op, payload, ts }
const enqueue = (table, op, payload) => {
  const queue = lsGet(PENDING_QUEUE_KEY, []);
  queue.push({ table, op, payload, ts: Date.now() });
  lsSet(PENDING_QUEUE_KEY, queue);
};

const flushQueue = async () => {
  const queue = lsGet(PENDING_QUEUE_KEY, []);
  if (queue.length === 0) return;
  const remaining = [];
  for (const item of queue) {
    try {
      await applyRemote(item.table, item.op, item.payload);
    } catch (e) {
      console.warn('[db] flushQueue failed, giữ lại:', item, e);
      remaining.push(item);
    }
  }
  lsSet(PENDING_QUEUE_KEY, remaining);
  console.log(`[db] flushQueue: ${queue.length - remaining.length}/${queue.length} synced`);
};

const applyRemote = async (table, op, payload) => {
  const t = supabase.from(table);
  switch (op) {
    case 'insert': return t.insert(payload);
    case 'update': return t.update(payload.data).eq('id', payload.id);
    case 'upsert': return t.upsert(payload);
    case 'delete': return t.delete().eq('id', payload);
    default: throw new Error(`Unknown op: ${op}`);
  }
};

// ---------- 1. Mappper row → shape cũ của app ----------------------
// App hiện dùng shape: { id, date, groupKey, amount, … } (camelCase)
// DB dùng: { id, date, group_key, amount, … } (snake_case)
// → mapper 2 chiều để không phải sửa UI.

const toCamel = (row) => {
  if (!row) return row;
  const out = { ...row };
  if ('group_key' in out)  { out.groupKey  = out.group_key;  delete out.group_key; }
  if ('group_name' in out) { out.groupName = out.group_name; delete out.group_name; }
  if ('unit_price' in out) { out.unitPrice = out.unit_price; delete out.unit_price; }
  if ('vat_rate' in out)   { out.vatRate   = out.vat_rate;   delete out.vat_rate; }
  if ('so_hieu' in out)    { out.soHieu    = out.so_hieu;    delete out.so_hieu; }
  if ('dien_giai' in out)  { out.dienGiai  = out.dien_giai;  delete out.dien_giai; }
  if ('company_name' in out) { out.companyName = out.company_name; delete out.company_name; }
  if ('company_mst' in out)  { out.companyMst  = out.company_mst;  delete out.company_mst; }
  if ('invoice_symbol' in out) { out.invoiceSymbol = out.invoice_symbol; delete out.invoice_symbol; }
  if ('invoice_number' in out) { out.invoiceNumber = out.invoice_number; delete out.invoice_number; }
  if ('image_url' in out)   { out.imageBase64 = out.image_url; delete out.image_url; }
  if ('created_at' in out)  delete out.created_at;
  if ('updated_at' in out)  delete out.updated_at;
  if ('version' in out)     delete out.version;
  return out;
};

const toSnake = (obj) => {
  const out = { ...obj };
  if ('groupKey' in out)  out.group_key = out.groupKey;
  if ('groupName' in out) out.group_name = out.groupName;
  if ('unitPrice' in out) out.unit_price = out.unitPrice;
  if ('vatRate' in out)   out.vat_rate = out.vatRate;
  if ('soHieu' in out)    out.so_hieu = out.soHieu;
  if ('dienGiai' in out)  out.dien_giai = out.dienGiai;
  if ('companyName' in out) out.company_name = out.companyName;
  if ('companyMst' in out)  out.company_mst = out.companyMst;
  if ('invoiceSymbol' in out) out.invoice_symbol = out.invoiceSymbol;
  if ('invoiceNumber' in out) out.invoice_number = out.invoiceNumber;
  if ('imageBase64' in out) out.image_url = out.imageBase64;
  delete out.groupKey; delete out.groupName; delete out.unitPrice; delete out.vatRate;
  delete out.soHieu; delete out.dienGiai; delete out.companyName; delete out.companyMst;
  delete out.invoiceSymbol; delete out.invoiceNumber; delete out.imageBase64;
  return out;
};

// ---------- 2. Generic CRUD cho 1 bảng -----------------------------
const makeTable = (tableName, lsKey) => ({
  table: tableName,

  async list() {
    if (isOnline()) {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;
      const mapped = data.map(toCamel);
      lsSet(lsKey, mapped);   // cache lại
      return mapped;
    }
    return lsGet(lsKey, []);
  },

  async create(row) {
    const snake = toSnake(row);
    if (isOnline()) {
      const { data, error } = await supabase.from(tableName).insert(snake).select().single();
      if (error) throw error;
      return toCamel(data);
    }
    // Offline: ghi localStorage + queue
    const local = lsGet(lsKey, []);
    const newRow = { ...row, id: row.id || crypto.randomUUID() };
    local.push(newRow);
    lsSet(lsKey, local);
    enqueue(tableName, 'insert', snake);
    return newRow;
  },

  async update(id, patch) {
    const snake = toSnake(patch);
    if (isOnline()) {
      const { data, error } = await supabase
        .from(tableName).update(snake).eq('id', id).select().single();
      if (error) throw error;
      return toCamel(data);
    }
    const local = lsGet(lsKey, []);
    const idx = local.findIndex((r) => r.id === id);
    if (idx >= 0) { local[idx] = { ...local[idx], ...patch }; lsSet(lsKey, local); }
    enqueue(tableName, 'update', { id, data: snake });
    return local[idx];
  },

  async upsert(row) {
    const snake = toSnake(row);
    if (isOnline()) {
      const { data, error } = await supabase.from(tableName).upsert(snake).select().single();
      if (error) throw error;
      return toCamel(data);
    }
    const local = lsGet(lsKey, []);
    const idx = local.findIndex((r) => r.id === row.id);
    if (idx >= 0) local[idx] = { ...local[idx], ...row };
    else local.push(row);
    lsSet(lsKey, local);
    enqueue(tableName, 'upsert', snake);
    return idx >= 0 ? local[idx] : row;
  },

  async remove(id) {
    if (isOnline()) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
    }
    const local = lsGet(lsKey, []).filter((r) => r.id !== id);
    lsSet(lsKey, local);
    if (!isOnline()) enqueue(tableName, 'delete', id);
  },

  // Subscribe realtime (gọi callback mỗi khi có thay đổi từ máy khác)
  subscribe(onChange) {
    if (!isOnline()) return () => {};
    const channel = supabase
      .channel(`${tableName}-changes`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => onChange(payload))
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
});

// ---------- 3. Các bảng nghiệp vụ -----------------------------------
export const db = {
  inventory:           makeTable('inventory',            'inventory'),
  s2a:                 makeTable('s2a',                  's2a'),
  vatInvoices:         makeTable('vat_invoices',         'vat-invoices'),
  companies:           makeTable('companies',            'companies'),
  s2aSettings:         makeTable('s2a_settings',         's2a-settings'),
  s2aClosedPeriods:    makeTable('s2a_closed_periods',   's2a-closed-periods'),
  freshFoodPurchases:  makeTable('fresh_food_purchases', 'fresh-food-purchases'),
  freshFoodDaily:      makeTable('fresh_food_daily',     'fresh-food-daily'),

  // Helpers
  isOnline,
  isConfigured: isSupabaseConfigured,

  // Khi app khởi động: thử flush queue cũ
  async bootstrap() {
    window.addEventListener('online',  () => flushQueue());
    window.addEventListener('offline', () => console.log('[db] Offline mode'));
    if (isOnline()) await flushQueue();
  },

  // Subscribe TẤT CẢ bảng — gọi 1 lần trong AppContext để UI tự reload
  subscribeAll(callbacks) {
    const unsubs = [
      this.inventory.subscribe(callbacks.onInventory),
      this.s2a.subscribe(callbacks.onS2a),
      this.vatInvoices.subscribe(callbacks.onVatInvoices),
      this.companies.subscribe(callbacks.onCompanies),
      this.s2aClosedPeriods.subscribe(callbacks.onClosedPeriods),
    ];
    return () => unsubs.forEach((u) => u && u());
  },
};

// ---------- 4. Export singleton ------------------------------------
export default db;
