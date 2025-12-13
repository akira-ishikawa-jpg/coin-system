import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
import { requestNotificationPermission, showNotification } from '../lib/notifications'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Transaction = { id: string; sender_name?: string; receiver_name?: string; coins: number; message: string; created_at: string; is_sent: boolean }

export default function MyPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [receivedThisMonth, setReceivedThisMonth] = useState<number>(0)
  const [history, setHistory] = useState<Transaction[]>([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user || !user.email) return
    setUserEmail(user.email)

    // get employee record
    const { data: emp } = await supabase.from('employees').select('id').eq('email', user.email).limit(1).maybeSingle()
    if (!emp) return

    // compute week start (Monday-based week)
    const weekStart = (() => {
      const d = new Date()
      const day = d.getDay()
      const diff = (day === 0 ? -6 : 1) - day
      d.setDate(d.getDate() + diff)
      d.setHours(0,0,0,0)
      return d.toISOString().slice(0,10)
    })()

    // 今週の取引を取得（week_startの値に関わらず、created_atで判定）
    const weekStartDate = new Date(weekStart)
    const { data: sent } = await supabase
      .from('coin_transactions')
      .select('coins')
      .eq('sender_id', emp.id)
      .gte('created_at', weekStartDate.toISOString())
    const sentSum = (sent || []).reduce((s:any, r:any) => s + (r.coins||0), 0)

    const { data: setting } = await supabase.from('settings').select('value').eq('key','default_weekly_coins').limit(1).maybeSingle()
    const defaultWeekly = setting ? parseInt(setting.value,10) : 250
    setRemaining(defaultWeekly - sentSum)

    // month received
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    
    // Calculate next month (handle year rollover)
    const nextMonth = m === 12 ? 1 : m + 1
    const nextYear = m === 12 ? y + 1 : y
    
    const { data: recv } = await supabase.from('coin_transactions').select('coins').eq('receiver_id', emp.id).gte('created_at', `${y}-${String(m).padStart(2,'0')}-01`).lt('created_at', `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`)
    setReceivedThisMonth((recv || []).reduce((s:any,r:any)=>s+(r.coins||0),0))

    // history (sent + received)
    const { data: tx } = await supabase.from('coin_transactions').select('*').or(`sender_id.eq.${emp.id},receiver_id.eq.${emp.id}`).order('created_at', { ascending: false }).limit(20)
    if (tx) {
      const ids = new Set<string>()
      tx.forEach((t:any) => { if (t.sender_id) ids.add(t.sender_id); if (t.receiver_id) ids.add(t.receiver_id) })
      const { data: emps } = await supabase.from('employees').select('id,name').in('id', Array.from(ids))
      const empMap = {} as { [key: string]: string }
      (emps||[]).forEach((e:any) => { empMap[e.id] = e.name })
      const txList: Transaction[] = tx.map((t:any) => ({
        id: t.id,
        sender_name: empMap[t.sender_id],
        receiver_name: empMap[t.receiver_id],
        coins: t.coins,
        message: t.message,
        created_at: t.created_at,
        is_sent: t.sender_id === emp.id
      }))
      setHistory(txList)
    }
  }

  return (
    <div>
      <Header />
      <main className="bg-white min-h-screen py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold mb-8 text-slate-900">マイページ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
              <div className="text-sm text-gray-600">メール</div>
              <div className="font-bold text-xl text-slate-900 break-all">{userEmail || '-'}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
              <div className="text-sm text-gray-600">今週の残コイン</div>
              <div className="font-bold text-2xl text-teal-600">{remaining === null ? '-' : remaining}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
              <div className="text-sm text-gray-600">今月の受取合計</div>
              <div className="font-bold text-2xl text-teal-600">{receivedThisMonth}</div>
            </div>
          </div>

          <h3 className="text-2xl font-bold mb-6 text-slate-900">送受信履歴（最近20件）</h3>
          {history.length === 0 ? (
            <p className="text-gray-600">履歴がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="border px-3 py-2 text-left">日時</th>
                    <th className="border px-3 py-2 text-left">種別</th>
                    <th className="border px-3 py-2 text-left">相手</th>
                    <th className="border px-3 py-2 text-center">コイン</th>
                    <th className="border px-3 py-2 text-left">メッセージ</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="border px-3 py-2">{new Date(tx.created_at).toLocaleString('ja-JP')}</td>
                      <td className="border px-3 py-2 font-semibold text-teal-600">{tx.is_sent ? '贈呈' : '受取'}</td>
                      <td className="border px-3 py-2">{tx.is_sent ? tx.receiver_name : tx.sender_name}</td>
                      <td className="border px-3 py-2 text-center font-bold">{tx.coins}</td>
                      <td className="border px-3 py-2 truncate">{tx.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = targetDate.getFullYear()
      const month = targetDate.getMonth() + 1
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
      const monthEnd = month === 12 
        ? `${year + 1}-01-01` 
        : `${year}-${String(month + 1).padStart(2, '0')}-01`
      
      // Get received coins
      const { data: received } = await supabase
        .from('coin_transactions')
        .select('coins')
        .eq('receiver_id', employeeId)
        .gte('created_at', monthStart)
        .lt('created_at', monthEnd)
      
      // Get sent coins
      const { data: sent } = await supabase
        .from('coin_transactions')
        .select('coins')
        .eq('sender_id', employeeId)
        .gte('created_at', monthStart)
        .lt('created_at', monthEnd)
      
      const receivedSum = (received || []).reduce((s: any, r: any) => s + (r.coins || 0), 0)
      const sentSum = (sent || []).reduce((s: any, r: any) => s + (r.coins || 0), 0)
      
      data.push({
        month: `${month}月`,
        受取: receivedSum,
        贈呈: sentSum
      })
    }
    
    setMonthlyData(data)
  }

  async function handleUpdateProfile() {
    setEditLoading(true)
    setEditMessage('')
    
    try {
      // Update name and/or department in employees table
      const updates: any = {}
      if (editName !== userName) updates.name = editName
      if (editDepartment !== department) updates.department = editDepartment
      
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('employees')
          .update(updates)
          .eq('id', empId)
        
        if (updateError) throw updateError
      }

      // Update email in Supabase Auth and employees table
      if (editEmail !== userEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: editEmail })
        if (emailError) throw emailError

        const { error: empEmailError } = await supabase
          .from('employees')
          .update({ email: editEmail })
          .eq('id', empId)
        
        if (empEmailError) throw empEmailError
      }

      // Update password if provided
      if (editPassword) {
        const { error: passError } = await supabase.auth.updateUser({ password: editPassword })
        if (passError) throw passError
      }

      setEditMessage('✅ プロフィールを更新しました')
      setEditMode(false)
      // Reload data
      await load()
    } catch (error: any) {
      setEditMessage('❌ 更新に失敗しました: ' + error.message)
    } finally {
      setEditLoading(false)
      setEditPassword('')
    }
  }

  async function handleEnableNotifications() {
    const granted = await requestNotificationPermission()
    setNotificationEnabled(granted)
    
    if (granted) {
      // Test notification
      await showNotification('通知を有効にしました', {
        body: 'コイン受け取り時に通知が届くようになります',
        icon: '/salesnow-logo.svg'
      })
    } else {
      alert('通知が拒否されました。ブラウザの設定から許可してください。')
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('ログアウトエラー:', error)
      alert('ログアウトに失敗しました')
    }
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white p-8 text-center">
              <h1 className="text-4xl font-bold mb-2">👤 マイページ</h1>
              <p className="text-teal-100">あなたのコイン活動と統計</p>
            </div>
            
            <div className="p-8">
            
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md font-bold hover:bg-red-700 hover:scale-105 hover:shadow-lg transition-all duration-200"
              >
                ログアウト
              </button>
              <button
                onClick={() => setEditMode(!editMode)}
                className="px-4 py-2 bg-teal-600 text-white rounded-md font-bold hover:bg-teal-700 hover:scale-105 hover:shadow-lg transition-all duration-200"
              >
                {editMode ? 'キャンセル' : 'プロフィール編集'}
              </button>
            </div>

            {editMode ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold mb-4 text-slate-900">プロフィール編集</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">名前</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="名前"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">メールアドレス</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">部署</label>
                    <input
                      type="text"
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="営業"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">新しいパスワード（変更する場合のみ入力）</label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500"
                      placeholder="新しいパスワード"
                    />
                  </div>
                  <button
                    onClick={handleUpdateProfile}
                    disabled={editLoading}
                    className="w-full bg-teal-600 text-white px-4 py-3 rounded-md font-bold hover:bg-teal-700 transition disabled:opacity-50"
                  >
                    {editLoading ? '更新中...' : '更新する'}
                  </button>
                  {editMessage && (
                    <div className={`p-4 rounded-md text-sm ${
                      editMessage.includes('✅') 
                        ? 'bg-green-50 text-green-700 border border-green-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {editMessage}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-600 mb-1">名前</div>
              <div className="text-sm font-bold text-slate-900 truncate">{userName || '-'}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-600 mb-1">部署</div>
              <div className="text-sm font-bold text-slate-900 truncate">{department || '-'}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
              <div className="text-xs text-gray-600 mb-1">メールアドレス</div>
              <div className="text-xs font-bold text-slate-900 truncate">{userEmail || '-'}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 transition-all duration-300 hover:shadow-lg hover:scale-105">
              <div className="text-xs text-gray-600 mb-1">今週の残コイン</div>
              <div className="text-xl font-bold text-teal-600">{remaining === null ? '-' : remaining}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 transition-all duration-300 hover:shadow-lg hover:scale-105">
              <div className="text-xs text-gray-600 mb-1">今月の受取</div>
              <div className="text-xl font-bold text-teal-600">{receivedThisMonth}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 transition-all duration-300 hover:shadow-lg hover:scale-105">
              <div className="text-xs text-gray-600 mb-1">今月の贈呈</div>
              <div className="text-xl font-bold text-teal-600">{sentThisMonth}</div>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          {monthlyData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-8 transition-all duration-300 hover:shadow-lg">
              <h3 className="text-xl font-bold mb-4 text-gray-800">月間推移（過去6ヶ月）</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="受取" stroke="#0d9488" strokeWidth={2} />
                  <Line type="monotone" dataKey="贈呈" stroke="#64748b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Notification Settings */}
          {notificationSupported && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-8">
              <h3 className="text-xl font-bold mb-4 text-gray-800">通知設定</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-700">プッシュ通知</p>
                  <p className="text-sm text-gray-600">コイン受け取り時にブラウザ通知を受け取る</p>
                </div>
                <button
                  onClick={handleEnableNotifications}
                  disabled={notificationEnabled}
                  className={`px-6 py-2 rounded-md font-bold transition ${
                    notificationEnabled
                      ? 'bg-green-100 text-green-700 cursor-not-allowed'
                      : 'bg-teal-600 text-white hover:bg-teal-700'
                  }`}
                >
                  {notificationEnabled ? '✓ 有効' : '有効にする'}
                </button>
              </div>
            </div>
          )}

          {/* Transaction History */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">送受信履歴</h3>
            {loading ? (
              <p className="text-center text-gray-500">読み込み中...</p>
            ) : transactions.length === 0 ? (
              <p className="text-center text-gray-500">履歴がありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-left font-bold text-gray-700">日時</th>
                      <th className="p-3 text-left font-bold text-gray-700">種類</th>
                      <th className="p-3 text-left font-bold text-gray-700">相手</th>
                      <th className="p-3 text-right font-bold text-gray-700">コイン数</th>
                      <th className="p-3 text-left font-bold text-gray-700">メッセージ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx:any, idx:number) => {
                      const isSent = tx.sender_id === empId
                      const partnerName = isSent ? (tx.receiver?.name) : (tx.sender?.name)
                      const date = new Date(tx.created_at).toLocaleString('ja-JP')
                      return (
                        <tr key={tx.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-3 text-gray-700">{date}</td>
                          <td className="p-3 font-bold text-slate-600">
                            {isSent ? '贈呈' : '受信'}
                          </td>
                          <td className="p-3 text-gray-700">{partnerName || '-'}</td>
                          <td className={`p-3 text-right font-bold ${isSent ? 'text-slate-700' : 'text-teal-600'}`}>
                            {isSent ? '-' : '+'}{tx.coins}
                          </td>
                          <td className="p-3 text-gray-600 text-xs">
                            {tx.emoji && <span className="mr-2">{tx.emoji}</span>}
                            {tx.message || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </div>
          </div>
        </div>
      </div>
    </>
  )
}
