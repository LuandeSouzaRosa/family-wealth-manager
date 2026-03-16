import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getCartoesCredito } from '@/actions/finance'
import { CartoesClient } from './cartoes-client'

export default async function CartoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const cartoes = await getCartoesCredito()

  return <CartoesClient initialCartoes={cartoes} />
}
