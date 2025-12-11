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
  const [addMessage, setAddMessage] = useState('')
  const [addLoading, setAddLoading] = useState(false)

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
      setRows(stats.filter(s => s.total_received > 0 || s.total_sent > 0))
    }

    setLoading(false)
  }

  async function exportCsv() {
    // Get access token
    const sessionRes = await supabase.auth.getSession()
    const token = (sessionRes as any)?.data?.session?.access_token
    if (!token) { alert('認証エラー'); return }

    const res = await fetch('/api/admin/export', {
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
          password: newPassword
        })
      })

      const data = await res.json()

      if (res.ok) {
        setAddMessage('✅ ユーザーを追加しました')
        setNewName('')
        setNewEmail('')
        setNewDepartment('')
        setNewPassword('')
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
                {showAddUser ? 'ユーザー追加を閉じる' : 'ユーザー追加'}
              </button>
              <button 
                onClick={exportCsv} 
                className="bg-teal-600 text-white px-6 py-3 rounded-md font-bold hover:bg-teal-700 transition"
              >
                CSVエクスポート
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </>
  )
}
