type SectionIconName = 'info' | 'related' | 'collection' | 'sites' | 'episodes' | 'reviews'

type SectionIconProps = {
  name: SectionIconName
}

export function SectionIcon({ name }: SectionIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="size-5 shrink-0 text-indigo-200/80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'info' ? (
        <>
          <circle cx="10" cy="10" r="7.5" />
          <path d="M10 9v5M10 6.5h.01" />
        </>
      ) : name === 'related' ? (
        <>
          <circle cx="6" cy="6" r="2.2" />
          <circle cx="14" cy="14" r="2.2" />
          <path d="m7.6 7.6 4.8 4.8M13.8 6.2h2v2" />
        </>
      ) : name === 'collection' ? (
        <>
          <path d="M5 4.5h10M5 10h10M5 15.5h10" />
          <path d="m2.8 4.5.01 0M2.8 10l.01 0M2.8 15.5l.01 0" />
        </>
      ) : name === 'sites' ? (
        <>
          <circle cx="10" cy="10" r="7.5" />
          <path d="M2.8 10h14.4M10 2.5c2 2.1 3 4.6 3 7.5s-1 5.4-3 7.5c-2-2.1-3-4.6-3-7.5s1-5.4 3-7.5Z" />
        </>
      ) : name === 'episodes' ? (
        <>
          <rect x="3" y="3.5" width="14" height="13" rx="2" />
          <path d="M7 3.5v13M13 3.5v13" />
        </>
      ) : (
        <>
          <path d="M4 5.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-3.5 3v-3.2A2 2 0 0 1 4 11.5z" />
          <path d="m10 6.3.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2z" />
        </>
      )}
    </svg>
  )
}
