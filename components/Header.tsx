import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    loadUserInfo()
  }, [])

  async function loadUserInfo() {
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user?.email) return

      setUserEmail(data.user.email)
      
      const { data: emp } = await supabase
        .from('employees')
        .select('name')
        .eq('email', data.user.email)
        .limit(1)
        .maybeSingle()
      
      if (emp) {
        setUserName(emp.name)
      }
    } catch (error) {
      console.error('ユーザー情報取得エラー:', error)
    }
  }

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="container mx-auto px-4 py-4">
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
              <Link href="/admin" className="hover:text-teal-600 transition font-medium">管理</Link>
              <Link href="/help" className="hover:text-teal-600 transition font-medium">ヘルプ</Link>
            </nav>
            
            {/* ログイン状態表示 */}
            {userName && (
              <div className="flex items-center gap-2 px-3 py-1 bg-teal-50 rounded-md border border-teal-200">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-teal-700">{userName}</span>
              </div>
            )}
          </div>
        </div>

        {/* モバイルメニュー */}
        {isOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-slate-200 pt-4">
            {/* モバイル用ログイン状態表示 */}
            {userName && (
              <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 rounded-md border border-teal-200 mb-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-teal-700">ログイン中: {userName}</span>
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
              <Link 
                href="/mypage" 
                className="text-slate-700 hover:text-teal-600 transition font-medium py-2"
                onClick={() => setIsOpen(false)}
              >
                マイページ
              </Link>
              <Link 
                href="/ranking" 
                className="text-slate-700 hover:text-teal-600 transition font-medium py-2"
                onClick={() => setIsOpen(false)}
              >
                ランキング
              </Link>
              <Link 
                href="/admin" 
                className="text-slate-700 hover:text-teal-600 transition font-medium py-2"
                onClick={() => setIsOpen(false)}
              >
                管理
              </Link>
              <Link 
                href="/help" 
                className="text-slate-700 hover:text-teal-600 transition font-medium py-2"
                onClick={() => setIsOpen(false)}
              >
                ヘルプ
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
