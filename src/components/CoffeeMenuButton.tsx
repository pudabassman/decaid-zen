import { useEffect, useId, useRef, useState } from 'react'
import { coffeeMenu } from '../lib/coffeeMenu'
import { BeanIcon } from './icons'
import { BorderTrace } from './BorderTrace'
import { CoffeePicker } from './CoffeePicker'

type Props = { roaster: string; count: number; onPick: (name: string) => void }
export function CoffeeMenuButton(props: Props) {
  return <CoffeeMenuButtonContent key={props.roaster.trim().toLowerCase()} {...props} />
}
function CoffeeMenuButtonContent({ roaster, count, onPick }: Props) {
  const button = useRef<HTMLButtonElement>(null)
  const mounted = useRef(true)
  const pending = useRef(false)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const errorId = useId()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const show = async () => {
    if (pending.current) return
    setError('')
    if (coffeeMenu.peek(roaster)) { setOpen(true); return }
    pending.current = true
    setLoading(true)
    try {
      await coffeeMenu.load(roaster)
      // A different drawer may have opened while the request was in flight.
      if (mounted.current && !document.getElementById('root')?.inert) setOpen(true)
    } catch {
      if (mounted.current) setError('Could not load coffees. Tap the bean button to retry.')
    } finally {
      pending.current = false
      if (mounted.current) setLoading(false)
    }
  }
  return <>
    <button ref={button} type="button" className={`beanpill${loading ? ' loading' : ''}`} aria-label={`${count} coffees from ${roaster}`} aria-busy={loading} aria-disabled={loading} aria-expanded={open} aria-describedby={error ? errorId : undefined} onClick={() => void show()}>
      <BorderTrace target={button} />
      <BeanIcon size={13} /><span className="num">{count}</span>
      {loading && <span className="sr-only" role="status">Loading coffees</span>}
    </button>
    {error && <span id={errorId} className="field-error" role="alert">{error}</span>}
    {open && <CoffeePicker roaster={roaster} onClose={() => setOpen(false)} onPick={name => { setOpen(false); onPick(name) }} />}
  </>
}
