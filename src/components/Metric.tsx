interface Props {
  label: string
  value: string
  size?: number
  color?: string
}

export function Metric({ label, value, size = 42, color }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span className="cap">{label}</span>
      <span className="num" style={{ fontSize: size, color }}>{value}</span>
    </div>
  )
}
