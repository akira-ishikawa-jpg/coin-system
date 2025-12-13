import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function AuthMiddleware({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession()
      const hasSession = !!data?.session
      setIsAuthenticated(hasSession)
      
      // Allow access only to login, auth callback, and auth-related pages
      const allowedPaths = ['/login', '/auth/callback']
      const isAllowedPath = allowedPaths.some(path => router.pathname.startsWith(path))
      
      if (!hasSession && !isAllowedPath) {
        router.push('/login')
      }
    }
    checkAuth()

    // Subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false)
        router.push('/login')
      } else if (event === 'SIGNED_IN') {
        setIsAuthenticated(true)
      }
    })

    return () => { listener?.subscription?.unsubscribe() }
  }, [router])

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return <>{children}</>
}
