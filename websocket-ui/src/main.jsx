import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.jsx'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Không tìm thấy phần tử #root trong HTML')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
