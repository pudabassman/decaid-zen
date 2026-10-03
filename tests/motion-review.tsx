import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button } from '../src/components/Button'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/jost'
import '../src/styles/tokens.css'
import '../src/styles/palette-tokens.css'
import '../src/styles/app.css'
import '../src/styles/polish.css'
import './motion-review.css'

function Review() {
  const [width, setWidth] = useState(156)
  const [trace, setTrace] = useState(true)
  const [holds, setHolds] = useState(0)
  return <main className="review">
    <h1>Button border alignment</h1>
    <p>The actual Button component, with its trace paused at 75%.</p>
    <label>Rendered width <select value={width} onChange={event => setWidth(Number(event.target.value))}>
      <option value={156}>156 px · standard</option><option value={128}>128 px · compact</option><option value={240}>240 px · stretched</option>
    </select></label>
    <label><input type="checkbox" checked={trace} onChange={event => setTrace(event.target.checked)} /> Show trace</label>
    <div className={`sample ${trace ? 'trace-visible' : ''}`} style={{ '--review-width': `${width}px` } as React.CSSProperties}>
      <Button width={196} height={52} quiet holdMs={1000} onHold={() => setHolds(value => value + 1)}>Sleep</Button>
    </div>
    <p aria-live="polite">Completed holds: {holds}. This fixture has no machine connection.</p>
  </main>
}
createRoot(document.getElementById('root')!).render(<Review />)
