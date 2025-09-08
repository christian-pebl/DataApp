import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AuthForm from '@/components/auth/AuthForm'

export default async function AuthPage() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/map-drawing')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to DataApp
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access your data exploration tools
          </p>
        </div>
        <AuthForm />
      </div>
    </div>
  )
}