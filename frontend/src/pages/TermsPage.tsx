import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchTerms } from '../api/sharing'
import { TermsDocumentView } from '../components/TermsDocumentView'
import { ErrorPanel, LoadingIndicator } from '../components/PageStatus'

export function TermsPage() {
  const termsQuery = useQuery({ queryKey: ['terms'], queryFn: fetchTerms })

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-10">
      <Link to="/" className="text-sm text-indigo-300 hover:text-indigo-200">
        Back
      </Link>
      <div className="mt-6 rounded-3xl border border-white/10 bg-zinc-900/70 p-6 sm:p-8">
        {termsQuery.isPending ? <LoadingIndicator label="Loading terms…" /> : null}
        {termsQuery.isError ? (
          <ErrorPanel message="Could not load the terms." onRetry={() => { void termsQuery.refetch() }} />
        ) : null}
        {termsQuery.data ? <TermsDocumentView terms={termsQuery.data} /> : null}
      </div>
    </main>
  )
}
