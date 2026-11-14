import type { ReactNode } from 'react'

/**
 * What a node says as plain text: a string or a number, or a list of them
 * joined, and `undefined` where it holds anything else, whose words cannot
 * be read off it.
 */
function textOf(node: ReactNode): string | undefined {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (!Array.isArray(node)) {
    return undefined
  }

  const parts = node.map((part: ReactNode) => textOf(part))

  return parts.every((part) => part !== undefined) ? parts.join('') : undefined
}

export { textOf }
