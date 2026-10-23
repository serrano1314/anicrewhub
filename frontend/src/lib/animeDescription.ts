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
    case 'del':
    case 's':
      return createElement('del', { key }, ...children)
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return createElement('strong', { key, className: 'mt-3 block text-base text-zinc-100' }, ...children)
    case 'br':
      return createElement('br', { key })
    case 'hr':
      return createElement('hr', { key, className: 'my-3 border-white/10' })
    case 'p':
    case 'div':
      return createElement(
        'span',
        {
          key,
          className: node.getAttribute('data-align') === 'center'
            ? 'block text-center [&+span]:mt-2'
            : 'block [&+span]:mt-2',
        },
        ...children,
      )
    case 'center':
      return createElement('span', { key, className: 'block text-center' }, ...children)
    case 'ul':
      return createElement('ul', { key, className: 'my-1 list-inside list-disc' }, ...children)
    case 'ol':
      return createElement('ol', { key, className: 'my-1 list-inside list-decimal' }, ...children)
    case 'li':
      return createElement('li', { key }, ...children)
    case 'a': {
      const href = node.getAttribute('href')
      if (!href || !/^https?:\/\//i.test(href)) return createElement('span', { key }, ...children)
      return createElement(
        'a',
        {
          key,
          href,
          target: '_blank',
          rel: 'noreferrer noopener',
          className: 'text-indigo-300 underline decoration-indigo-300/40 underline-offset-2 hover:text-indigo-200',
        },
        ...children,
      )
    }
    case 'span':
      if (node.getAttribute('data-spoiler') === 'true') {
        return createElement(
          'details',
          { key, className: 'my-2 rounded-lg border border-amber-200/20 bg-amber-200/5 px-3 py-2' },
          createElement(
            'summary',
            { className: 'cursor-pointer select-none text-amber-200' },
            'Show spoiler',
          ),
          createElement('span', { className: 'mt-2 block' }, ...children),
        )
      }
      return createElement('span', { key }, ...children)
    case 'img': {
      const source = node.getAttribute('src')
      if (!source || !/^https?:\/\//i.test(source)) return null
      const widthValue = node.getAttribute('width')
      const width = widthValue && /^\d+$/.test(widthValue) ? Number(widthValue) : null
      return createElement('img', {
        key,
        src: source,
        alt: node.getAttribute('alt') ?? '',
        loading: 'lazy',
        className: 'my-2 max-w-[50%] rounded-lg',
        style: width && width > 0 ? { width: `${width}px`, height: 'auto' } : undefined,
      })
    }
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
