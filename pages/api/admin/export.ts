import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function csvEscape(v: any) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('\n') || s.includes('"')) return '"' + s.replace(/"/g,'""') + '"'
  return s
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Bearer token auth and admin check
  const authHeader = (req.headers.authorization as string) || ''
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = authHeader.split(' ')[1]
  const { data: authData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !authData?.user) return res.status(401).json({ error: 'Unauthorized' })

  const userEmail = authData.user.email
  const { data: emp } = await supabase.from('employees').select('id,role').eq('email', userEmail).limit(1).maybeSingle()
  if (!emp || emp.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  // Parse date range parameters
  const now = new Date()
  const startYear = Number(req.query.startYear) || now.getFullYear()
  const startMonth = Number(req.query.startMonth) || (now.getMonth() + 1)
  const endYear = Number(req.query.endYear) || now.getFullYear()
  const endMonth = Number(req.query.endMonth) || (now.getMonth() + 1)
  const department = req.query.department as string | undefined
  const sortBy = (req.query.sortBy as string) || 'received' // received | sent | likes
  const minCoins = Number(req.query.minCoins) || 0

  // Calculate date range
  const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`
  const endDate = (() => {
    const nextMonth = endMonth === 12 ? 1 : endMonth + 1
    const nextYear = endMonth === 12 ? endYear + 1 : endYear
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  })()

  // Fetch all employees
  const { data: employees } = await supabase.from('employees').select('id,name,email,department')
  
  let rows: any[] = []
  
  // Manual aggregation for date range
  const stats = await Promise.all(
    (employees || []).map(async (emp: any) => {
      // Total received in date range
      const { data: recv } = await supabase
        .from('coin_transactions')
        .select('coins')
        .eq('receiver_id', emp.id)
        .gte('created_at', startDate)
        .lt('created_at', endDate)
      
      // Total sent in date range
      const { data: sent } = await supabase
        .from('coin_transactions')
        .select('coins')
        .eq('sender_id', emp.id)
        .gte('created_at', startDate)
        .lt('created_at', endDate)
      
      // Total likes received in date range
      const { data: likesReceived } = await supabase
        .from('transaction_likes')
        .select('id, coin_transactions!inner(receiver_id, created_at)')
        .eq('coin_transactions.receiver_id', emp.id)
        .gte('coin_transactions.created_at', startDate)
        .lt('coin_transactions.created_at', endDate)
      
      // Total likes given in date range
      const { data: likesGiven } = await supabase
        .from('transaction_likes')
        .select('id, coin_transactions!inner(sender_id, created_at)')
        .eq('coin_transactions.sender_id', emp.id)
        .gte('coin_transactions.created_at', startDate)
        .lt('coin_transactions.created_at', endDate)
      
      return {
        employee_id: emp.id,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        total_received: (recv || []).reduce((s: any, r: any) => s + (r.coins || 0), 0),
        total_sent: (sent || []).reduce((s: any, r: any) => s + (r.coins || 0), 0),
        total_likes: (likesReceived || []).length + (likesGiven || []).length
      }
    })
  )
  
  rows = stats

  // Apply filters
  if (department) {
    rows = rows.filter(r => r.department === department)
  }
  if (minCoins > 0) {
    rows = rows.filter(r => (r.total_received || 0) >= minCoins)
  }

  // Apply sorting
  if (sortBy === 'received') {
    rows.sort((a, b) => (b.total_received || 0) - (a.total_received || 0))
  } else if (sortBy === 'sent') {
    rows.sort((a, b) => (b.total_sent || 0) - (a.total_sent || 0))
  } else if (sortBy === 'likes') {
    rows.sort((a, b) => (b.total_likes || 0) - (a.total_likes || 0))
  }

  // CSV
  const header = ['社員ID','氏名','メール','部署','月次受取合計','月次贈呈合計','月次いいね合計']
  const lines = [header.map(csvEscape).join(',')]
  rows.forEach(r=> {
    lines.push([
      r.employee_id, 
      r.name, 
      r.email, 
      r.department, 
      r.total_received,
      r.total_sent,
      r.total_likes || 0
    ].map(csvEscape).join(','))
  })
  const csv = lines.join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="summary_${startYear}${String(startMonth).padStart(2,'0')}-${endYear}${String(endMonth).padStart(2,'0')}.csv"`)
  res.status(200).send(csv)
}
