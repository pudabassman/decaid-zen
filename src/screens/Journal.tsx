import { useEffect, useRef, useState } from 'react'
import { client } from '../api/client'
import { Button } from '../components/Button'
import { Overlay } from '../components/Overlay'
import { LastShotGraph } from '../components/LastShotGraph'
import type { ShotRecord, ShotSummary } from '../api/types'
import { useSwipe } from '../lib/useSwipe'
import { useDemoMode } from '../lib/demoMode'
import { useAction } from '../lib/useAction'

const ratio = (shot: ShotSummary) => {
  const dose = shot.annotations?.actualDoseWeight ?? shot.workflow?.context?.targetDoseWeight
  const poured = shot.annotations?.actualYield ?? shot.workflow?.context?.targetYield
  return dose && poured ? `1:${(poured / dose).toFixed(2)}` : '—'
}
const day = (timestamp: string) => {
  const date = new Date(timestamp), today = new Date(), yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  return date.toDateString() === today.toDateString() ? 'Today' : date.toDateString() === yesterday.toDateString() ? 'Yesterday' : date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}
export function Journal({ onBack, onReplay }: { onBack: () => void; onReplay: (shot: ShotRecord) => void }) {
  const demo = useDemoMode()
  const [items, setItems] = useState<ShotSummary[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<ShotRecord | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const request = useRef(0)
  const mounted = useRef(true)
  const screen = useRef<HTMLDivElement>(null)
  const { run, message, busy, status } = useAction()
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++ } }, [])
  const persistNotes = async () => {
    const shot = selectedRef.current
    if (!shot) return
    const note = draftsRef.current[shot.id]
    if (note === undefined || note === (shot.annotations?.espressoNotes ?? '')) return
    await client.annotateShot(shot.id, { espressoNotes: note })
    if (!mounted.current) return
    setSelected(current => current?.id === shot.id ? { ...current, annotations: { ...current.annotations, espressoNotes: note } } : current)
    setItems(prev => prev.map(item => item.id === shot.id ? { ...item, annotations: { ...item.annotations, espressoNotes: note } } : item))
    setDrafts(prev => { if (prev[shot.id] !== note) return prev; const next = { ...prev }; delete next[shot.id]; return next })
  }
  const open = async (id: string) => {
    const sequence = ++request.current
    setOpening(true); setError('')
    try {
      await persistNotes()
      const shot = await client.shot(id)
      if (!mounted.current || sequence !== request.current) return
      setSelected(shot); setDetail(true)
    } catch { if (mounted.current && sequence === request.current) setError('Couldn’t open this shot. Any unsaved note is still here; try again.') }
    finally { if (mounted.current && sequence === request.current) setOpening(false) }
  }
  const load = async (offset = 0) => {
    setLoading(true); setError('')
    try {
      const page = await client.shots(20, offset)
      if (!mounted.current) return
      setItems(prev => offset ? [...prev, ...page.items.filter(item => !prev.some(p => p.id === item.id))] : page.items)
      setTotal(page.total)
      if (!offset && page.items[0]) { await open(page.items[0].id); setDetail(false) }
    } catch { if (mounted.current) setError('Couldn’t load your journal. Check the connection and retry.') }
    finally { if (mounted.current) setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const saveAndLeave = () => { void run('Save note', async () => { await persistNotes(); onBack() }) }
  const leave = () => {
    const shot = selectedRef.current
    const draft = shot ? draftsRef.current[shot.id] : undefined
    if (shot && draft !== undefined && draft !== (shot.annotations?.espressoNotes ?? '')) setLeaving(true)
    else onBack()
  }
  useSwipe(screen, { onRight: edge => { if (edge && !busy && !opening) leave() } })
  const shown = items.filter(shot => `${shot.workflow?.context?.coffeeName ?? ''} ${shot.workflow?.context?.coffeeRoaster ?? ''} ${shot.workflow?.profile?.title ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const notes = selected ? drafts[selected.id] ?? selected.annotations?.espressoNotes ?? '' : ''
  const dirty = selected && notes !== (selected.annotations?.espressoNotes ?? '')
  return <div className={`screen journal-screen ${detail ? 'show-detail' : ''}`} ref={screen}>
    <header className="page-header"><div><span className="eyebrow">A record of your ritual</span><h1>Journal</h1></div><span className="hint">{total} shots</span></header>
    {error && <div className="notice" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
    <div className="journal-layout grow">
      <section className="journal-list-pane" aria-label="Shot history">
        <input className="search" aria-label="Filter loaded shots by coffee or profile" placeholder="Filter by coffee or profile" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="journal-list">{shown.map((shot, i) => <div key={shot.id}>
          {(!i || day(shown[i - 1].timestamp) !== day(shot.timestamp)) && <h2 className="journal-day">{day(shot.timestamp)}</h2>}
          <button className={`journal-shot ${selected?.id === shot.id ? 'selected' : ''}`} aria-pressed={selected?.id === shot.id} disabled={opening || busy}
            onClick={() => void open(shot.id)}>
            <span className="journal-time">{new Date(shot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="journal-coffee"><span className="display">{shot.workflow?.context?.coffeeName || 'Untitled coffee'}</span><span className="hint">{shot.workflow?.profile?.title ?? 'No profile'}</span></span>
            <span className="num journal-ratio">{ratio(shot)}</span>
          </button>
        </div>)}
        {!shown.length && <p className="empty-state">{loading ? 'Loading your shots…' : query ? 'No loaded shots match. Try another coffee or load older shots.' : 'Your first shot will appear here.'}</p>}
        {items.length < total && <Button disabled={loading} onClick={() => load(items.length)}>{loading ? 'Loading…' : 'Load older shots'}</Button>}
        {query && <p className="hint">Filtering {items.length} loaded shots of {total}.</p>}
        </div>
      </section>
      <aside className="journal-detail" aria-label="Selected shot" aria-busy={opening}>
        <button className="text-button journal-list-back" onClick={() => setDetail(false)}>← All shots</button>
        {selected ? <>
          <div className="hint">{new Date(selected.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
          <h2 className="journal-title">{selected.workflow?.context?.coffeeName || 'Untitled coffee'}</h2>
          <div className="journal-graph"><LastShotGraph shot={selected} /></div>
          <div className="row between journal-summary"><span className="hint">{(selected.annotations?.actualDoseWeight ?? selected.workflow?.context?.targetDoseWeight)?.toFixed(1) ?? '—'} g in <span aria-hidden="true">→</span> {selected.annotations?.actualYield?.toFixed(1) ?? '—'} g out</span><span className="num">{ratio(selected)}</span></div>
          <label className="eyebrow" htmlFor="shot-notes">Tasting notes</label>
          <textarea id="shot-notes" className="notes" value={notes} placeholder="How did it taste?" disabled={busy || opening}
            onChange={e => setDrafts(prev => ({ ...prev, [selected.id]: e.target.value }))} />
          <div className="row between"><span className="hint" role="status">{dirty ? 'Unsaved changes' : 'Saved'}</span><Button quiet width={140} height={44} disabled={!dirty || busy || opening} onClick={() => run('Save note', persistNotes)}>{busy ? 'Saving…' : 'Save note'}</Button></div>
        </> : <div className="empty-state">{loading ? 'Loading your journal…' : 'Select a shot to explore it.'}</div>}
      </aside>
    </div>
    <footer className="page-footer"><span className={message ? 'error-text' : 'hint'} role={message ? 'alert' : 'status'}>{message ?? status ?? ''}</span><div className="row">
      {demo.on && selected && <Button quiet disabled={busy || opening} onClick={() => run('Save note', async () => { await persistNotes(); onReplay(selected) })}>Replay shot</Button>}
      <Button disabled={busy || opening} onClick={leave}>Back</Button></div></footer>
    {leaving && <Overlay title="Save your tasting note?" dismissible={!busy} onClose={() => setLeaving(false)} footer={<div className="row"><Button quiet disabled={busy} onClick={onBack}>Discard note</Button><Button disabled={busy} onClick={saveAndLeave}>{busy ? 'Saving…' : 'Save and leave'}</Button></div>}><p>Your latest note hasn’t been saved. Save it before leaving, or close this panel to keep editing.</p>{message && <p className="error-text" role="alert">{message}</p>}</Overlay>}
  </div>
}
