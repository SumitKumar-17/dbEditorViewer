import React from 'react'
import ReactDOM from 'react-dom/client'
import { ModuleRegistry, ClientSideRowModelModule } from 'ag-grid-community'
import App from './App'
import './index.css'

ModuleRegistry.registerModules([ClientSideRowModelModule])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
