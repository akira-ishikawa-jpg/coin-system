import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      // URLからトークンを取得
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        // セッションを設定
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (error) {
          console.error('認証エラー:', error)
          router.push('/login?error=auth_failed')
        } else {
          // 認証成功 → コインを贈るページへ
          router.push('/send')
        }
      } else {
        // トークンがない場合はログインページへ
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
