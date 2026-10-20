import { useDialog } from './dialogContext'
import { UI, cn } from '../lib/ui'

export const CONTACT_SUPPORT_UNAVAILABLE_TITLE = 'Support not available yet'
export const CONTACT_SUPPORT_UNAVAILABLE_MESSAGE =
  'Contacting the administrator is not available right now. This feature will be enabled in a future update.'

export function ContactSupportFooterButton({ compact = false }: { compact?: boolean }) {
  const dialog = useDialog()

  return (
    <footer className={compact ? 'pb-2' : 'border-t border-white/10 pt-10 pb-2'}>
      <div className="flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          className={cn(UI.btn, UI.btnSecondary, 'min-w-[1rem] px-4 rounded-full')}
          title={CONTACT_SUPPORT_UNAVAILABLE_MESSAGE}
          onClick={() => {
            void dialog.success({
              title: CONTACT_SUPPORT_UNAVAILABLE_TITLE,
              message: CONTACT_SUPPORT_UNAVAILABLE_MESSAGE,
            })
          }}
        >
          Contact support
        </button>
        <p className="max-w-sm text-xs text-zinc-500">Questions, bugs, or feedback for the administrator</p>
      </div>
    </footer>
  )
}
