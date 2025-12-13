import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

type UserRow = {
  name: string
  email: string
  department: string
  password: string
  slack_id?: string
}

type Result = {
  success: boolean
  row: number
  email: string
  error?: string
}

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

  // Parse CSV data
  const { csvText } = req.body

  if (!csvText || typeof csvText !== 'string') {
    return res.status(400).json({ error: 'Missing csvText field' })
  }

  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    return res.status(400).json({ error: 'CSV must have at least a header and one data row' })
  }

  // Skip header row
  const dataLines = lines.slice(1)
  const results: Result[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim()
    if (!line) continue

    const rowNum = i + 2 // +2 because header is row 1, data starts at row 2
    
    // Parse CSV (simple split by comma, doesn't handle quoted commas)
    const cols = line.split(',').map(c => c.trim())
    
    if (cols.length < 4) {
      results.push({
        success: false,
        row: rowNum,
        email: cols[1] || 'unknown',
        error: '列数が不足しています（最低4列必要: name,email,department,password）'
      })
      continue
    }

    const [name, email, department, password, slack_id] = cols

    // Validation
    if (!name) {
      results.push({ success: false, row: rowNum, email, error: '名前が空です' })
      continue
    }
    if (!email || !email.includes('@')) {
      results.push({ success: false, row: rowNum, email, error: '無効なメールアドレスです' })
      continue
    }
    if (!department) {
      results.push({ success: false, row: rowNum, email, error: '部署が空です' })
      continue
    }
    if (!password || password.length < 6) {
      results.push({ success: false, row: rowNum, email, error: 'パスワードは6文字以上必要です' })
      continue
    }

    // Create user
    try {
      // Check if user already exists
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('email', email)
        .limit(1)
        .maybeSingle()

      if (existing) {
        results.push({ success: false, row: rowNum, email, error: 'このメールアドレスは既に登録されています' })
        continue
      }

      // Create auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

      if (createError) {
        results.push({ success: false, row: rowNum, email, error: 'Auth作成エラー: ' + createError.message })
        continue
      }

      // Create employee record
      const { error: empError } = await supabase
        .from('employees')
        .insert({
          id: newUser.user.id,
          name,
          email,
          department,
          role: 'user',
          slack_id: slack_id || null
        })

      if (empError) {
        // Rollback: delete auth user
        await supabase.auth.admin.deleteUser(newUser.user.id)
        results.push({ success: false, row: rowNum, email, error: 'DB作成エラー: ' + empError.message })
        continue
      }

      results.push({ success: true, row: rowNum, email })
    } catch (error: any) {
      results.push({ success: false, row: rowNum, email, error: '予期しないエラー: ' + error.message })
    }
  }

  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length

  return res.status(200).json({
    total: results.length,
    success: successCount,
    failed: failCount,
    results
  })
}
