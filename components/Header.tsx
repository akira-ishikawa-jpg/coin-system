import Link from 'next/link'

export default function Header() {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-slate-900 text-lg tracking-tight">
          感謝なう
        </Link>
        <nav className="flex items-center space-x-6 text-sm text-slate-700">
          <Link href="/login" className="hover:text-teal-600 transition font-medium">ログイン</Link>
          <Link href="/send" className="hover:text-teal-600 transition font-medium">コインを贈る</Link>
          <Link href="/thanks" className="hover:text-teal-600 transition font-medium">みんなの感謝</Link>
          <Link href="/mypage" className="hover:text-teal-600 transition font-medium">マイページ</Link>
          <Link href="/ranking" className="hover:text-teal-600 transition font-medium">ランキング</Link>
          <Link href="/admin" className="hover:text-teal-600 transition font-medium">管理</Link>
        </nav>
      </div>
    </header>
  )
}
