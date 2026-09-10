export interface StackedLabel {
  y: number
}

/**
 * Pushes labels apart so every one of them is drawn, keeping their order and
 * staying inside the plot. Two values at the same height end up stacked.
 */
export function stackLabels<T extends StackedLabel>(labels: T[], gap: number, top: number, bottom: number): T[] {
  const ordered = [...labels].sort((a, b) => a.y - b.y)
  if (!ordered.length) return ordered

  const room = bottom - top
  const needed = gap * (ordered.length - 1)
  const step = needed > room ? room / Math.max(1, ordered.length - 1) : gap

  ordered.forEach((label, i) => {
    const floor = i === 0 ? top : ordered[i - 1].y + step
    label.y = Math.max(label.y, floor)
  })

  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const ceiling = i === ordered.length - 1 ? bottom : ordered[i + 1].y - step
    ordered[i].y = Math.min(ordered[i].y, ceiling)
  }

  return ordered
}
