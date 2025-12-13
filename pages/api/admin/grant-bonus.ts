import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth } from '../../../lib/AuthMiddleware'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun,1=Mon
  const diff = (day === 0 ? -6 : 1) - day // make Monday the first day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authResult = await verifyAuth(req)
  if (!authResult.authenticated || authResult.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }

  const { employee_id, coins, reason } = req.body

  if (!employee_id || !coins || coins <= 0) {
    res.status(400).json({ error: 'Valid employee_id and positive coins required' })
    return
  }

  if (!reason || reason.trim() === '') {
    res.status(400).json({ error: 'Reason is required' })
    return
  }

  try {
    // Get employee info
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name, email')
      .eq('id', employee_id)
      .single()

    if (empError || !employee) {
      res.status(404).json({ error: 'Employee not found' })
      return
    }

    // Insert bonus transaction
    const weekStart = getWeekStart()
    const insertPayload = {
      sender_id: authResult.user.id, // Admin who gave the bonus
      receiver_id: employee_id,
      coins: parseInt(coins),
      message: `[ボーナス] ${reason}`,
      emoji: '🎁',
      week_start: weekStart,
      slack_payload: { bonus: true, admin_granted: true }
    }

    const { error: insertError } = await supabase
      .from('coin_transactions')
      .insert(insertPayload)

    if (insertError) {
      console.error('Insert error:', insertError)
      res.status(500).json({ error: 'Failed to grant bonus coins' })
      return
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      actor_id: authResult.user.id,
      action: 'admin_bonus_granted',
      payload: { 
        employee_id, 
        employee_name: employee.name, 
        coins, 
        reason 
      }
    })

    res.status(200).json({ 
      success: true, 
      message: `${employee.name} に ${coins} ボーナスコインを付与しました` 
    })

  } catch (error) {
    console.error('Bonus grant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}