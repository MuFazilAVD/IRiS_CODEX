const CURRENCY_PREFIXES: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  CHF: 'CHF ',
  CAD: 'CAD ',
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return formatCurrencyWithOptions(value, currency)
}

export function formatCurrencyCompact(value: number, currency = 'USD'): string {
  return formatCurrencyWithOptions(value, currency, {
    notation: Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 1_000_000 ? 1 : 0,
  })
}

function formatCurrencyWithOptions(
  value: number,
  currency: string,
  {
    notation = 'standard',
    maximumFractionDigits = 0,
  }: {
    notation?: 'standard' | 'compact'
    maximumFractionDigits?: number
  } = {},
) {
  const normalizedCurrency = currency.toUpperCase()
  const prefix = CURRENCY_PREFIXES[normalizedCurrency] ?? `${normalizedCurrency} `
  const absoluteValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const formattedNumber = new Intl.NumberFormat('en-GB', {
    notation,
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(absoluteValue)
  return `${sign}${prefix}${formattedNumber}`
}

export function formatRelativeDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
