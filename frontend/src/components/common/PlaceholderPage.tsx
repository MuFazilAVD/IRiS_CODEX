import { PageHeader } from './PageHeader'

interface PlaceholderPageProps {
  title: string
  subtitle: string
}

export function PlaceholderPage({ title, subtitle }: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} eyebrow="Build Sequence" />
      <div className="rounded-xl border border-dashed border-iris-border bg-white p-8 text-sm text-iris-text-secondary shadow-sm">
        This route is scaffolded and reserved for a later build-plan phase.
      </div>
    </div>
  )
}

