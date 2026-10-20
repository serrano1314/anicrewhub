import { Link } from 'react-router-dom'
import { AuthFormShell } from '../components/AuthFormShell'
import { ForgotPasswordUnavailableNotice } from '../components/ForgotPasswordUnavailable'

export function ResetPasswordPage() {
  return (
    <AuthFormShell
      title="Reset password"
      description="This reset link cannot be used right now."
      footer={
        <Link to="/" className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordUnavailableNotice />
    </AuthFormShell>
  )
}
