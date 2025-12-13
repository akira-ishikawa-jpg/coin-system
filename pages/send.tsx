import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Header from '../components/Header'
import confetti from 'canvas-confetti'

type Employee = { id: string; name: string; slack_id?: string }

export default function SendPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [receiverId, setReceiverId] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [coins, setCoins] = useState<number>(10)
  const [message, setMessage] = useState('')
  const [selectedStamps, setSelectedStamps] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [remaining, setRemaining] = useState<number | null>(null)

  const availableStamps = ['👍', '🎉', '💪', '✨', '🙏', '❤️', '🔥', '⭐', '👏', '🌟']

  useEffect(() => {
    fetchEmployees()
    fetchRemaining()
    
    // Click outside to close dropdown
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.employee-search')) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('id,name').order('name')
    const emps = (data as any) || []
    setEmployees(emps)
    setFilteredEmployees(emps)
  }

  function handleSearchChange(query: string) {
    setSearchQuery(query)
    setReceiverName(query)
    setShowDropdown(true)
    
    if (!query.trim()) {
      setFilteredEmployees(employees)
      setReceiverId('')
      return
    }
    
    const filtered = employees.filter(emp => 
      emp.name.toLowerCase().includes(query.toLowerCase())
    )
    setFilteredEmployees(filtered)
  }

  function selectEmployee(emp: Employee) {
    setReceiverId(emp.id)
    setReceiverName(emp.name)
    setSearchQuery(emp.name)
    setShowDropdown(false)
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
      .not('slack_payload', 'cs', '{"bonus":true}')
    const sentSum = (sent || []).reduce((s:any, r:any) => s + (r.coins||0), 0)

    const { data: setting } = await supabase.from('settings').select('value').eq('key','default_weekly_coins').limit(1).maybeSingle()
    const defaultWeekly = setting ? parseInt(setting.value,10) : 250
    setRemaining(defaultWeekly - sentSum)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // バリデーション
    if (!message.trim()) {
      setStatus('失敗: メッセージは必須です')
      return
    }
    if (coins > 100) {
      setStatus('失敗: 1回の送付上限は100枚です')
      return
    }
    
    setStatus('贈呈中...')
    
    try {
      const sessionRes = await supabase.auth.getSession()
      const token = (sessionRes as any)?.data?.session?.access_token
      if (!token) {
        setStatus('❌ ログインしてください')
        return
      }

      const payload = { 
        receiver_id: receiverId, 
        coins, 
        message,
        emoji: selectedStamps.join('') 
      }

      const res = await fetch('/api/coins/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || j.message || 'サーバーエラー')
      }
      
      setStatus('✅ 贈呈しました！')
      
      // 紙吹雪アニメーション
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4']
      })
      
      setReceiverId('')
      setReceiverName('')
      setSearchQuery('')
      setCoins(10)
      setMessage('')
      setSelectedStamps([])
      await fetchRemaining()
      
      // 3秒後にステータスをクリア
      setTimeout(() => setStatus(''), 3000)
    } catch (error: any) {
      if (error.message === 'Failed to fetch') {
        setStatus('❌ ネットワークエラー: インターネット接続を確認してください')
      } else {
        setStatus('❌ ' + error.message)
      }
    }
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-24 py-16 px-4 overflow-x-hidden">
        <div className="container mx-auto max-w-5xl">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white p-8 text-center">
              <h1 className="text-4xl font-bold mb-2">💰 コインを贈る</h1>
              <p className="text-teal-100">感謝のメッセージと一緒にコインを贈呈します</p>
            </div>
            
            <div className="p-8">
            
            {remaining !== null && (
              <div className="text-center mb-6">
                <div className="inline-block bg-teal-50 border border-teal-200 rounded-lg px-6 py-3 transition-all duration-300 hover:shadow-lg hover:scale-105">
                  <span className="text-sm text-gray-600">今週の残コイン: </span>
                  <span className="text-2xl font-bold text-teal-600">{remaining}</span>
                  <span className="text-sm text-gray-600"> / 250</span>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative employee-search">
                <label className="block text-sm font-semibold text-gray-700 mb-2">贈呈先（検索可能）</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500 transition"
                  placeholder="名前を入力して検索..."
                  autoComplete="off"
                  required
                />
                {showDropdown && filteredEmployees.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => selectEmployee(emp)}
                        className="w-full text-left px-4 py-2 hover:bg-teal-50 transition border-b border-slate-100 last:border-b-0"
                      >
                        {emp.name}
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery && filteredEmployees.length === 0 && (
                  <p className="text-sm text-red-600 mt-2">該当する従業員が見つかりません</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  コイン数（1～100枚、今週の残: {remaining || 0}枚）
                </label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min={1} 
                    max={remaining !== null ? Math.min(remaining, 100) : 100} 
                    value={Math.min(coins, remaining !== null ? Math.min(remaining, 100) : 100)} 
                    onChange={(e) => setCoins(Number(e.target.value))} 
                    className="flex-1 accent-teal-600"
                  />
                  <span className={`text-2xl font-bold min-w-20 text-right ${
                    remaining !== null && coins > remaining ? 'text-red-600' : coins > 100 ? 'text-red-600' : 'text-teal-600'
                  }`}>{coins}</span>
                </div>
                {coins > 100 && (
                  <p className="text-sm text-red-600 mt-2">1回の送付上限は100枚です</p>
                )}
                {remaining !== null && coins > remaining && (
                  <p className="text-sm text-red-600 mt-2">残コインを超えています</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  メッセージ（必須、最大100字）
                </label>
                <textarea 
                  maxLength={100} 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-blue-500 transition h-24"
                  placeholder="感謝のメッセージを入力..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{message.length}/100</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">スタンプ（任意、複数選択可）</label>
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                  {availableStamps.map((stamp) => (
                    <button
                      key={stamp}
                      type="button"
                      onClick={() => {
                        if (selectedStamps.includes(stamp)) {
                          setSelectedStamps(selectedStamps.filter(s => s !== stamp))
                        } else {
                          setSelectedStamps([...selectedStamps, stamp])
                        }
                      }}
                      className={`p-3 text-2xl rounded-md border-2 transition-all duration-200 hover:scale-125 hover:rotate-12 ${
                        selectedStamps.includes(stamp)
                          ? 'border-teal-500 bg-teal-50 scale-110 shadow-md'
                          : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-lg'
                      }`}
                    >
                      {stamp}
                    </button>
                  ))}
                </div>
                {selectedStamps.length > 0 && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-md">
                    <span className="text-sm text-gray-600">選択中: </span>
                    <span className="text-xl">{selectedStamps.join(' ')}</span>
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={(remaining !== null && coins > remaining) || coins > 100 || !message.trim() || !receiverId}
                className="w-full bg-teal-600 text-white px-4 py-3 rounded-md font-bold hover:bg-teal-700 hover:scale-105 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
              >
                贈呈する
              </button>
            </form>

            {status && (
              <div className={`mt-6 p-4 rounded-md font-semibold animate-fade-in ${
                status.includes('失敗') || status.includes('ログイン')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : status.includes('贈呈中')
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {status}
              </div>
            )}            </div>          </div>
        </div>
      </div>
    </>
  )
}
