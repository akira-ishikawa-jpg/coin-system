import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabaseClient'

type Setting = { key: string; value: string }

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [unauth, setUnauth] = useState(false)
  const [loading, setLoading] = useState(false)
  const [changed, setChanged] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const sessionRes = await supabase.auth.getSession()
    const user = (sessionRes as any)?.data?.session?.user
    if (!user) { setUnauth(true); setLoading(false); return }

    const { data: emp } = await supabase.from('employees').select('id,role').eq('email', user.email).limit(1).maybeSingle()
    if (!emp || emp.role !== 'admin') { setUnauth(true); setLoading(false); return }

    const { data } = await supabase.from('settings').select('*')
    setSettings((data as any) || [])
    setLoading(false)
  }

  async function handleUpdate() {
    const updates = Object.keys(changed).map(k => ({ key: k, value: changed[k] }))
    if (updates.length === 0) { setMessage('変更がありません'); return }

    for (const upd of updates) {
      const { error } = await supabase.from('settings').upsert(upd)
      if (error) { setMessage('更新失敗: ' + error.message); return }
    }
    setMessage('設定を更新しました')
    setChanged({})
    load()
  }

  if (unauth) return (
    <div>
      <Header />
      <main className="container mx-auto p-6">権限がありません</main>
    </div>
  )

  return (
    <div>
      <Header />
      <main className="container mx-auto p-6">
        <h2 className="text-xl font-bold mb-4">システム設定</h2>
        {loading ? <p>読み込み中...</p> : (
          <div className="space-y-4 max-w-md">
            {settings.map(s => (
              <div key={s.key} className="border rounded p-3">
                <label className="block text-sm font-bold mb-1">{s.key}</label>
                <input
                  type="text"
                  value={changed[s.key] !== undefined ? changed[s.key] : s.value}
                  onChange={(e) => setChanged({ ...changed, [s.key]: e.target.value })}
                  className="w-full border p-2 rounded"
                />
              </div>
            ))}
            <button onClick={handleUpdate} className="bg-blue-600 text-white px-4 py-2 rounded">保存</button>
          </div>
        )}
        {message && <p className="mt-4">{message}</p>}
      </main>
    </div>
  )
}
