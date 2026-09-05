import { useEffect, useRef, useState } from 'react'
import { client } from '../api/client'
import { Button } from '../components/Button'
import { Dots } from '../components/Dots'
import { LastShotGraph } from '../components/LastShotGraph'
import type { ShotRecord, ShotSummary } from '../api/types'
import { useSwipe } from '../lib/useSwipe'
import { useAction } from '../lib/useAction'

const ratio = (shot: ShotSummary) => {
  const dose = shot.annotations?.actualDoseWeight || shot.workflow?.context?.targetDoseWeight
  const poured = shot.annotations?.actualYield || shot.workflow?.context?.targetYield
  return dose && poured ? `1:${(poured / dose).toFixed(2)}` : '--'
}

export function Journal({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<ShotSummary[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<ShotRecord | null>(null)
  const [notes, setNotes] = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  const screen = useRef<HTMLDivElement>(null)
  const { run, message, busy } = useAction()
  useSwipe(screen, { onRight: (fromLeftEdge) => fromLeftEdge && onBack() })

  const open = (id: string) =>
    client
      .shot(id)
      .then((shot) => {
        setSelected(shot)
        setNotes(shot.annotations?.espressoNotes ?? '')
        setNotesDirty(false)
      })
      .catch(() => undefined)

  const saveNotes = () => {
    if (!selected) return
    run('Save note', async () => {
      const saved = await client.annotateShot(selected.id, { espressoNotes: notes })
      setSelected(saved)
      setNotesDirty(false)
      setItems((prev) =>
        prev.map((item) =>
          item.id === saved.id
            ? { ...item, annotations: { ...item.annotations, espressoNotes: notes } }
            : item,
        ),
      )
    })
  }

  useEffect(() => {
    client
      .shots(20, 0)
      .then((page) => {
        setItems(page.items)
        setTotal(page.total)
        if (page.items[0]) return open(page.items[0].id)
      })
      .catch(() => setItems([]))
  }, [])

  return (
    <div className="screen" ref={screen}>
      <div className="row between" style={{ marginBottom: 24 }}>
        <span className="display" style={{ fontSize: 42, letterSpacing: '-0.01em' }}>Journal</span>
        <span className="cap">{total} shots</span>
      </div>

      <div className="grow" style={{ display: 'flex', gap: 40, minHeight: 0 }}>
        <div style={{ flex: '1 1 auto', overflowY: 'auto' }}>
          {items.map((shot) => {
            const live = selected?.id === shot.id
            return (
              <button
                key={shot.id}
                onClick={() => open(shot.id)}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '68px 1fr 96px',
                  alignItems: 'center',
                  gap: 22,
                  height: 84,
                  padding: 0,
                  background: 'transparent',
                  border: 0,
                  borderTop: `1px solid ${live ? 'var(--ink)' : 'var(--rule-soft)'}`,
                  color: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                }}
              >
                <span className="cap">
                  {new Date(shot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>
                  <span className="display" style={{ fontSize: 26 }}>
                    {shot.workflow?.context?.coffeeName ?? 'Unknown bean'}
                  </span>
                  <span className="cap" style={{ display: 'block', marginTop: 4 }}>
                    {shot.workflow?.profile?.title ?? ''}
                  </span>
                </span>
                <span className="num" style={{ fontSize: 26, color: 'var(--weight)', textAlign: 'right' }}>
                  {ratio(shot)}
                </span>
              </button>
            )
          })}
          {items.length === 0 && <div className="cap">No shots recorded yet</div>}
        </div>

        <aside style={{ flex: '0 0 440px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="cap">
            {selected ? new Date(selected.timestamp).toLocaleString() : 'select a shot'}
          </div>
          <div className="display" style={{ fontSize: 38, lineHeight: 1.06, margin: '12px 0' }}>
            {selected?.workflow?.context?.coffeeName ?? '—'}
          </div>
          <LastShotGraph shot={selected} />
          {selected && (
            <>
              <div className="row between baseline" style={{ marginTop: 20 }}>
                <span className="cap">
                  {selected.annotations?.actualDoseWeight?.toFixed(1) ?? '--'} g in
                  {' \u2192 '}
                  {selected.annotations?.actualYield?.toFixed(1) ?? '--'} g out
                </span>
                <span className="num" style={{ fontSize: 26, color: 'var(--weight)' }}>{ratio(selected)}</span>
              </div>

              <div className="cap" style={{ margin: '24px 0 10px' }}>Notes</div>
              <textarea
                className="notes"
                rows={4}
                value={notes}
                placeholder="How did it taste?"
                onChange={(e) => {
                  setNotes(e.target.value)
                  setNotesDirty(true)
                }}
                onBlur={() => notesDirty && saveNotes()}
              />
              <div className="row between baseline" style={{ marginTop: 12 }}>
                <span className="cap" style={{ color: message ? 'var(--temp)' : undefined }}>
                  {message ?? (notesDirty ? 'unsaved' : 'saved')}
                </span>
                <Button width={150} quiet disabled={!notesDirty || busy} onClick={saveNotes}>
                  <span className="cap">{busy ? <>Saving<Dots /></> : 'Save note'}</span>
                </Button>
              </div>
            </>
          )}
        </aside>
      </div>

      <div className="rule" style={{ margin: '12px 0' }} />
      <div className="row between">
        <span className="cap">Tap a shot to inspect it</span>
        <Button width={168} onClick={onBack}>
          <span className="display" style={{ fontSize: 24 }}>Back</span>
        </Button>
      </div>
    </div>
  )
}
