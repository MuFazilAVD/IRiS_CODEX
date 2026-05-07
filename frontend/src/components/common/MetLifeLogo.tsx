interface MetLifeLogoProps {
  className?: string
  showWordmark?: boolean
}

export function MetLifeLogo({ className, showWordmark = true }: MetLifeLogoProps) {
  const containerClassName = `${showWordmark ? '' : 'overflow-hidden '} inline-block ${className ?? ''}`.trim()
  const imageClassName = showWordmark
    ? 'block h-full w-full object-contain object-left'
    : 'block h-full w-full object-cover object-left'

  return (
    <span aria-label="MetLife logo" className={containerClassName} role="img">
      <img alt="MetLife" className={imageClassName} src="/logo-white-trimmed.png" />
    </span>
  )
}
