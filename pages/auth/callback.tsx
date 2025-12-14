import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabaseが自動的に認証を処理
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('認証エラー:', error)
          router.push('/login?error=auth_failed')
          return
        }

        if (data.session) {
          // 認証成功 → コインを贈るページへ
          router.push('/send')
        } else {
          // セッションがない場合、URLハッシュから認証を試行
          const { data: authData, error: authError } = await supabase.auth.getUser()
          
          if (authError || !authData.user) {
            router.push('/login')
          } else {
            router.push('/send')
          }
        }
      } catch (err) {
        console.error('認証処理エラー:', err)
        router.push('/login')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-xl font-bold text-slate-900 mb-2">認証中...</div>
        <div className="text-gray-600">しばらくお待ちください</div>
      </div>
    </div>
  )
}
