const stroke = { fill: 'none', strokeWidth: 1.3, strokeLinecap: 'round' as const }

export const SteamIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" {...stroke}>
    <path d="M8 20V9" /><path d="M12 4c1.5 2-1.5 3.5 0 5.5" />
    <path d="M16 5c1.5 2-1.5 3.5 0 5.5" /><path d="M5 20h6" />
  </svg>
)

export const WaterIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" {...stroke}>
    <path d="M12 3c3.5 5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-6 6-11z" />
  </svg>
)

export const FlushIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" {...stroke}>
    <path d="M4 6h16" /><path d="M7 6v10a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V6" />
    <path d="M11 10v5M14 10v5" />
  </svg>
)

export const Chevron = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" {...stroke} strokeWidth={1.4}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

export const BeanIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" {...stroke}>
    <ellipse cx="12" cy="12" rx="6.2" ry="8.8" transform="rotate(-38 12 12)" />
    <path d="M8.6 16.6c2.7-1.2 3.7-3.2 3.1-6 -.6-2.8.4-4.8 3.1-6" />
  </svg>
)

export const GearIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" stroke="currentColor" {...stroke}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
  </svg>
)
