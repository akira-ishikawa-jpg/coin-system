import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      const { data } = await supabase.auth.getSession()
      
      if (data?.session) {
        // 認証済みユーザーは「コインを贈る」ページへ
        router.push('/send')
      } else {
        // 未認証ユーザーはログインページへ
        router.push('/login')
      }
    }
    
    checkAuthAndRedirect()
  }, [router])

  // ローディング中の表示
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  )
}
