import { Fragment, type ReactNode } from 'react'

function renderNode(node: ChildNode, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent
  }
  if (!(node instanceof Element)) {
    return null
  }

  const children = Array.from(node.childNodes, renderNode)
  switch (node.tagName.toLowerCase()) {
    case 'ul':
      return <ul key={key} className="list-disc space-y-2.5 pl-5">{children}</ul>
    case 'ol':
      return <ol key={key} className="list-decimal space-y-2.5 pl-5">{children}</ol>
    case 'li':
      return <li key={key} className="pl-1">{children}</li>
    case 'p':
      return <p key={key}>{children}</p>
    case 'strong':
      return <strong key={key}>{children}</strong>
    case 'em':
      return <em key={key}>{children}</em>
    case 'br':
      return <br key={key} />
    default:
      return <Fragment key={key}>{children}</Fragment>
  }
}

export function renderReleaseNotesHtml(html: string): ReactNode {
  const document = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(document.body.childNodes, renderNode)
}
