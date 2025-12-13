import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'

type RankRow = { name: string; department: string; total_received: number; total_sent: number }

export default function RankingPage() {
  const [overallReceived, setOverallReceived] = useState<RankRow[]>([])
  const [overallSent, setOverallSent] = useState<RankRow[]>([])
  const [byDept, setByDept] = useState<Record<string, RankRow[]>>({})
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'received' | 'sent'>('received')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1

    // Use RPC function to get aggregated stats
    const { data, error } = await supabase.rpc('aggregate_monthly_stats', { year_in: y, month_in: m })
    
    if (error) {
      console.error('aggregate_monthly_stats error:', error)
      setLoading(false)
      return
    }

    const stats: RankRow[] = (data || []).map((row: any) => ({
      name: row.name,
      department: row.department,
      total_received: row.total_received || 0,
      total_sent: row.total_sent || 0
    }))

    const filtered = stats.filter(s => s.total_received > 0 || s.total_sent > 0)
    
    const sortedByReceived = [...filtered].sort((a, b) => b.total_received - a.total_received)
    const sortedBySent = [...filtered].sort((a, b) => b.total_sent - a.total_sent)
    
    setOverallReceived(sortedByReceived)
    setOverallSent(sortedBySent)
    
    // Build department rankings
    const deptMap: Record<string, RankRow[]> = {}
    for (const row of filtered) {
      if (!deptMap[row.department]) deptMap[row.department] = []
      deptMap[row.department].push(row)
    }
    for (const dept in deptMap) {
      deptMap[dept].sort((a, b) => b.total_received - a.total_received)
    }
    setByDept(deptMap)
    
    setLoading(false)
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-24 py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white p-8 text-center">
              <h1 className="text-4xl font-bold mb-2">🏆 ランキング</h1>
              <p className="text-teal-100">今月のコイン送受信ランキング</p>
            </div>
            
            <div className="p-8">

            {/* View Mode Switcher */}
            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={() => setViewMode('received')}
                className={`px-6 py-2 rounded-md font-bold transition-all duration-200 hover:scale-105 hover:shadow-md ${
                  viewMode === 'received'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                受取ランキング
              </button>
              <button
                onClick={() => setViewMode('sent')}
                className={`px-6 py-2 rounded-md font-bold transition-all duration-200 hover:scale-105 hover:shadow-md ${
                  viewMode === 'sent'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                贈呈ランキング
              </button>
            </div>

            {loading ? (
              <p className="text-center text-gray-500">読み込み中...</p>
            ) : (
              <div className="space-y-8">
                {/* Overall Ranking */}
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8">
                  <h3 className="text-2xl font-bold mb-6 text-gray-800">
                    {viewMode === 'received' ? '受取' : '贈呈'}ランキング
                  </h3>
                  <div className="space-y-3">
                    {(viewMode === 'received' ? overallReceived : overallSent).map((row, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  '
                    const bgColor = idx < 3 ? 'bg-slate-50' : 'bg-white'
                    return (
                      <div key={idx} className={`${bgColor} border-l-4 ${idx === 0 ? 'border-teal-500' : idx === 1 ? 'border-slate-300' : idx === 2 ? 'border-slate-300' : 'border-slate-200'} rounded p-4 flex items-center justify-between hover:shadow-lg hover:scale-[1.02] transition-all duration-300`}>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold w-8 text-center">{medal}</div>
                          <div>
                            <div className="font-bold text-gray-800">{row.name}</div>
                            <div className="text-sm text-gray-500">{row.department}</div>
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-teal-600">
                          {viewMode === 'received' ? row.total_received : row.total_sent}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Department Rankings */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8">
                <h3 className="text-2xl font-bold mb-6 text-gray-800">
                  部署別{viewMode === 'received' ? '受取' : '贈呈'}ランキング
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(byDept).map(([dept, rows]) => (
                    <div key={dept} className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 hover:shadow-lg transition-all duration-300">
                      <h4 className="text-lg font-bold mb-4 text-gray-800 pb-3 border-b border-slate-200">{dept}</h4>
                      <div className="space-y-2">
                        {rows.map((row, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded transition-all duration-200 hover:scale-105">
                            <div>
                              <div className="font-bold text-gray-800">{row.name}</div>
                            </div>
                            <div className="text-lg font-bold text-teal-600">
                              {viewMode === 'received' ? row.total_received : row.total_sent}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
