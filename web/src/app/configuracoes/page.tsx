import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getFamilyDetails } from '@/actions/family'
import { FamilyClientShell } from './family-client'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const familyData = await getFamilyDetails()

  return <FamilyClientShell familyData={familyData} />
}
