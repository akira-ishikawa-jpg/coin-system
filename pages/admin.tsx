import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'

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

  useEffect(() => { load() }, [])

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

    // aggregate monthly stats (received, sent, likes)
    const { data } = await supabase.rpc('aggregate_monthly_stats', { year_in: y, month_in: m })
    if (data) { setRows((data as any) || []) }
    else {
      // fallback query
      const { data: employees } = await supabase.from('employees').select('id,name,email,department')
      const stats = await Promise.all(
        (employees || []).map(async (emp: any) => {
          const { data: recv } = await supabase.from('coin_transactions').select('coins').eq('receiver_id', emp.id).gte('created_at', `${y}-${String(m).padStart(2,'0')}-01`).lt('created_at', `${y}-${String(m+1).padStart(2,'0')}-01`)
          const { data: sent } = await supabase.from('coin_transactions').select('coins').eq('sender_id', emp.id).gte('created_at', `${y}-${String(m).padStart(2,'0')}-01`).lt('created_at', `${y}-${String(m+1).padStart(2,'0')}-01`)
          const { data: likes } = await supabase.from('transaction_likes').select('id, coin_transactions!inner(receiver_id, created_at)').eq('coin_transactions.receiver_id', emp.id).gte('coin_transactions.created_at', `${y}-${String(m).padStart(2,'0')}-01`).lt('coin_transactions.created_at', `${y}-${String(m+1).padStart(2,'0')}-01`)
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

    setLoading(false)
  }

  async function exportCsv() {
    // Get access token
    const sessionRes = await supabase.auth.getSession()
    const token = (sessionRes as any)?.data?.session?.access_token
    if (!token) { alert('認証エラー'); return }

    // Build query string with filters
    const params = new URLSearchParams()
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
      <div className="min-h-screen bg-white py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8">
            <h2 className="text-4xl font-bold mb-2 text-center text-slate-900">管理者ダッシュボード</h2>
            <p className="text-center text-gray-600 mb-8">今月のコイン受取サマリー</p>

            <div className="flex gap-4 flex-col md:flex-row justify-center mb-8">
              <button 
                onClick={() => setShowAddUser(!showAddUser)} 
                className="bg-teal-600 text-white px-6 py-3 rounded-md font-bold hover:bg-teal-700 transition"
              >
                {showAddUser ? '閉じる' : 'ユーザー追加'}
              </button>
              <button 
                onClick={() => setShowBulkUpload(!showBulkUpload)} 
                className="bg-teal-600 text-white px-6 py-3 rounded-md font-bold hover:bg-teal-700 transition"
              >
                {showBulkUpload ? '閉じる' : 'CSV一括登録'}
              </button>
              <button 
                onClick={() => setShowExportOptions(!showExportOptions)} 
                className="bg-teal-600 text-white px-6 py-3 rounded-md font-bold hover:bg-teal-700 transition"
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
          </div>
        </div>
      </div>
    </>
  )
}
