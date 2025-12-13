import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function Header() {
  const router = useRouter()
  
  // ログインページでは何も表示しない
  if (router.pathname === '/login' || router.pathname.startsWith('/auth/')) {
    return null
  }

  const [isOpen, setIsOpen] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // キャッシュされたユーザー情報を確認
    const cachedUserName = sessionStorage.getItem('cached_user_name')
    const cachedUserEmail = sessionStorage.getItem('cached_user_email')
    const cachedUserRole = sessionStorage.getItem('cached_user_role')
    
    if (cachedUserName && cachedUserEmail) {
      setUserName(cachedUserName)
      setUserEmail(cachedUserEmail)
      setUserRole(cachedUserRole)
      setIsLoading(false)
    } else {
      setIsLoading(true)
      loadUserInfo()
    }

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // ログアウト時にキャッシュをクリア
        sessionStorage.removeItem('cached_user_name')
        sessionStorage.removeItem('cached_user_email')
        setUserName(null)
        setUserEmail(null)
        setIsLoading(false)
      } else if (event === 'SIGNED_IN') {
        // ログイン時に情報を再取得
        setIsLoading(true)
        loadUserInfo()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function loadUserInfo() {
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user?.email) {
        setIsLoading(false)
        // キャッシュをクリア
        sessionStorage.removeItem('cached_user_name')
        sessionStorage.removeItem('cached_user_email')
        sessionStorage.removeItem('cached_user_role')
        return
      }

      setUserEmail(data.user.email)
      // キャッシュに保存
      sessionStorage.setItem('cached_user_email', data.user.email)
      
      const { data: emp } = await supabase
        .from('employees')
        .select('name, role')
        .eq('email', data.user.email)
        .limit(1)
        .maybeSingle()
      
      if (emp) {
        setUserName(emp.name)
        setUserRole(emp.role)
        // キャッシュに保存
        sessionStorage.setItem('cached_user_name', emp.name)
        sessionStorage.setItem('cached_user_role', emp.role || 'user')
      }
    } catch (error) {
      console.error('ユーザー情報取得エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <header className="bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-50 shadow-sm">
      <div className="container mx-auto max-w-5xl px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-bold text-slate-900 text-lg tracking-tight">
            感謝なう
          </Link>
          
          {/* ハンバーガーメニューボタン（モバイル） */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-slate-700 hover:text-teal-600 focus:outline-none"
            aria-label="メニュー"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* デスクトップメニュー */}
          <div className="hidden md:flex items-center space-x-6">
            <nav className="flex items-center space-x-6 text-sm text-slate-700">
              <Link href="/send" className="hover:text-teal-600 transition font-medium">コインを贈る</Link>
              <Link href="/thanks" className="hover:text-teal-600 transition font-medium">みんなの感謝</Link>
              <Link href="/mypage" className="hover:text-teal-600 transition font-medium">マイページ</Link>
              <Link href="/ranking" className="hover:text-teal-600 transition font-medium">ランキング</Link>
              {userRole === 'admin' && (
                <Link href="/admin" className="hover:text-teal-600 transition font-medium">管理</Link>
              )}
              <Link href="/help" className="hover:text-teal-600 transition font-medium">ヘルプ</Link>
            </nav>
            
            {/* ログイン状態表示 */}
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-teal-50 rounded-md border border-teal-200 animate-pulse">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                <div className="w-16 h-4 bg-gray-300 rounded"></div>
              </div>
            ) : userName ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-teal-50 rounded-md border border-teal-200">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-teal-700">{userName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-md border border-gray-200">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-500">ゲスト</span>
              </div>
            )}
          </div>
        </div>

        {/* モバイルメニュー */}
        {isOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-slate-200 pt-4">
            {/* モバイル用ログイン状態表示 */}
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 rounded-md border border-teal-200 mb-3 animate-pulse">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                <div className="w-20 h-4 bg-gray-300 rounded"></div>
              </div>
            ) : userName ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 rounded-md border border-teal-200 mb-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-teal-700">ログイン中: {userName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md border border-gray-200 mb-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-500">未ログイン</span>
              </div>
            )}
            
            <nav className="flex flex-col space-y-3">
              <Link 
                href="/send" 
                className="text-slate-700 hover:text-teal-600 transition font-medium py-2"
                onClick={() => setIsOpen(false)}
              >
                コインを贈る
              </Link>
              <Link 
                href="/thanks" 
                className="text-slate-700 hover:text-teal-600 transition font-medium py-2"
                onClick={() => setIsOpen(false)}
              >
                みんなの感謝
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
