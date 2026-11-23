import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './editor.css'
import App from './App.tsx'

// The entry of the editor. It never imports a screen or the library: the
// screens are shown in iframes from `frame.html`, which the frame server of
// `canvas dev` serves with the React of the project.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
