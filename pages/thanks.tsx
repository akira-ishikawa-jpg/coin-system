import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'
import Avatar from '../components/Avatar'

type Transaction = {
  id: string
  sender_id: string
  sender_name: string
  receiver_name: string
  sender_department: string
  receiver_department: string
  sender_slack_id?: string
  receiver_slack_id?: string
  coins: number
  message: string
  emoji?: string
  created_at: string
  likes_count: number
  user_has_liked: boolean
  receiver_id: string
  like_users?: { name: string, slack_id?: string, employee_id: string }[]
  value_tags?: string[]
}

export default function ThanksPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  // ページング・フィルタ用
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50
  const [totalCount, setTotalCount] = useState(0)
  const [showOnlyMine, setShowOnlyMine] = useState<boolean>(false)
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [departments, setDepartments] = useState<string[]>([])

  useEffect(() => {
    load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, showOnlyMine])

  async function load(pageNum = 1) {
    setLoading(true)
    // Get current user
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data: emp } = await supabase.from('employees').select('id').eq('email', userData.user.email).limit(1).maybeSingle()
    if (!emp) return
      const PAGE_SIZE = 50
    setCurrentUserId(emp.id)

    // Get all transactions with sender/receiver names, departments and like counts
    // フィルタ条件
    let baseQuery = supabase
      .from('coin_transactions')
        .select('id, coins, message, emoji, created_at, sender_id, sender:sender_id(name, department, slack_id), receiver:receiver_id(name, department, slack_id), receiver_id, value_tags', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (showOnlyMine && emp.id) {
      baseQuery = baseQuery.eq('receiver_id', emp.id)
    }
    // 部署フィルタはフロント側でfilterする（Supabaseのor+リレーションは非対応のため）

    // 件数取得＆データ取得（1リクエストで）
    const from = (pageNum - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data: txns, count } = await baseQuery.range(from, to)
    setTotalCount(count || 0)
    if (!txns) return

    // Get like counts for each transaction
    const txIds = txns.map((t: any) => t.id)

    // いいねした人のslack_id, nameも取得
    const { data: likes } = await supabase
      .from('transaction_likes')
      .select('transaction_id, employee_id, employee:employee_id(name, slack_id)')
      .in('transaction_id', txIds)

    // いいね情報をMap化（count, userLiked, users[]）
    const likesMap: Record<string, { count: number; userLiked: boolean; users: { name: string, slack_id?: string, employee_id: string }[] }> = {}
    txIds.forEach(id => {
      likesMap[id] = { count: 0, userLiked: false, users: [] }
    })

    likes?.forEach((like: any) => {
      if (!likesMap[like.transaction_id]) {
        likesMap[like.transaction_id] = { count: 0, userLiked: false, users: [] }
      }
      likesMap[like.transaction_id].count++
      if (like.employee_id === emp.id) {
        likesMap[like.transaction_id].userLiked = true
      }
      likesMap[like.transaction_id].users.push({
        name: like.employee?.name || '不明',
        slack_id: like.employee?.slack_id,
        employee_id: like.employee_id
      })
    })

    const formatted: Transaction[] & { like_users?: { name: string, slack_id?: string, employee_id: string }[] }[] = txns.map((t: any) => ({
      id: t.id,
      sender_id: t.sender_id,
      sender_name: t.sender?.name || '-',
      receiver_name: t.receiver?.name || '-',
      sender_department: t.sender?.department || '未設定',
      receiver_department: t.receiver?.department || '未設定',
      sender_slack_id: t.sender?.slack_id || undefined,
      receiver_slack_id: t.receiver?.slack_id || undefined,
      coins: t.coins,
      message: t.message || '',
      emoji: t.emoji || '',
      created_at: t.created_at,
      likes_count: likesMap[t.id]?.count || 0,
      user_has_liked: likesMap[t.id]?.userLiked || false,
      receiver_id: t.receiver_id,
      like_users: likesMap[t.id]?.users || [],
      value_tags: Array.isArray(t.value_tags) ? t.value_tags : []
    }))

    // 部署リストもサーバーから取得（初回のみ）
    if (departments.length === 0) {
      const { data: deptRows } = await supabase
        .from('employees')
        .select('department')
      const deptSet = new Set<string>()
      deptRows?.forEach((row: any) => {
        if (row.department) deptSet.add(row.department)
      })
      setDepartments(Array.from(deptSet).sort())
    }
    setTransactions(formatted)
    setLoading(false)
  }




  async function toggleLike(transactionId: string) {
    if (!currentUserId) return

    const tx = transactions.find(t => t.id === transactionId)
    if (!tx) return

    // 楽観的UI更新：即座にローカル状態を更新
    const updatedTransactions = transactions.map((t: Transaction) => {
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

  // 部署フィルタ適用後のリスト
  const filteredTransactions = selectedDepartment === 'all'
    ? transactions
    : transactions.filter(tx =>
        tx.sender_department === selectedDepartment || tx.receiver_department === selectedDepartment
      )

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


            {/* 自分がもらった感謝のみ表示トグル */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
              <div>
                {!loading && departments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-gray-700">部署で絞り込み:</span>
                      <span className="text-sm text-gray-500">({transactions.length}件)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedDepartment('all')}
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
                          onClick={() => setSelectedDepartment(dept)}
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
              </div>
              <div>
                <label className="inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="form-checkbox h-5 w-5 text-teal-600"
                    checked={showOnlyMine}
                    onChange={e => setShowOnlyMine(e.target.checked)}
                  />
                  <span className="ml-2 text-sm font-semibold text-gray-700">自分がもらった感謝のみ表示</span>
                </label>
              </div>
            </div>

            {loading ? (
              <p className="text-center text-gray-500">読み込み中...</p>
            ) : filteredTransactions.length === 0 ? (
              <p className="text-center text-gray-500">まだ感謝が贈られていません</p>
            ) : (
              <>
                <div className="space-y-4">
                  {filteredTransactions.map((tx, index) => (
                    <div 
                      key={tx.id} 
                      className="bg-slate-50 border border-slate-200 rounded-lg p-6 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 animate-slide-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Avatar slackId={tx.sender_slack_id} size={32} />
                            <span className="font-bold text-slate-900">{tx.sender_name}</span>
                            <span className="text-gray-500">→</span>
                            <Avatar slackId={tx.receiver_slack_id} size={32} />
                            <span className="font-bold text-slate-900">{tx.receiver_name}</span>
                            <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-bold">
                              {tx.coins} コイン
                            </span>
                          </div>
                          <p className="text-gray-700 mb-2">
                            {tx.emoji && <span className="text-2xl mr-2">{tx.emoji}</span>}
                            {tx.message}
                          </p>
                          {tx.value_tags && tx.value_tags.length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-1">
                              {tx.value_tags.map((v) => (
                                <span key={v} className="px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-bold border border-teal-200">#{v}</span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-500">
                            {new Date(tx.created_at).toLocaleString('ja-JP')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
                        <button
                          onClick={() => toggleLike(tx.id)}
                          disabled={currentUserId === tx.sender_id}
                          className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-all duration-200 hover:scale-110 active:scale-95 ${
                            tx.user_has_liked
                              ? 'bg-teal-600 text-white hover:bg-teal-700 animate-pulse-once'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          } ${currentUserId === tx.sender_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={currentUserId === tx.sender_id ? '自分の投稿にはいいねできません' : ''}
                        >
                          <span className="text-lg">{tx.user_has_liked ? '❤️' : '🤍'}</span>
                          <span>いいね</span>
                          {tx.likes_count > 0 && <span>({tx.likes_count})</span>}
                        </button>
                        {/* いいねした人のアイコンを横並び表示 */}
                        <div className="flex items-center gap-1 ml-2">
                          {tx.like_users && tx.like_users.map(u => (
                            <span key={u.employee_id} title={u.name} className="group">
                              <Avatar slackId={u.slack_id} size={24} />
                              {/* ツールチップ（モバイル対応） */}
                              <span className="absolute z-50 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 mt-1 ml-2 whitespace-nowrap pointer-events-none shadow-lg">
                                {u.name}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* ページングUI（常時表示） */}
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    className="px-3 py-1 rounded border border-slate-300 bg-slate-100 text-slate-700 disabled:opacity-50"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >前へ</button>
                  {Array.from({ length: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) }, (_, i) => (
                    <button
                      key={i}
                      className={`px-3 py-1 rounded border ${page === i + 1 ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-100 text-slate-700 border-slate-300'}`}
                      onClick={() => setPage(i + 1)}
                    >{i + 1}</button>
                  ))}
                  <button
                    className="px-3 py-1 rounded border border-slate-300 bg-slate-100 text-slate-700 disabled:opacity-50"
                    onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), p + 1))}
                    disabled={page === Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
                  >次へ</button>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
