'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Not authenticated' }

  const full_name = (formData.get('full_name') as string).trim() || null

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, updated_at: new Date().toISOString() })
    .eq('id', session.user.id)

  if (error) return { error: error.message }

  revalidatePath('/account')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updatePassword(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Not authenticated' }

  const password = formData.get('password') as string
  const confirm = formData.get('confirm_password') as string

  if (password !== confirm) return { error: 'Passwords do not match.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  return { success: true }
}
