import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
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
  const { data: currentUser } = await supabase
    .from('employees')
    .select('id,role')
    .eq('email', userEmail)
    .limit(1)
    .maybeSingle()

  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' })
  }

  // Get request body
  const { employee_id, new_role } = req.body

  if (!employee_id || !new_role) {
    return res.status(400).json({ error: 'Missing required fields: employee_id, new_role' })
  }

  // Validate role
  if (!['user', 'admin'].includes(new_role)) {
    return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' })
  }

  // Prevent self-role change to non-admin (to avoid lockout)
  if (employee_id === currentUser.id && new_role !== 'admin') {
    return res.status(400).json({ error: 'Cannot remove admin role from yourself' })
  }

  try {
    // Update user role
    const { error: updateError } = await supabase
      .from('employees')
      .update({ role: new_role })
      .eq('id', employee_id)

    if (updateError) {
      return res.status(400).json({ error: 'Failed to update user role: ' + updateError.message })
    }

    // Get updated user info
    const { data: updatedUser } = await supabase
      .from('employees')
      .select('id,name,email,role')
      .eq('id', employee_id)
      .limit(1)
      .maybeSingle()

    return res.status(200).json({ 
      success: true, 
      user: updatedUser,
      message: `権限を${new_role === 'admin' ? '管理者' : '一般ユーザー'}に変更しました`
    })
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
}