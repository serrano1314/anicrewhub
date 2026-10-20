import { createElement, type ReactNode } from 'react'

function renderDescriptionNode(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (!(node instanceof Element)) return null

  const tag = node.tagName.toLowerCase()
  if (['script', 'style', 'iframe', 'object', 'svg'].includes(tag)) return null
  const children = Array.from(node.childNodes).map((child, index) =>
    renderDescriptionNode(child, `${key}-${index}`),
  )

  switch (tag) {
    case 'b':
    case 'strong':
      return createElement('strong', { key }, ...children)
    case 'i':
    case 'em':
      return createElement('em', { key }, ...children)
    case 'br':
      return createElement('br', { key })
    case 'p':
    case 'div':
      return createElement('span', { key, className: 'block [&+span]:mt-2' }, ...children)
    case 'ul':
      return createElement('ul', { key, className: 'my-1 list-inside list-disc' }, ...children)
    case 'ol':
      return createElement('ol', { key, className: 'my-1 list-inside list-decimal' }, ...children)
    case 'li':
      return createElement('li', { key }, ...children)
    default:
      return createElement('span', { key }, ...children)
  }
}

export function renderAnimeDescription(description: string): ReactNode[] {
  const parsed = new DOMParser().parseFromString(description, 'text/html')
  return Array.from(parsed.body.childNodes).map((node, index) =>
    renderDescriptionNode(node, `description-${index}`),
  )
}
