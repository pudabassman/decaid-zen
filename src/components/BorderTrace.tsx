import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** Measure the rendered border, including widths overridden by responsive CSS. */
export function BorderTrace({ target }: { target: RefObject<HTMLElement | null> }) {
  const svg = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0, radius: 0 })
  useLayoutEffect(() => {
    // Child layout effects can run before React attaches the parent's ref.
    const element = target.current ?? svg.current?.parentElement
    if (!element) return
    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      const radius = Math.min(parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0, width / 2, height / 2)
      setBox(previous => previous.width === width && previous.height === height && previous.radius === radius ? previous : { width, height, radius })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [target])
  return <svg ref={svg} aria-hidden="true" className="trace" preserveAspectRatio="none" viewBox={`0 0 ${box.width || 1} ${box.height || 1}`}>
    <rect x={0.5} y={0.5} width={Math.max(0, box.width - 1)} height={Math.max(0, box.height - 1)} rx={Math.max(0, box.radius - .5)} ry={Math.max(0, box.radius - .5)} vectorEffect="non-scaling-stroke" pathLength={100} />
  </svg>
}
