import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/jost'
import './styles/tokens.css'
import './styles/app.css'
import './styles/polish.css'
import './styles/palette-tokens.css'
import './styles/palette-editor.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { App } from './App'
import { installMockServer } from './lib/mockServer'

installMockServer()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)
