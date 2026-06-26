import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'
// 1. Import hàm đăng ký Service Worker từ plugin Vite PWA
import { registerSW } from 'virtual:pwa-register'


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)

// 2. Kích hoạt tính năng chạy ngầm và tự động cập nhật app
registerSW({ immediate: true })
