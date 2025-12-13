import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'

type Transaction = {
  id: string
  sender_name: string
  receiver_name: string
  sender_department: string
  receiver_department: string
  coins: number
  message: string
  emoji?: string
  created_at: string
  likes_count: number
  user_has_liked: boolean
}

export default function ThanksPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    
    // Get current user
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    
    const { data: emp } = await supabase.from('employees').select('id').eq('email', userData.user.email).limit(1).maybeSingle()
    if (!emp) return
    setCurrentUserId(emp.id)

    // Get all transactions with sender/receiver names, departments and like counts
    const { data: txns } = await supabase
      .from('coin_transactions')
      .select(`
        id,
        coins,
        message,
        emoji,
        created_at,
        sender:sender_id(name, department),
        receiver:receiver_id(name, department)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!txns) return

    // Get like counts for each transaction
    const txIds = txns.map((t: any) => t.id)
    const { data: likes } = await supabase
      .from('transaction_likes')
      .select('transaction_id, employee_id')
      .in('transaction_id', txIds)

    const likesMap: Record<string, { count: number; userLiked: boolean }> = {}
    txIds.forEach(id => {
      likesMap[id] = { count: 0, userLiked: false }
    })

    likes?.forEach((like: any) => {
      if (!likesMap[like.transaction_id]) {
        likesMap[like.transaction_id] = { count: 0, userLiked: false }
      }
      likesMap[like.transaction_id].count++
      if (like.employee_id === emp.id) {
        likesMap[like.transaction_id].userLiked = true
      }
    })

    const formatted: Transaction[] = txns.map((t: any) => ({
      id: t.id,
      sender_name: t.sender?.name || '-',
      receiver_name: t.receiver?.name || '-',
      sender_department: t.sender?.department || '未設定',
      receiver_department: t.receiver?.department || '未設定',
      coins: t.coins,
      message: t.message || '',
      emoji: t.emoji || '',
      created_at: t.created_at,
      likes_count: likesMap[t.id]?.count || 0,
      user_has_liked: likesMap[t.id]?.userLiked || false
    }))

    // Extract unique departments
    const deptSet = new Set<string>()
    formatted.forEach(t => {
      if (t.sender_department) deptSet.add(t.sender_department)
      if (t.receiver_department) deptSet.add(t.receiver_department)
    })
    setDepartments(Array.from(deptSet).sort())

    setAllTransactions(formatted)
    setTransactions(formatted)
    setLoading(false)
  }

  function filterByDepartment(dept: string) {
    setSelectedDepartment(dept)
    if (dept === 'all') {
      setTransactions(allTransactions)
    } else {
      const filtered = allTransactions.filter(
        t => t.sender_department === dept || t.receiver_department === dept
      )
      setTransactions(filtered)
    }
  }

  async function toggleLike(transactionId: string) {
    if (!currentUserId) return

    const tx = transactions.find(t => t.id === transactionId)
    if (!tx) return

    // 楽観的UI更新：即座にローカル状態を更新
    const updatedAllTransactions = allTransactions.map(t => {
      if (t.id === transactionId) {
        return {
          ...t,
          user_has_liked: !t.user_has_liked,
          likes_count: t.user_has_liked ? t.likes_count - 1 : t.likes_count + 1
        }
      }
      return t
    })
    setAllTransactions(updatedAllTransactions)

    // フィルターされた表示も更新
    const updatedTransactions = transactions.map(t => {
      if (t.id === transactionId) {
        return {
          ...t,
          user_has_liked: !t.user_has_liked,
          likes_count: t.user_has_liked ? t.likes_count - 1 : t.likes_count + 1
        }
      }
      return t
    })
    setTransactions(updatedTransactions)

    // バックグラウンドでサーバー更新
    try {
      if (tx.user_has_liked) {
        // Unlike
        await supabase
          .from('transaction_likes')
          .delete()
          .eq('transaction_id', transactionId)
          .eq('employee_id', currentUserId)
      } else {
        // Like
        await supabase
          .from('transaction_likes')
          .insert({ transaction_id: transactionId, employee_id: currentUserId })
      }
    } catch (error) {
      // エラー時は元の状態に戻す（全体を再読み込み）
      load()
      console.error('いいね更新エラー:', error)
    }
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-24 py-16 px-4 overflow-x-hidden">
        <div className="container mx-auto max-w-5xl">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white p-8 text-center">
              <h1 className="text-4xl font-bold mb-2">🙏 みんなの感謝</h1>
              <p className="text-teal-100">社内で贈られた感謝のコイン一覧</p>
            </div>
            
            <div className="p-8">

            {/* Department Filter */}
            {!loading && departments.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-gray-700">部署で絞り込み:</span>
                  <span className="text-sm text-gray-500">({transactions.length}件)</span>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => filterByDepartment('all')}
                    className={`px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200 hover:scale-110 active:scale-95 ${
                      selectedDepartment === 'all'
                        ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                    }`}
                  >
                    すべて
                  </button>
                  {departments.map(dept => (
                    <button
                      key={dept}
                      onClick={() => filterByDepartment(dept)}
                      className={`px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200 hover:scale-110 active:scale-95 ${
                        selectedDepartment === dept
                          ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
                          : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-center text-gray-500">読み込み中...</p>
            ) : transactions.length === 0 ? (
              <p className="text-center text-gray-500">まだ感謝が贈られていません</p>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx, index) => (
                  <div 
                    key={tx.id} 
                    className="bg-slate-50 border border-slate-200 rounded-lg p-6 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 animate-slide-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-slate-900">{tx.sender_name}</span>
                          <span className="text-gray-500">→</span>
                          <span className="font-bold text-slate-900">{tx.receiver_name}</span>
                          <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-bold">
                            {tx.coins} コイン
                          </span>
                        </div>
                        <p className="text-gray-700 mb-2">
                          {tx.emoji && <span className="text-2xl mr-2">{tx.emoji}</span>}
                          {tx.message}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.created_at).toLocaleString('ja-JP')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
                      <button
                        onClick={() => toggleLike(tx.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-all duration-200 hover:scale-110 active:scale-95 ${
                          tx.user_has_liked
                            ? 'bg-teal-600 text-white hover:bg-teal-700 animate-pulse-once'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        <span className="text-lg">{tx.user_has_liked ? '❤️' : '🤍'}</span>
                        <span>いいね</span>
                        {tx.likes_count > 0 && <span>({tx.likes_count})</span>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
