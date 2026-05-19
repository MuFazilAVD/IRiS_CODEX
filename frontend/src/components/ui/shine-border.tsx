'use client'

import { cn } from '@/lib/utils'
import type { CSSProperties, ReactNode } from 'react'
import { DIcons, type ValidIcon } from 'dicons'

type TColorProp = string | string[]

interface ShineBorderProps {
  borderRadius?: number
  borderWidth?: number
  duration?: number
  color?: TColorProp
  className?: string
  children: ReactNode
}

/**
 * @name Shine Border
 * @description Animated border wrapper with configurable radius, width, duration and color.
 */
function ShineBorder({
  borderRadius = 8,
  borderWidth = 1,
  duration = 14,
  color = '#000000',
  className,
  children,
}: ShineBorderProps) {
  const resolvedColor = Array.isArray(color) ? color.join(', ') : color

  return (
    <div
      style={
        {
          '--border-radius': `${borderRadius}px`,
          '--border-width': `${borderWidth}px`,
          '--shine-pulse-duration': `${duration}s`,
        } as CSSProperties
      }
      className={cn('relative h-full w-full overflow-hidden rounded-[var(--border-radius)] p-[var(--border-width)]', className)}
    >
      <div
        aria-hidden="true"
        style={
          {
            backgroundImage: `radial-gradient(transparent, transparent, ${resolvedColor}, transparent, transparent)`,
            backgroundSize: '300% 300%',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
          } as CSSProperties
        }
        className="pointer-events-none absolute inset-0 rounded-[var(--border-radius)] p-[var(--border-width)] will-change-[background-position] motion-safe:animate-shine-pulse"
      />
      <div className="relative z-10 h-full w-full rounded-[calc(var(--border-radius)-var(--border-width))]">{children}</div>
    </div>
  )
}

export function TimelineContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex max-w-md flex-col justify-center gap-3 md:order-2">{children}</div>
}

export function TimelineEvent({
  label,
  message,
  icon,
  isLast = false,
}: Event & {
  isLast?: boolean
}) {
  const Icon = DIcons[icon.name]

  return (
    <div className="group relative -m-2 flex gap-4 border border-transparent p-2">
      <div className="relative">
        <div className={cn('rounded-full border bg-white p-2', icon.borderColor)}>
          <Icon className={cn('h-4 w-4', icon.textColor)} />
        </div>
        {!isLast ? <div className="absolute inset-x-0 mx-auto h-full w-[2px] bg-slate-200" /> : null}
      </div>
      <div className="mt-1 flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg font-semibold">{label}</p>
        </div>
        <p className="text-xs text-slate-500">{message}</p>
      </div>
    </div>
  )
}

function Timeline() {
  return (
    <div className="w-full max-w-3xl">
      <TimelineContainer>
        {timeline.map((event, index) => (
          <TimelineEvent key={event.message} isLast={index === timeline.length - 1} {...event} />
        ))}
      </TimelineContainer>
    </div>
  )
}

interface Event {
  label: string
  message: string
  icon: {
    name: ValidIcon
    textColor: string
    borderColor: string
  }
}

const timeline = [
  {
    label: 'Choose Your Design',
    message:
      'Browse and select a design that fits your needs, then access your personalized dashboard.',
    icon: {
      name: 'Shapes',
      textColor: 'text-orange-500',
      borderColor: 'border-orange-500/40',
    },
  },
  {
    label: 'Provide Your Brief',
    message: 'Share your design preferences and requirements with us.',
    icon: {
      name: 'Send',
      textColor: 'text-amber-500',
      borderColor: 'border-amber-500/40',
    },
  },
  {
    label: 'Receive Your Designs',
    message: 'Get your initial designs within 48 hours.',
    icon: {
      name: 'Check',
      textColor: 'text-blue-500',
      borderColor: 'border-blue-500/40',
    },
  },
  {
    label: 'Request Revisions',
    message:
      'We are committed to perfection. Request as many revisions as needed until you are satisfied.',
    icon: {
      name: 'Repeat',
      textColor: 'text-green-500',
      borderColor: 'border-green-500/40',
    },
  },
  {
    label: 'Get Final Files',
    message: 'Once approved, we will deliver the final files to you.',
    icon: {
      name: 'Download',
      textColor: 'text-green-500',
      borderColor: 'border-green-500/40',
    },
  },
] satisfies Event[]

export { ShineBorder, Timeline }
