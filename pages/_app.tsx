import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { registerServiceWorker } from '../lib/notifications'

export default function MyApp({ Component, pageProps }: AppProps) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initialize auth state on app load
    const initAuth = async () => {
      await supabase.auth.getSession()
      setLoading(false)
    }
    initAuth()

    // Register Service Worker for push notifications
    if (typeof window !== 'undefined') {
      registerServiceWorker()
    }

    // Subscribe to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      setLoading(false)
    })

    return () => { listener?.subscription?.unsubscribe() }
  }, [])

  if (loading) return <div>Loading...</div>
  return <Component {...pageProps} />
}
