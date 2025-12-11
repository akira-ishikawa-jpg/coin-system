import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'

type Transaction = { id: string; sender_name?: string; receiver_name?: string; coins: number; message: string; created_at: string; is_sent: boolean }

export default function MyPage() {
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
    if (!user) return
    setUserEmail(user.email)

    // get employee record
    const { data: emp } = await supabase.from('employees').select('id').eq('email', user.email).limit(1).maybeSingle()
    if (!emp) return

    // compute week start
    const weekStart = (() => {
      const d = new Date()
      const day = d.getDay()
      const diff = (day === 0 ? -6 : 1) - day
      d.setDate(d.getDate() + diff)
      d.setHours(0,0,0,0)
      return d.toISOString().slice(0,10)
    })()

    const { data: sent } = await supabase.from('coin_transactions').select('coins').eq('sender_id', emp.id).eq('week_start', weekStart)
    const sentSum = (sent || []).reduce((s:any, r:any) => s + (r.coins||0), 0)

    const { data: setting } = await supabase.from('settings').select('value').eq('key','default_weekly_coins').limit(1).maybeSingle()
    const defaultWeekly = setting ? parseInt(setting.value,10) : 250
    setRemaining(defaultWeekly - sentSum)

    // month received
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const { data: recv } = await supabase.from('coin_transactions').select('coins').eq('receiver_id', emp.id).gte('created_at', `${y}-${String(m).padStart(2,'0')}-01`).lt('created_at', `${y}-${String(m+1).padStart(2,'0')}-01`)
    setReceivedThisMonth((recv || []).reduce((s:any,r:any)=>s+(r.coins||0),0))

    // history (sent + received)
    const { data: tx } = await supabase.from('coin_transactions').select('*').or(`sender_id.eq.${emp.id},receiver_id.eq.${emp.id}`).order('created_at', { ascending: false }).limit(20)
    if (tx) {
      const ids = new Set<string>()
      tx.forEach((t:any) => { if (t.sender_id) ids.add(t.sender_id); if (t.receiver_id) ids.add(t.receiver_id) })
      const { data: emps } = await supabase.from('employees').select('id,name').in('id', Array.from(ids))
      const empMap: Record<string, string> = {}
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
                      <td className={`border px-3 py-2 font-semibold ${tx.is_sent ? 'text-slate-700' : 'text-teal-600'}`}>{tx.is_sent ? '贈呈' : '受取'}</td>
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
