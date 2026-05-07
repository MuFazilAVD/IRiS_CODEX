import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { AppErrorBoundary } from './components/common/AppErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppErrorBoundary scope="app">
        <App />
      </AppErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
)
