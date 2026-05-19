type ClassDictionary = Record<string, boolean | null | undefined>
type ClassValue = ClassDictionary | ClassValue[] | number | string | null | false | undefined

function flattenClassValue(value: ClassValue): string[] {
  if (!value) {
    return []
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return [`${value}`]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenClassValue(item))
  }

  return Object.entries(value)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([className]) => className)
}

export function cn(...inputs: ClassValue[]) {
  return inputs.flatMap((input) => flattenClassValue(input)).join(' ')
}
