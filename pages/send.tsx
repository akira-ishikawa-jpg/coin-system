import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Header from '../components/Header'

type Employee = { id: string; name: string; slack_id?: string }

export default function SendPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [receiverId, setReceiverId] = useState('')
  const [coins, setCoins] = useState<number>(10)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    fetchEmployees()
    fetchRemaining()
  }, [])

  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('id,name')
    setEmployees((data as any) || [])
  }

  async function fetchRemaining() {
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user || !user.email) return

    const { data: emp } = await supabase.from('employees').select('id').eq('email', user.email).limit(1).maybeSingle()
    if (!emp) return

    const weekStart = (() => {
      const d = new Date()
      const day = d.getDay()
      const diff = (day === 0 ? -6 : 1) - day
      d.setDate(d.getDate() + diff)
      d.setHours(0,0,0,0)
      return d.toISOString().slice(0,10)
    })()

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
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('贈呈中...')
    const sessionRes = await supabase.auth.getSession()
    const token = (sessionRes as any)?.data?.session?.access_token
    if (!token) {
      setStatus('ログインしてください')
      return
    }

    const payload = { receiver_id: receiverId, coins, message }

    const res = await fetch('/api/coins/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    })
    const j = await res.json()
    if (res.ok) {
      setStatus('贈呈しました')
      setReceiverId('')
      setCoins(10)
      setMessage('')
      await fetchRemaining()
    } else {
      setStatus('失敗: ' + (j.error || j.message || ''))
    }
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white py-16 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8">
            <h2 className="text-3xl font-bold mb-2 text-center text-slate-900">コインを贈る</h2>
            <p className="text-center text-gray-600 mb-2">感謝のメッセージと一緒にコインを贈呈します</p>
            
            {remaining !== null && (
              <div className="text-center mb-6">
                <div className="inline-block bg-teal-50 border border-teal-200 rounded-lg px-6 py-3">
                  <span className="text-sm text-gray-600">今週の残コイン: </span>
                  <span className="text-2xl font-bold text-teal-600">{remaining}</span>
                  <span className="text-sm text-gray-600"> / 250</span>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">贈呈先</label>
                <select 
                  className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-blue-500 transition" 
                  value={receiverId} 
                  onChange={(e) => setReceiverId(e.target.value)}
                  required
                >
                  <option value="">選択してください</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  コイン数（1～{remaining !== null ? Math.min(remaining, 300) : 300}）
                </label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min={1} 
                    max={remaining !== null ? Math.min(remaining, 300) : 300} 
                    value={Math.min(coins, remaining !== null ? remaining : 300)} 
                    onChange={(e) => setCoins(Number(e.target.value))} 
                    className="flex-1 accent-teal-600"
                  />
                  <span className={`text-2xl font-bold min-w-20 text-right ${
                    remaining !== null && coins > remaining ? 'text-red-600' : 'text-teal-600'
                  }`}>{coins}</span>
                </div>
                {remaining !== null && coins > remaining && (
                  <p className="text-sm text-red-600 mt-2">残コインを超えています</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">メッセージ（最大100字）</label>
                <textarea 
                  maxLength={100} 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-blue-500 transition h-24"
                  placeholder="感謝のメッセージを入力..."
                />
                <p className="text-xs text-gray-500 mt-1">{message.length}/100</p>
              </div>

              <button 
                type="submit"
                disabled={remaining !== null && coins > remaining}
                className="w-full bg-teal-600 text-white px-4 py-3 rounded-md font-bold hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                贈呈する
              </button>
            </form>

            {status && (
              <div className={`mt-6 p-4 rounded-md font-semibold ${
                status.includes('失敗') || status.includes('ログイン')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : status.includes('贈呈中')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {status}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
