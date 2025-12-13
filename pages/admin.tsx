import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Row = { employee_id: string; name: string; email: string; department: string; total_received: number; total_sent: number; total_likes: number }

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [unauth, setUnauth] = useState(false)
  
  // User addition form state
  const [showAddUser, setShowAddUser] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newDepartment, setNewDepartment] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newSlackId, setNewSlackId] = useState('')
  const [addMessage, setAddMessage] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // CSV bulk upload state
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<any>(null)

  // CSV export filter state
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [exportDepartment, setExportDepartment] = useState('')
  const [exportSortBy, setExportSortBy] = useState('received')
  const [exportMinCoins, setExportMinCoins] = useState(0)
  const [exportStartYear, setExportStartYear] = useState(new Date().getFullYear())
  const [exportStartMonth, setExportStartMonth] = useState(new Date().getMonth() + 1)
  const [exportEndYear, setExportEndYear] = useState(new Date().getFullYear())
  const [exportEndMonth, setExportEndMonth] = useState(new Date().getMonth() + 1)
  const [departmentData, setDepartmentData] = useState<any[]>([])

  // Audit log viewer state
  const [activeTab, setActiveTab] = useState<'stats' | 'audit'>('stats')
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditFilterAction, setAuditFilterAction] = useState('')
  const [auditFilterUser, setAuditFilterUser] = useState('')
  const [auditPage, setAuditPage] = useState(0)
  const [auditTotal, setAuditTotal] = useState(0)
  const AUDIT_PAGE_SIZE = 50

  useEffect(() => { load() }, [])
  useEffect(() => { if (activeTab === 'audit') loadAuditLogs() }, [activeTab, auditPage, auditFilterAction, auditFilterUser])

  async function load() {
    setLoading(true)
    const sessionRes = await supabase.auth.getSession()
    const user = (sessionRes as any)?.data?.session?.user
    if (!user) { setUnauth(true); setLoading(false); return }

    // check admin role
    const { data: emp } = await supabase.from('employees').select('id,role').eq('email', user.email).limit(1).maybeSingle()
    if (!emp || emp.role !== 'admin') { setUnauth(true); setLoading(false); return }

    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    
    // Calculate next month (handle year rollover)
    const nextMonth = m === 12 ? 1 : m + 1
    const nextYear = m === 12 ? y + 1 : y

    // aggregate monthly stats (received, sent, likes)
    const { data } = await supabase.rpc('aggregate_monthly_stats', { year_in: y, month_in: m })
    if (data) { setRows((data as any) || []) }
    else {
      // fallback query
      const { data: employees } = await supabase.from('employees').select('id,name,email,department')
      const stats = await Promise.all(
        (employees || []).map(async (emp: any) => {
          const { data: recv } = await supabase.from('coin_transactions').select('coins').eq('receiver_id', emp.id).gte('created_at', `${y}-${String(m).padStart(2,'0')}-01`).lt('created_at', `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`)
          const { data: sent } = await supabase.from('coin_transactions').select('coins').eq('sender_id', emp.id).gte('created_at', `${y}-${String(m).padStart(2,'0')}-01`).lt('created_at', `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`)
          const { data: likes } = await supabase.from('transaction_likes').select('id, coin_transactions!inner(receiver_id, created_at)').eq('coin_transactions.receiver_id', emp.id).gte('coin_transactions.created_at', `${y}-${String(m).padStart(2,'0')}-01`).lt('coin_transactions.created_at', `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`)
          return {
            employee_id: emp.id,
            name: emp.name,
            email: emp.email,
            department: emp.department,
            total_received: (recv || []).reduce((s: any, r: any) => s + (r.coins || 0), 0),
            total_sent: (sent || []).reduce((s: any, r: any) => s + (r.coins || 0), 0),
            total_likes: (likes || []).length
          }
        })
      )
      setRows(stats)
    }

    // Calculate department summary
    const deptMap: Record<string, { received: number; sent: number; count: number }> = {}
    const allRows = data || []
    
    allRows.forEach((row: any) => {
      const dept = row.department || '未設定'
      if (!deptMap[dept]) {
        deptMap[dept] = { received: 0, sent: 0, count: 0 }
      }
      deptMap[dept].received += row.total_received || 0
      deptMap[dept].sent += row.total_sent || 0
      deptMap[dept].count += 1
    })
    
    const deptData = Object.entries(deptMap).map(([name, stats]) => ({
      部署: name,
      平均受取: Math.round(stats.received / stats.count),
      平均贈呈: Math.round(stats.sent / stats.count),
      人数: stats.count
    }))
    
    setDepartmentData(deptData)
    setLoading(false)
  }

  async function exportCsv() {
    // Get access token
    const sessionRes = await supabase.auth.getSession()
    const token = (sessionRes as any)?.data?.session?.access_token
    if (!token) { alert('認証エラー'); return }

    // Build query string with filters
    const params = new URLSearchParams()
    params.append('startYear', exportStartYear.toString())
    params.append('startMonth', exportStartMonth.toString())
    params.append('endYear', exportEndYear.toString())
    params.append('endMonth', exportEndMonth.toString())
    if (exportDepartment) params.append('department', exportDepartment)
    params.append('sortBy', exportSortBy)
    if (exportMinCoins > 0) params.append('minCoins', exportMinCoins.toString())

    const res = await fetch(`/api/admin/export?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) { alert('エクスポート失敗'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'monthly_summary.csv'
    a.click()
  }

  async function loadAuditLogs() {
    setAuditLoading(true)
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, employees(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(auditPage * AUDIT_PAGE_SIZE, (auditPage + 1) * AUDIT_PAGE_SIZE - 1)

      if (auditFilterAction) {
        query = query.eq('action', auditFilterAction)
      }

      const { data, error, count } = await query
      if (error) throw error

      // Filter by user name if specified
      let filteredData = data || []
      if (auditFilterUser) {
        filteredData = filteredData.filter((log: any) => 
          log.employees?.name?.toLowerCase().includes(auditFilterUser.toLowerCase())
        )
      }

      setAuditLogs(filteredData)
      setAuditTotal(count || 0)
    } catch (err) {
      console.error('監査ログ取得エラー:', err)
      alert('監査ログの取得に失敗しました: ' + (err as Error).message)
    } finally {
      setAuditLoading(false)
    }
  }

  function downloadSampleCsv() {
    const sample = 'name,email,department,password,slack_id\n山田太郎,yamada@example.com,営業,password123,U01234ABCDE\n田中花子,tanaka@example.com,総務,password456,'
    const blob = new Blob([sample], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_users.csv'
    a.click()
  }

  async function handleBulkUpload() {
    if (!csvFile) {
      alert('CSVファイルを選択してください')
      return
    }

    setBulkLoading(true)
    setBulkResult(null)

    try {
      const csvText = await csvFile.text()
      const sessionRes = await supabase.auth.getSession()
      const token = (sessionRes as any)?.data?.session?.access_token

      if (!token) {
        alert('認証エラー')
        setBulkLoading(false)
        return
      }

      const res = await fetch('/api/admin/bulk-add-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ csvText })
      })

      const data = await res.json()

      if (res.ok) {
        setBulkResult(data)
        if (data.success > 0) {
          await load() // Reload user list
        }
      } else {
        alert('❌ ' + (data.error || 'アップロードに失敗しました'))
      }
    } catch (error: any) {
      alert('❌ エラー: ' + error.message)
    } finally {
      setBulkLoading(false)
    }
  }

  async function handleAddUser() {
    setAddLoading(true)
    setAddMessage('')

    try {
      const sessionRes = await supabase.auth.getSession()
      const token = (sessionRes as any)?.data?.session?.access_token
      if (!token) {
        setAddMessage('❌ 認証エラー')
        setAddLoading(false)
        return
      }

      const res = await fetch('/api/admin/add-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          department: newDepartment,
          password: newPassword,
          slack_id: newSlackId || null
        })
      })

      const data = await res.json()

      if (res.ok) {
        setAddMessage('✅ ユーザーを追加しました')
        setNewName('')
        setNewEmail('')
        setNewDepartment('')
        setNewPassword('')
        setNewSlackId('')
        setShowAddUser(false)
        // Reload the user list
        await load()
      } else {
        setAddMessage('❌ ' + (data.error || 'ユーザー追加に失敗しました'))
      }
    } catch (error: any) {
      setAddMessage('❌ エラー: ' + error.message)
    } finally {
      setAddLoading(false)
    }
  }

  async function handleDeleteUser(employeeId: string, name: string) {
    if (!confirm(`本当に「${name}」を削除しますか？この操作は取り消せません。`)) {
      return
    }

    setDeletingId(employeeId)

    try {
      const sessionRes = await supabase.auth.getSession()
      const token = (sessionRes as any)?.data?.session?.access_token
      if (!token) {
        alert('❌ 認証エラー')
        setDeletingId(null)
        return
      }

      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ employeeId })
      })

      const data = await res.json()

      if (res.ok) {
        alert('✅ ユーザーを削除しました')
        await load()
      } else {
        alert('❌ ' + (data.error || 'ユーザー削除に失敗しました'))
      }
    } catch (error: any) {
      alert('❌ エラー: ' + error.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (unauth) return (
    <>
      <Header />
      <div className="min-h-screen bg-white py-16 px-4">
        <div className="container mx-auto max-w-md">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">アクセス権限なし</h2>
            <p className="text-gray-600">管理者アカウントでログインしてください</p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white p-8 text-center">
              <h1 className="text-4xl font-bold mb-2">⚙️ 管理者ダッシュボード</h1>
              <p className="text-teal-100">システムの統計情報と管理機能</p>
            </div>
            
            <div className="p-8">

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 mb-8 justify-center">
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 font-semibold transition-all duration-200 hover:scale-105 ${
                  activeTab === 'stats'
                    ? 'text-teal-600 border-b-2 border-teal-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                統計・ユーザー管理
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-6 py-3 font-semibold transition-all duration-200 hover:scale-105 ${
                  activeTab === 'audit'
                    ? 'text-teal-600 border-b-2 border-teal-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                監査ログ
              </button>
            </div>

            {activeTab === 'stats' && (
              <>
                <div className="flex gap-4 flex-col md:flex-row justify-center mb-8">
              <button 
                onClick={() => setShowAddUser(!showAddUser)} 
                className="bg-teal-600 text-white px-6 py-3 rounded-md font-bold hover:bg-teal-700 hover:scale-105 hover:shadow-lg transition-all duration-200"
              >
                {showAddUser ? '閉じる' : 'ユーザー追加'}
              </button>
              <button 
                onClick={() => setShowBulkUpload(!showBulkUpload)} 
                className="bg-teal-600 text-white px-6 py-3 rounded-md font-bold hover:bg-teal-700 hover:scale-105 hover:shadow-lg transition-all duration-200"
              >
                {showBulkUpload ? '閉じる' : 'CSV一括登録'}
              </button>
              <button 
                onClick={() => setShowExportOptions(!showExportOptions)} 
                className="bg-teal-600 text-white px-6 py-3 rounded-md font-bold hover:bg-teal-700 hover:scale-105 hover:shadow-lg transition-all duration-200"
              >
                {showExportOptions ? '閉じる' : 'CSVエクスポート'}
              </button>
            </div>

            {/* Add User Form */}
            {showAddUser && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold mb-4 text-slate-900">新規ユーザー追加</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">名前</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="山田 太郎"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">メールアドレス</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">部署</label>
                    <input
                      type="text"
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="営業"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">初期パスワード</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="6文字以上"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Slack ID（任意）</label>
                    <input
                      type="text"
                      value={newSlackId}
                      onChange={(e) => setNewSlackId(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="U01234ABCDE"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddUser}
                  disabled={addLoading || !newName || !newEmail || !newDepartment || !newPassword}
                  className="w-full bg-teal-600 text-white px-4 py-3 rounded-md font-bold hover:bg-teal-700 transition disabled:opacity-50"
                >
                  {addLoading ? '追加中...' : 'ユーザーを追加'}
                </button>
                {addMessage && (
                  <div className={`mt-4 p-4 rounded-md text-sm ${
                    addMessage.includes('✅') 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {addMessage}
                  </div>
                )}
              </div>
            )}

            {/* CSV Bulk Upload */}
            {showBulkUpload && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold mb-4 text-slate-900">CSV一括ユーザー登録</h3>
                <div className="mb-4">
                  <button
                    onClick={downloadSampleCsv}
                    className="text-teal-600 underline hover:text-teal-700 text-sm"
                  >
                    📥 サンプルCSVをダウンロード
                  </button>
                  <p className="text-sm text-gray-600 mt-2">
                    フォーマット: name,email,department,password,slack_id（slack_idは任意）
                  </p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full border border-slate-300 p-3 rounded-md mb-4"
                />
                <button
                  onClick={handleBulkUpload}
                  disabled={bulkLoading || !csvFile}
                  className="w-full bg-teal-600 text-white px-4 py-3 rounded-md font-bold hover:bg-teal-700 transition disabled:opacity-50"
                >
                  {bulkLoading ? 'アップロード中...' : 'CSVをアップロード'}
                </button>
                {bulkResult && (
                  <div className="mt-4 p-4 bg-white border rounded-md">
                    <p className="font-bold mb-2">
                      ✅ 成功: {bulkResult.success} / ❌ 失敗: {bulkResult.failed} / 合計: {bulkResult.total}
                    </p>
                    {bulkResult.results.filter((r: any) => !r.success).length > 0 && (
                      <div className="mt-2 max-h-60 overflow-y-auto">
                        <p className="text-sm font-semibold text-red-600 mb-1">エラー詳細:</p>
                        {bulkResult.results.filter((r: any) => !r.success).map((r: any, i: number) => (
                          <p key={i} className="text-xs text-red-600">
                            行{r.row} ({r.email}): {r.error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CSV Export Options */}
            {showExportOptions && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold mb-4 text-slate-900">CSVエクスポート条件指定</h3>
                
                {/* 期間指定 */}
                <div className="mb-4 p-4 bg-white border border-slate-200 rounded-md">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">期間指定</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">開始</label>
                      <div className="flex gap-2">
                        <select
                          value={exportStartYear}
                          onChange={(e) => setExportStartYear(Number(e.target.value))}
                          className="border border-slate-300 p-2 rounded-md focus:outline-none focus:border-teal-500"
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                            <option key={year} value={year}>{year}年</option>
                          ))}
                        </select>
                        <select
                          value={exportStartMonth}
                          onChange={(e) => setExportStartMonth(Number(e.target.value))}
                          className="border border-slate-300 p-2 rounded-md focus:outline-none focus:border-teal-500"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <option key={month} value={month}>{month}月</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">終了</label>
                      <div className="flex gap-2">
                        <select
                          value={exportEndYear}
                          onChange={(e) => setExportEndYear(Number(e.target.value))}
                          className="border border-slate-300 p-2 rounded-md focus:outline-none focus:border-teal-500"
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                            <option key={year} value={year}>{year}年</option>
                          ))}
                        </select>
                        <select
                          value={exportEndMonth}
                          onChange={(e) => setExportEndMonth(Number(e.target.value))}
                          className="border border-slate-300 p-2 rounded-md focus:outline-none focus:border-teal-500"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <option key={month} value={month}>{month}月</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* その他のフィルター */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">部署フィルター</label>
                    <input
                      type="text"
                      value={exportDepartment}
                      onChange={(e) => setExportDepartment(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="空欄=全部署"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">並び替え</label>
                    <select
                      value={exportSortBy}
                      onChange={(e) => setExportSortBy(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                    >
                      <option value="received">受取コイン順</option>
                      <option value="sent">贈呈コイン順</option>
                      <option value="likes">いいね数順</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">最小受取コイン数</label>
                    <input
                      type="number"
                      value={exportMinCoins}
                      onChange={(e) => setExportMinCoins(Number(e.target.value))}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
                <button
                  onClick={exportCsv}
                  className="w-full bg-teal-600 text-white px-4 py-3 rounded-md font-bold hover:bg-teal-700 transition"
                >
                  条件指定してエクスポート
                </button>
              </div>
            )}

            {/* Department Comparison Chart */}
            {departmentData.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-8 transition-all duration-300 hover:shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-gray-800">部署別コイン比較（今月）</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="部署" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="平均受取" fill="#0d9488" />
                    <Bar dataKey="平均贈呈" fill="#64748b" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-500 mt-2">※1人あたりの平均値を表示</p>
              </div>
            )}

            {loading ? (
              <p className="text-center text-gray-500">読み込み中...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-left font-bold text-gray-700">氏名</th>
                      <th className="p-3 text-left font-bold text-gray-700">メール</th>
                      <th className="p-3 text-left font-bold text-gray-700">部署</th>
                      <th className="p-3 text-right font-bold text-gray-700">月次受取合計</th>
                      <th className="p-3 text-right font-bold text-gray-700">月次贈呈合計</th>
                      <th className="p-3 text-right font-bold text-gray-700">月次いいね合計</th>
                      <th className="p-3 text-center font-bold text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={r.employee_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-3 text-gray-800 font-bold">{r.name}</td>
                        <td className="p-3 text-gray-600 text-xs">{r.email}</td>
                        <td className="p-3 text-gray-600">{r.department}</td>
                        <td className="p-3 text-right font-bold text-teal-600 text-lg">{r.total_received}</td>
                        <td className="p-3 text-right font-bold text-teal-600 text-lg">{r.total_sent}</td>
                        <td className="p-3 text-right font-bold text-teal-600 text-lg">{r.total_likes || 0}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteUser(r.employee_id, r.name)}
                            disabled={deletingId === r.employee_id}
                            className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition disabled:opacity-50"
                          >
                            {deletingId === r.employee_id ? '削除中...' : '削除'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
              </>
            )}

            {activeTab === 'audit' && (
              <>
                <p className="text-center text-gray-600 mb-8">システム操作履歴と異常検知ログ</p>

                {/* Filters */}
                <div className="flex gap-4 mb-6 flex-wrap items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">アクション</label>
                    <select
                      value={auditFilterAction}
                      onChange={(e) => { setAuditFilterAction(e.target.value); setAuditPage(0) }}
                      className="w-full border border-slate-300 rounded px-3 py-2"
                    >
                      <option value="">すべて</option>
                      <option value="send_coins">コイン送信</option>
                      <option value="like">いいね</option>
                      <option value="anomaly_detected">異常検知</option>
                      <option value="add_user">ユーザー追加</option>
                      <option value="delete_user">ユーザー削除</option>
                      <option value="bulk_add_users">一括追加</option>
                      <option value="export">CSV出力</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">ユーザー検索</label>
                    <input
                      type="text"
                      value={auditFilterUser}
                      onChange={(e) => { setAuditFilterUser(e.target.value); setAuditPage(0) }}
                      placeholder="名前で検索"
                      className="w-full border border-slate-300 rounded px-3 py-2"
                    />
                  </div>
                  <button
                    onClick={() => { setAuditFilterAction(''); setAuditFilterUser(''); setAuditPage(0) }}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
                  >
                    リセット
                  </button>
                </div>

                {auditLoading ? (
                  <p className="text-center text-gray-500">読み込み中...</p>
                ) : (
                  <>
                    <div className="overflow-x-auto mb-6">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="p-3 text-left font-bold text-gray-700">日時</th>
                            <th className="p-3 text-left font-bold text-gray-700">アクション</th>
                            <th className="p-3 text-left font-bold text-gray-700">実行者</th>
                            <th className="p-3 text-left font-bold text-gray-700">詳細</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-gray-500">
                                ログがありません
                              </td>
                            </tr>
                          ) : (
                            auditLogs.map((log: any) => (
                              <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-3 text-gray-700">
                                  {new Date(log.created_at).toLocaleString('ja-JP')}
                                </td>
                                <td className="p-3">
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                    log.action === 'anomaly_detected' 
                                      ? 'bg-red-100 text-red-700' 
                                      : log.action === 'send_coins'
                                      ? 'bg-teal-100 text-teal-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {log.action}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-700">{log.employees?.name || '-'}</td>
                                <td className="p-3 text-gray-600 text-xs max-w-md truncate">
                                  {typeof log.payload === 'object' 
                                    ? JSON.stringify(log.payload)
                                    : log.payload || '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600">
                        全 {auditTotal} 件中 {auditPage * AUDIT_PAGE_SIZE + 1} - {Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, auditTotal)} 件を表示
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAuditPage(Math.max(0, auditPage - 1))}
                          disabled={auditPage === 0}
                          className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          前へ
                        </button>
                        <button
                          onClick={() => setAuditPage(auditPage + 1)}
                          disabled={(auditPage + 1) * AUDIT_PAGE_SIZE >= auditTotal}
                          className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          次へ
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
