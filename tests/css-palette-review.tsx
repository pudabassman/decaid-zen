import { createRoot } from 'react-dom/client'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/jost'
import '../src/styles/tokens.css'
import '../src/styles/app.css'
import '../src/styles/polish.css'
import '../src/styles/palette-tokens.css'
import { LastShotGraph } from '../src/components/LastShotGraph'
import { useCssPalette } from '../src/lib/cssPalette'
import { mockShot } from '../src/lib/mock'

const shot = mockShot()
function Review() {
  const colors = useCssPalette()
  return <main style={{ padding: 30 }}>
    <h1>CSS colour variables</h1>
    <p>The text and canvas below read the same --temp variable. No palette-store edit is involved.</p>
    <button className="btn" onClick={() => document.documentElement.style.setProperty('--temp', 'hsl(180 100% 50%)')}>Set temperature to cyan</button>
    <button className="btn" onClick={() => document.documentElement.style.removeProperty('--temp')}>Restore CSS default</button>
    <p style={{ color: 'var(--temp)' }}>Resolved temperature: <output>{colors.temp}</output></p>
    <div style={{ height: 400 }}><LastShotGraph shot={shot} expanded /></div>
  </main>
}
createRoot(document.getElementById('root')!).render(<Review />)
