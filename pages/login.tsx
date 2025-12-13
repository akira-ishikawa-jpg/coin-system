import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import Header from '../components/Header'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginMode, setLoginMode] = useState<'magic' | 'password'>('password')
  const router = useRouter()

  async function handleMagicLinkLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) setMessage('送信に失敗しました: ' + error.message)
    else setMessage('✅ ログインリンク（マジックリンク）を送信しました。メールを確認してください。')
    setLoading(false)
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ 
      email,
      password
    })
    if (error) {
      setMessage('ログインに失敗しました: ' + error.message)
      setLoading(false)
    } else {
      setMessage('✅ ログインしました')
      router.push('/send')
    }
  }

  return (
    <>
      <div className="min-h-screen bg-white py-16 px-4">
        <div className="container mx-auto max-w-md">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8">
            <h2 className="text-3xl font-bold mb-2 text-center text-slate-900">ログイン</h2>
            
            {/* Login Mode Toggle */}
            <div className="flex justify-center gap-2 mb-6">
              <button
                type="button"
                onClick={() => setLoginMode('password')}
                className={`px-4 py-2 rounded-md font-semibold text-sm transition ${
                  loginMode === 'password'
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                パスワード
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('magic')}
                className={`px-4 py-2 rounded-md font-semibold text-sm transition ${
                  loginMode === 'magic'
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                マジックリンク
              </button>
            </div>

            {loginMode === 'password' ? (
              <>
                <p className="text-center text-gray-600 mb-6">メールアドレスとパスワードでログイン</p>
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">メールアドレス</label>
                    <input 
                      type="email"
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500 transition" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">パスワード</label>
                    <input 
                      type="password"
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500 transition" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="パスワードを入力"
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-teal-600 text-white px-4 py-3 rounded-md font-bold hover:bg-teal-700 transition disabled:opacity-50" 
                    disabled={loading}
                  >
                    {loading ? 'ログイン中...' : 'ログイン'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="text-center text-gray-600 mb-6">メールアドレスにログインリンクを送信します</p>
                <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">メールアドレス</label>
                    <input 
                      type="email"
                      className="w-full border border-slate-300 p-3 rounded-md focus:outline-none focus:border-teal-500 transition" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-teal-600 text-white px-4 py-3 rounded-md font-bold hover:bg-teal-700 transition disabled:opacity-50" 
                    disabled={loading}
                  >
                    {loading ? '送信中...' : 'ログインリンクを送信'}
                  </button>
                </form>
              </>
            )}
            
            {message && (
              <div className={`mt-4 p-4 rounded-md text-sm ${message.includes('失敗') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
