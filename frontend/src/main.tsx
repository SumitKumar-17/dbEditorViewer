import React from 'react'
import ReactDOM from 'react-dom/client'
import { ModuleRegistry, ClientSideRowModelModule } from 'ag-grid-community'
import { loader } from '@monaco-editor/react'
import App from './App'
import './index.css'

ModuleRegistry.registerModules([ClientSideRowModelModule])
loader.init()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
