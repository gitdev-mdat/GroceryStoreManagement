const PRICE_BOOK_KEY = 'hk-product-price-book-v1'

function loadPriceBook() {
  try {
    const raw = localStorage.getItem(PRICE_BOOK_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.map((item) => ({
      product_id: String(item.product_id || slugify(item.product_name) || `product-${Math.random().toString(36).slice(2, 9)}`),
      product_name: String(item.product_name || '').trim(),
      don_vi_tinh: String(item.don_vi_tinh || '').trim(),
      latest_price: Number(item.latest_price) || 0,
      average_price: Number(item.average_price) || 0,
      price_history: Array.isArray(item.price_history) ? item.price_history.slice(-20) : [],
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    }))
  } catch {
    return []
  }
}

function savePriceBook(list) {
  try {
    localStorage.setItem(PRICE_BOOK_KEY, JSON.stringify(list))
  } catch {
    // no-op: quota or private mode
  }
}

export function updatePriceBookItem(updatedItem) {
  const list = loadPriceBook()
  const idx = list.findIndex((item) => item.product_id === updatedItem.product_id)
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      ...updatedItem,
      updatedAt: new Date().toISOString(),
    }
  } else {
    list.push({
      ...updatedItem,
      updatedAt: new Date().toISOString(),
    })
  }
  savePriceBook(list)
}

export function deletePriceBookItem(productId) {
  const list = loadPriceBook().filter((item) => item.product_id !== productId)
  savePriceBook(list)
}

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function saveToProductPriceBook(danhSachHangHoa = [], ngayXuatInvoice, formatDateDisplay) {
  const items = (danhSachHangHoa || [])
    .filter((item) => item && item.ten_hang && item.don_gia_sau_vat != null && Number(item.don_gia_sau_vat) > 0)
    .map((item) => ({
      ten_hang: String(item.ten_hang).trim(),
      don_vi_tinh: String(item.don_vi_tinh || '').trim(),
      don_gia_sau_vat: Number(item.don_gia_sau_vat) || 0,
      so_luong: Number(item.so_luong) || 0,
    }))

  if (!items.length) return

  const existing = loadPriceBook()
  const byId = new Map()
  for (const row of existing) byId.set(row.product_id, row)

  const invoiceDate = typeof formatDateDisplay === 'function' ? formatDateDisplay(ngayXuatInvoice) : new Date().toLocaleDateString('vi-VN')

  for (const row of items) {
    const productId = slugify(row.ten_hang) || `product-${Math.random().toString(36).slice(2, 9)}`
    const current = byId.get(productId) || {
      product_id: productId,
      product_name: row.ten_hang,
      don_vi_tinh: row.don_vi_tinh,
      latest_price: 0,
      average_price: 0,
      price_history: [],
      updatedAt: new Date().toISOString(),
    }

    const priceHistory = Array.isArray(current.price_history) ? current.price_history : []
    const lastEntry = priceHistory[priceHistory.length - 1]
    const prevPrice = Number(lastEntry?.price) || current.latest_price || 0
    const currentPrice = row.don_gia_sau_vat
    const quantity = row.so_luong || 0

    const totalQuantity = priceHistory.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0) + quantity
    const totalValue = priceHistory.reduce((sum, entry) => sum + (Number(entry.price) || 0) * (Number(entry.quantity) || 0), 0) + currentPrice * quantity
    const averagePrice = totalQuantity > 0 ? totalValue / totalQuantity : currentPrice

    const trend = calculatePriceTrend(prevPrice, currentPrice)

    if (!lastEntry || Number(lastEntry.price) !== currentPrice || lastEntry.date !== invoiceDate) {
      priceHistory.push({
        date: invoiceDate,
        price: currentPrice,
        quantity,
      })
    }

    byId.set(productId, {
      ...current,
      product_id: productId,
      product_name: row.ten_hang,
      don_vi_tinh: row.don_vi_tinh,
      latest_price: currentPrice,
      average_price: Number(averagePrice.toFixed(0)),
      price_history: priceHistory.slice(-20),
      price_trend: trend,
      updatedAt: new Date().toISOString(),
    })
  }

  savePriceBook(Array.from(byId.values()))
}

function calculatePriceTrend(oldPrice, newPrice) {
  if (!oldPrice || !newPrice) {
    return { status: 'stable', percent: 0 }
  }
  if (oldPrice === newPrice) {
    return { status: 'stable', percent: 0 }
  }
  const diff = newPrice - oldPrice
  const percent = Number(((diff / oldPrice) * 100).toFixed(1))
  return {
    status: diff > 0 ? 'up' : 'down',
    percent: Math.abs(percent),
  }
}

export function loadPriceBookForUi() {
  return loadPriceBook()
}

export { loadPriceBook, savePriceBook }
