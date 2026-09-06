import type { SVGProps } from 'react'

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export function IconFootball(props: IconProps) {
  return (
    <svg {...base(props)}>
      <ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-45 12 12)" />
      <path d="M9 15l6-6M10 12.5l1.5 1.5M12 10.5l1.5 1.5" />
    </svg>
  )
}

export function IconBasketball(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M5.7 5.7c3.4 3.5 3.4 9.1 0 12.6M18.3 5.7c-3.4 3.5-3.4 9.1 0 12.6" />
    </svg>
  )
}

export function IconHockey(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 3l7.2 12.1a3 3 0 0 0 2.6 1.4H20" />
      <ellipse cx="7.5" cy="19.5" rx="3" ry="1.5" />
    </svg>
  )
}

export function IconBaseball(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M6 5.3C7.9 7 9 9.4 9 12s-1.1 5-3 6.7M18 5.3C16.1 7 15 9.4 15 12s1.1 5 3 6.7" />
    </svg>
  )
}

export function IconSoccer(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8l3.6 2.6-1.4 4.2h-4.4l-1.4-4.2zM12 8V3.5M15.6 10.6l4.2-1.3M14.2 14.8l2.6 3.6M9.8 14.8l-2.6 3.6M8.4 10.6L4.2 9.3" />
    </svg>
  )
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function IconCoins(props: IconProps) {
  return (
    <svg {...base(props)}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
    </svg>
  )
}

export function IconTrophy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 4h8v6a4 4 0 0 1-8 0zM8 5H5a3 3 0 0 0 3.2 4M16 5h3a3 3 0 0 1-3.2 4M12 14v3M8 20h8M10 17h4v3h-4z" />
    </svg>
  )
}

export function IconFlame(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21c-3.5 0-6-2.4-6-5.7 0-2.8 1.8-4.6 3.2-6.3.9-1.1 1.8-2.3 1.8-4 1.7 1 5 3.8 5 7 .6-.6 1-1.3 1.2-2.2 1 1.3 1.8 2.9 1.8 5.5 0 3.3-2.5 5.7-6 5.7z" />
    </svg>
  )
}

export function IconTrendUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
    </svg>
  )
}

export function IconTrendDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 7l6 6 4-4 8 8M21 11v6h-6" />
    </svg>
  )
}

export function IconChartBar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 20v-6M11 20V8M17 20V10M21 20H3" />
    </svg>
  )
}

export function IconTarget(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconCheckCircle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 5-5.5" />
    </svg>
  )
}

export function IconStar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9z" />
    </svg>
  )
}

export function IconChat(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 12c0 4.4-4 8-9 8-1.1 0-2.2-.2-3.2-.5L4 21l1.3-3.9C4.5 15.9 4 14 4 12c0-4.4 3.6-8 8.5-8S21 7.6 21 12z" />
    </svg>
  )
}

export function IconBolt(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" />
    </svg>
  )
}

export function IconBot(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="8" width="14" height="11" rx="2" />
      <path d="M12 8V4.5M9 16h6" />
      <circle cx="9.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="3.5" r="1" />
    </svg>
  )
}

export function IconBell(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" />
    </svg>
  )
}

export function IconNews(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M17 8h5v9.5a2.5 2.5 0 0 1-2.5 2.5H5a3 3 0 0 1-3-3V4h15z" />
      <path d="M6 8h7M6 12h7M6 16h4" />
    </svg>
  )
}

export function IconBook(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </svg>
  )
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c.6-3.6 3.7-6 7.5-6s6.9 2.4 7.5 6" />
    </svg>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

export function IconMail(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </svg>
  )
}

export function IconPencil(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  )
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </svg>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function IconDot(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
    </svg>
  )
}
