import 'pixi.js/unsafe-eval'
import '../index.css'
import { createRoot } from 'react-dom/client'
import { WidgetApp } from './WidgetApp'

const root = document.getElementById('gamedin-widget-root')
if (root) {
  createRoot(root).render(<WidgetApp />)
}
