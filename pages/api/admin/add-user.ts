import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Bearer token auth and admin check
  const authHeader = (req.headers.authorization as string) || ''
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]
  const { data: authData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !authData?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userEmail = authData.user.email
  const { data: emp } = await supabase
    .from('employees')
    .select('id,role')
    .eq('email', userEmail)
    .limit(1)
    .maybeSingle()

  if (!emp || emp.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' })
  }

  // Get request body
  const { name, email, department, password } = req.body

  if (!name || !email || !department || !password) {
    return res.status(400).json({ error: 'Missing required fields: name, email, department, password' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    // Create user in Supabase Auth using admin API
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Auto-confirm email
    })

    if (createError) {
      return res.status(400).json({ error: 'Failed to create auth user: ' + createError.message })
    }

    // Create employee record
    const { error: empError } = await supabase
      .from('employees')
      .insert({
        id: newUser.user.id,
        name,
        email,
        department,
        role: 'user'
      })

    if (empError) {
      // If employee creation fails, try to delete the auth user
      await supabase.auth.admin.deleteUser(newUser.user.id)
      return res.status(400).json({ error: 'Failed to create employee record: ' + empError.message })
    }

    return res.status(200).json({ 
      success: true, 
      user: { id: newUser.user.id, email, name, department }
    })
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
}
