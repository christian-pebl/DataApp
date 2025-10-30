'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import CustomAuthForm from './CustomAuthForm'

/**
 * AuthForm Component
 *
 * This component now uses CustomAuthForm with strong password validation.
 *
 * Password Requirements:
 * - Minimum 10 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * To revert to Supabase's pre-built Auth UI, uncomment the import and JSX below
 * and comment out the CustomAuthForm import and usage.
 */

// import { Auth } from '@supabase/auth-ui-react'
// import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function AuthForm() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/map-drawing')
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  return (
    <div className="max-w-md mx-auto mt-8 p-6">
      <CustomAuthForm />

      {/* Old Supabase Auth UI (remove this comment block to use it):
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        theme="default"
        providers={[]}
        redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`}
      />
      */}
    </div>
  )
}