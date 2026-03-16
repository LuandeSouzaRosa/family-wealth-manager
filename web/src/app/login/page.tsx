import { login, signup } from './actions'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { LoginClient } from './login-client'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/')
  }

  const resolvedParams = await searchParams
  const message = resolvedParams?.message as string | undefined

  return (
    <LoginClient 
        loginAction={login} 
        signupAction={signup} 
        message={message} 
    />
  )
}
