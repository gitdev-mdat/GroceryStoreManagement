import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import TraCuuGia from '../../src/pages/TraCuuGia.jsx'
import ProductResolutionDialog from '../../src/components/ProductResolutionDialog.jsx'
import NhatKyHoaDon from '../../src/pages/NhatKyHoaDon.jsx'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

const source = (productId, invoiceId, date, price, supplierName, current = false) => ({
  historyId: `${productId}-${invoiceId}`,
  productId,
  invoiceId,
  invoiceNumber: invoiceId.toUpperCase(),
  invoiceDate: date,
  supplierName,
  purchasePrice: price,
  quantity: 10,
  isCurrentPriceSource: current,
  available: true,
})

const fixtureSources = {
  'cream-01': [source('cream-01', '00017114', '2026-08-29', 55404, 'CÔNG TY TNHH MTV QUỐC BẢO ĐẮK NÔNG', true)],
  'star-case': [
    source('star-case', '00017114', '2026-08-29', 20952, 'CÔNG TY TNHH MTV QUỐC BẢO ĐẮK NÔNG', true),
    source('star-case', '00016892', '2026-08-26', 20500, 'CÔNG TY CỔ PHẦN THƯƠNG MẠI VÀ DỊCH VỤ TÂY NGUYÊN'),
    source('star-case', '00015913', '2026-08-02', 19800, 'CÔNG TY ABC'),
  ],
}

const fixtureProducts = [
  {
    id: 'cream-01', product_code: '01SB10',
    product_name: 'Creamer đặc có đường NSPN XANH biển 1284G.', unit: 'Thùng', status: 'ACTIVE',
    purchase_price: 55404, suggested_retail_price: 64000,
    vat_source_count: 1, current_price_source: fixtureSources['cream-01'][0],
  },
  {
    id: 'star-case', product_code: '07SR11',
    product_name: 'SCA có đường STAR 100G', unit: 'Thùng', status: 'ACTIVE',
    purchase_price: 20952, suggested_retail_price: 25000,
    vat_source_count: 3, current_price_source: fixtureSources['star-case'][0],
  },
  {
    id: 'star-each', product_code: '07SR11',
    product_name: 'SCA có đường STAR 100G', unit: 'Cái', status: 'ACTIVE',
    purchase_price: 10476, suggested_retail_price: 13000,
    vat_source_count: 0, current_price_source: null,
  },
  {
    id: 'long-name', product_code: '07UR31',
    product_name: 'Sữa chua uống men sống vị truyền thống VINAMILK PROBI chai 130ML', unit: 'Cái', status: 'ACTIVE',
    purchase_price: 8316, suggested_retail_price: 10000,
    vat_source_count: 0, current_price_source: null,
  },
  {
    id: 'missing-price', product_code: '',
    product_name: 'G7 3IN1 - hộp 21 gói', unit: 'Hộp', status: 'ACTIVE',
    purchase_price: null, suggested_retail_price: null,
    vat_source_count: 0, current_price_source: null,
  },
  {
    id: 'hidden-history', product_code: 'HIDE01',
    product_name: 'Sản phẩm đã ẩn nhưng còn lịch sử giá', unit: 'Hộp', status: 'INACTIVE',
    purchase_price: 12000, suggested_retail_price: 15000,
    vat_source_count: 1, current_price_source: source('hidden-history', 'hidden-invoice', '2026-07-20', 12000, 'NHÀ CUNG CẤP HÀNG ẨN', true),
  },
]

const allSources = Object.values(fixtureSources).flat().concat(fixtureProducts[5].current_price_source)
const fixtureInvoices = [...new Map(allSources.map(item => [item.invoiceId, {
  id: item.invoiceId,
  serial_number: '1C26THK',
  invoice_number: item.invoiceNumber,
  issue_date: item.invoiceDate,
  invoice_type: 'VAT',
  total_amount: item.purchasePrice * 10,
  notes: '',
  image_url: null,
  suppliers: { company_name: item.supplierName, tax_code: '6400123456' },
}])).values()]

const loadInvoices = async ({ linkedInvoiceId }) => linkedInvoiceId ? fixtureInvoices.filter(invoice => invoice.id === linkedInvoiceId) : fixtureInvoices
const loadInvoiceProducts = async invoiceId => {
  return allSources.filter(sourceItem => sourceItem.invoiceId === invoiceId).map(item => {
    const productItem = fixtureProducts.find(productRow => productRow.id === item.productId)
    return { id: item.historyId, product_id: item.productId, unit_price_after_vat: item.purchasePrice, quantity: item.quantity, row_type: 'MUA', products: { product_name: productItem.product_name, unit: productItem.unit } }
  })
}

const params = new URLSearchParams(window.location.search)
const mode = params.get('viewport') === 'mobile' ? 'mobile' : 'desktop'
const view = params.get('view') || 'price-book'
const vatState = params.get('vatState') || 'ready'
document.body.className = 'm-0 bg-slate-100'

const resolutionIssues = [{
  index: 0,
  source: { sourceDescription: 'SCA có đường STAR 100G', candidateName: 'SCA có đường STAR 100G', productCode: '07SR11', unit: '' },
  resolution: {
    candidates: [
      { id: 'star-each', product_code: '07SR11', product_name: 'SCA có đường STAR 100G', unit: 'Cái' },
      { id: 'star-case', product_code: '07SR11', product_name: 'SCA có đường STAR 100G', unit: 'Thùng' },
    ],
  },
}]

createRoot(document.getElementById('root')).render(
  <BrowserRouter><main
    data-testid="visual-viewport"
    className="overflow-x-hidden bg-slate-100 p-4"
    style={{ width: mode === 'mobile' ? 360 : 1440, maxWidth: '100%', minHeight: mode === 'mobile' ? 800 : 900 }}
  >
    {view === 'resolver' ? <ProductResolutionDialog issues={resolutionIssues} onSelect={() => {}} onConfirmNew={() => {}} onClose={() => {}} /> : (
      <Routes>
        <Route path="*" element={<TraCuuGia loadPriceBook={async (status = 'ACTIVE') => fixtureProducts.filter(product => product.status === status)} loadVatSources={async productId => {
          if (vatState === 'loading') return new Promise(() => {})
          if (vatState === 'error') throw new Error('Fixture VAT history failure')
          return fixtureSources[productId] || (productId === 'hidden-history' ? [fixtureProducts[5].current_price_source] : [])
        }} forceMobile={mode === 'mobile'} />} />
        <Route path="/nhat-ky-hoa-don" element={<NhatKyHoaDon loadInvoices={loadInvoices} loadInvoiceProducts={loadInvoiceProducts} />} />
      </Routes>
    )}
  </main></BrowserRouter>
)
