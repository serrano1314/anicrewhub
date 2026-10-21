import { UI } from '../lib/ui'

type PageHeaderProps = {
  eyebrow: string
  title: string
  description?: string
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header>
      <p className={UI.eyebrow}>{eyebrow}</p>
      <h1 className={`${UI.pageTitle} mt-1`}>{title}</h1>
      {description ? <p className={UI.pageLead}>{description}</p> : null}
    </header>
  )
}
