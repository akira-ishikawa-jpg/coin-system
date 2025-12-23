import { useEffect, useState } from 'react'

export default function DarkModeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    // 初期状態: OS設定を反映
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggle = () => {
    setDark((prev) => {
      if (!prev) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      return !prev
    })
  }

  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-50 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2 rounded-full shadow-lg border border-slate-300 dark:border-slate-600 transition-colors"
      aria-label="ダークモード切替"
    >
      {dark ? '🌙 ダーク' : '☀️ ライト'}
    </button>
  )
}
