interface AuthStatusScreenProps {
  message?: string
}

export function AuthStatusScreen({ message = 'Checking workspace access...' }: AuthStatusScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0D1B2A] px-6 text-sm font-medium text-white/80">
      {message}
    </div>
  )
}
