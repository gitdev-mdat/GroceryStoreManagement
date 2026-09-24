import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import TraCuuGia from '../../src/pages/TraCuuGia.jsx'
import ProductResolutionDialog from '../../src/components/ProductResolutionDialog.jsx'

const fixtureProducts = [
  {
    id: 'cream-01', product_code: '01SB10',
    product_name: 'Creamer đặc có đường NSPN XANH biển 1284G.', unit: 'Thùng', status: 'ACTIVE',
    purchase_price: 55404, suggested_retail_price: 64000,
  },
  {
    id: 'star-case', product_code: '07SR11',
    product_name: 'SCA có đường STAR 100G', unit: 'Thùng', status: 'ACTIVE',
    purchase_price: 20952, suggested_retail_price: 25000,
  },
  {
    id: 'star-each', product_code: '07SR11',
    product_name: 'SCA có đường STAR 100G', unit: 'Cái', status: 'ACTIVE',
    purchase_price: 10476, suggested_retail_price: 13000,
  },
  {
    id: 'long-name', product_code: '07UR31',
    product_name: 'Sữa chua uống men sống vị truyền thống VINAMILK PROBI chai 130ML', unit: 'Cái', status: 'ACTIVE',
    purchase_price: 8316, suggested_retail_price: 10000,
  },
  {
    id: 'missing-price', product_code: '',
    product_name: 'G7 3IN1 - hộp 21 gói', unit: 'Hộp', status: 'ACTIVE',
    purchase_price: null, suggested_retail_price: null,
  },
  {
    id: 'hidden-history', product_code: 'HIDE01',
    product_name: 'Sản phẩm đã ẩn nhưng còn lịch sử giá', unit: 'Hộp', status: 'INACTIVE',
    purchase_price: 12000, suggested_retail_price: 15000,
  },
]

const params = new URLSearchParams(window.location.search)
const mode = params.get('viewport') === 'mobile' ? 'mobile' : 'desktop'
const view = params.get('view') || 'price-book'
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
  <main
    data-testid="visual-viewport"
    className="overflow-x-hidden bg-slate-100 p-4"
    style={{ width: mode === 'mobile' ? 390 : 1440, minHeight: mode === 'mobile' ? 844 : 900 }}
  >
    {view === 'resolver' ? (
      <ProductResolutionDialog issues={resolutionIssues} onSelect={() => {}} onConfirmNew={() => {}} onClose={() => {}} />
    ) : (
      <TraCuuGia loadPriceBook={async (status = 'ACTIVE') => fixtureProducts.filter(product => product.status === status)} forceMobile={mode === 'mobile'} />
    )}
  </main>
)
