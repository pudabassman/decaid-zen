import { useEffect, type RefObject } from 'react'

interface Options {
  onLeft?: (fromRightEdge: boolean) => void
  onRight?: (fromLeftEdge: boolean) => void
  edge?: number
  distance?: number
}

export function useSwipe(ref: RefObject<HTMLElement | null>, options: Options) {
  const { onLeft, onRight, edge = 64, distance = 60 } = options

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let startX = 0
    let startY = 0
    let startedAt = 0
    let fromLeftEdge = false
    let fromRightEdge = false
    let tracking = false

    const down = (event: PointerEvent) => {
      if (!event.isPrimary) return
      tracking = true
      startX = event.clientX
      startY = event.clientY
      startedAt = event.timeStamp
      const rect = el.getBoundingClientRect()
      fromLeftEdge = startX - rect.left <= edge
      fromRightEdge = rect.right - startX <= edge
    }

    const up = (event: PointerEvent) => {
      if (!tracking || !event.isPrimary) return
      tracking = false
      const dx = event.clientX - startX
      const dy = event.clientY - startY
      if (event.timeStamp - startedAt > 900) return
      if (Math.abs(dx) < distance || Math.abs(dy) > Math.abs(dx)) return
      if (dx < 0) onLeft?.(fromRightEdge)
      else onRight?.(fromLeftEdge)
    }

    const cancel = () => {
      tracking = false
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('pointerleave', cancel)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
      el.removeEventListener('pointerleave', cancel)
    }
  }, [ref, onLeft, onRight, edge, distance])
}
