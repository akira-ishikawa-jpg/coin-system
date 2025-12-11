import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function AuthMiddleware({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession()
      // Allow unauthenticated access to login page
      if (!data?.session && !router.pathname.startsWith('/login') && router.pathname === '/') return
    }
    checkAuth()

    // Subscribe to auth changes to keep session fresh
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') router.push('/login')
    })

    return () => { listener?.subscription?.unsubscribe() }
  }, [router])

  return <>{children}</>
}
