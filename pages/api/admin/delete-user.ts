import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../lib/supabaseClient'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check authorization
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '認証が必要です' })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return res.status(401).json({ error: '認証エラー' })
    }

    // Check admin role
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('email', user.email)
      .limit(1)
      .maybeSingle()

    if (!employee || employee.role !== 'admin') {
      return res.status(403).json({ error: '管理者権限が必要です' })
    }

    // Get employee ID to delete
    const { employeeId } = req.body

    if (!employeeId) {
      return res.status(400).json({ error: 'employeeIdが必要です' })
    }

    // Get the employee's auth user ID
    const { data: empData } = await supabase
      .from('employees')
      .select('email')
      .eq('id', employeeId)
      .limit(1)
      .maybeSingle()

    if (!empData) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' })
    }

    // Delete from auth.users using admin client
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    const targetUser = authUsers.users.find(u => u.email === empData.email)
    
    if (targetUser) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id)
      if (deleteAuthError) {
        console.error('Auth user delete error:', deleteAuthError)
        // Continue anyway - will delete from employees table
      }
    }

    // Delete from employees table
    const { error: deleteEmpError } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId)

    if (deleteEmpError) {
      return res.status(500).json({ error: 'ユーザー削除に失敗しました' })
    }

    return res.status(200).json({ message: 'ユーザーを削除しました' })

  } catch (error: any) {
    console.error('Delete user error:', error)
    return res.status(500).json({ error: error.message || 'サーバーエラー' })
  }
}
