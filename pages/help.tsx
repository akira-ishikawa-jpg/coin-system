import { useState } from 'react'
import Header from '../components/Header'

export default function HelpPage() {
  const [openSections, setOpenSections] = useState<string[]>(['getting-started'])
  const [selectedSection, setSelectedSection] = useState('getting-started')

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  const sections = [
    { id: 'getting-started', title: 'はじめに', icon: '🚀' },
    { id: 'login', title: 'ログイン方法', icon: '🔐' },
    { id: 'send-coins', title: 'コイン送信', icon: '💰' },
    { id: 'history', title: '履歴・トレンド', icon: '📊' },
    { id: 'notifications', title: '通知設定', icon: '🔔' },
    { id: 'ranking', title: 'ランキング', icon: '🏆' },
    { id: 'admin', title: '管理者機能', icon: '⚙️' },
    { id: 'slack', title: 'Slack連携', icon: '💬' },
    { id: 'faq', title: 'よくある質問', icon: '❓' },
  ]

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'getting-started':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">🚀 はじめに</h2>
            <p className="text-gray-700 mb-4">
              感謝なうへようこそ!このシステムは、社内で感謝やねぎらいの気持ちを形にし、
              チームのエンゲージメントを高めるためのツールです。
            </p>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">主な機能</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>コイン送信:</strong> 仲間に感謝の気持ちを込めてコインを贈れます(週に250枚まで)</li>
              <li><strong>スタンプ機能:</strong> メッセージと一緒にかわいいスタンプを選択可能</li>
              <li><strong>ランキング:</strong> 月間・年間のコイン受取ランキングを閲覧</li>
              <li><strong>いいね機能:</strong> 他の人の感謝メッセージにいいねできます</li>
              <li><strong>データ可視化:</strong> 自分のコイン受取・贈呈の推移をグラフで確認</li>
              <li><strong>Slack連携:</strong> Slackからコインを送信したり通知を受け取れます</li>
              <li><strong>プッシュ通知:</strong> コインを受け取った時にリアルタイムで通知</li>
            </ul>
          </div>
        )

      case 'login':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">🔐 ログイン方法</h2>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">パスワードログイン</h3>
            <ol className="list-decimal pl-6 space-y-2 text-gray-700">
              <li>ログインページにアクセス</li>
              <li>管理者から発行されたメールアドレスとパスワードを入力</li>
              <li>「ログイン」ボタンをクリック</li>
            </ol>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">マジックリンクログイン</h3>
            <ol className="list-decimal pl-6 space-y-2 text-gray-700">
              <li>ログインページで「マジックリンク」タブを選択</li>
              <li>登録済みのメールアドレスを入力</li>
              <li>受信したメールのリンクをクリックして自動ログイン</li>
            </ol>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
              <p className="text-yellow-700">
                <strong>⚠️ 注意:</strong> パスワードを忘れた場合は管理者にお問い合わせください。
              </p>
            </div>
          </div>
        )

      case 'send-coins':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">💰 コイン送信</h2>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">送信手順</h3>
            <ol className="list-decimal pl-6 space-y-2 text-gray-700">
              <li>ヘッダーメニューから「コイン送信」をクリック</li>
              <li>送信先の従業員を検索ボックスから選択</li>
              <li>送信枚数を入力(1-100枚、週に250枚まで送信可能)</li>
              <li>感謝メッセージを入力(必須)</li>
              <li>お好みのスタンプを選択(任意)</li>
              <li>「送信」ボタンをクリック</li>
            </ol>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">制約事項</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>週の送信上限: 250枚</li>
              <li>1回の送信上限: 100枚</li>
              <li>メッセージは必須入力項目です</li>
              <li>自分自身には送信できません</li>
              <li>週初に自動的に残高がリセットされます</li>
            </ul>
            <div className="bg-teal-50 border-l-4 border-teal-400 p-4 mt-6">
              <p className="text-teal-700">
                <strong>💡 ヒント:</strong> 送信完了後、相手に通知が届きます。Slack連携している場合はSlackにも通知されます。
              </p>
            </div>
          </div>
        )

      case 'history':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📊 履歴・トレンド</h2>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">マイページ</h3>
            <p className="text-gray-700 mb-4">
              マイページでは、自分のコイン活動を総合的に確認できます。
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>月間統計:</strong> 今月の受取・贈呈・残高を表示</li>
              <li><strong>月次トレンドグラフ:</strong> 過去6ヶ月のコイン推移を視覚化</li>
              <li><strong>受取履歴:</strong> 受け取ったコインとメッセージを一覧表示</li>
              <li><strong>いいね機能:</strong> お礼のメッセージにいいねを付けられます</li>
            </ul>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">お礼ページ</h3>
            <p className="text-gray-700">
              全社員のコイン送信履歴を時系列で確認できます。他の人の感謝メッセージを見て、
              ポジティブなコミュニケーションを楽しめます。
            </p>
          </div>
        )

      case 'notifications':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">🔔 通知設定</h2>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">プッシュ通知の有効化</h3>
            <ol className="list-decimal pl-6 space-y-2 text-gray-700">
              <li>マイページにアクセス</li>
              <li>「プッシュ通知設定」セクションを探す</li>
              <li>「通知を有効にする」ボタンをクリック</li>
              <li>ブラウザの通知許可ダイアログで「許可」を選択</li>
              <li>テスト通知が表示されたら設定完了</li>
            </ol>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">通知のタイミング</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>コインを受け取った時</li>
              <li>自分のメッセージにいいねが付いた時</li>
              <li>月初の自動配分時</li>
            </ul>
            <div className="bg-teal-50 border-l-4 border-teal-400 p-4 mt-6">
              <p className="text-teal-700">
                <strong>📱 対応ブラウザ:</strong> Chrome, Firefox, Edge, Safari(iOS 16.4以降)
              </p>
            </div>
          </div>
        )

      case 'ranking':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">🏆 ランキング</h2>
            <p className="text-gray-700 mb-4">
              ランキングページでは、コイン受取数に基づいた月間・年間ランキングを確認できます。
            </p>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">ランキングの種類</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>月間ランキング:</strong> 今月受け取ったコイン数でランキング</li>
              <li><strong>年間ランキング:</strong> 今年度の累計コイン数でランキング</li>
              <li><strong>いいねランキング:</strong> 受け取ったいいねの合計数</li>
            </ul>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">表示内容</h3>
            <p className="text-gray-700">
              各ランキングには以下の情報が表示されます:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>順位(トップ3には特別な装飾)</li>
              <li>従業員名</li>
              <li>部署</li>
              <li>コイン数/いいね数</li>
            </ul>
          </div>
        )

      case 'admin':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">⚙️ 管理者機能</h2>
            <p className="text-gray-700 mb-4">
              管理者アカウントでログインすると、システム全体の管理機能にアクセスできます。
            </p>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">統計・ユーザー管理タブ</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>ユーザー追加:</strong> 個別にユーザーを登録(名前、メール、部署、パスワード、Slack ID)</li>
              <li><strong>CSV一括登録:</strong> CSVファイルから複数ユーザーを一括登録</li>
              <li><strong>ユーザー削除:</strong> 不要なアカウントを削除</li>
              <li><strong>CSV出力:</strong> 月次統計をCSVでダウンロード(部署フィルタ、期間指定、最小コイン数フィルタ)</li>
              <li><strong>部署別比較グラフ:</strong> 各部署の平均受取・贈呈コイン数を可視化</li>
            </ul>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">監査ログタブ</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>操作履歴:</strong> すべてのシステム操作を時系列で確認</li>
              <li><strong>異常検知ログ:</strong> 不正な操作や異常なパターンを検出</li>
              <li><strong>フィルタ機能:</strong> アクション種別、ユーザー名で絞り込み</li>
              <li><strong>ページネーション:</strong> 50件ずつ表示(前へ/次へボタン)</li>
            </ul>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">CSV一括登録のフォーマット</h3>
            <div className="bg-slate-100 p-4 rounded my-4">
              <code className="text-sm text-gray-800 font-mono block whitespace-pre">
                {`name,email,department,password,slack_id
山田太郎,yamada@example.com,営業,password123,U01234ABCDE
田中花子,tanaka@example.com,総務,password456,`}
              </code>
            </div>
            <p className="text-gray-600 text-sm mt-2">※slack_idは任意項目です</p>
          </div>
        )

      case 'slack':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">💬 Slack連携</h2>
            <p className="text-gray-700 mb-4">
              SlackアプリをインストールすることでSlackから感謝なうを利用できます。
            </p>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">Slackコマンド</h3>
            <div className="space-y-4">
              <div className="bg-slate-100 p-4 rounded">
                <code className="text-teal-600 font-bold">/coins send @ユーザー名 10 ありがとう!</code>
                <p className="text-gray-600 mt-2">指定したユーザーにコインを送信</p>
              </div>
              <div className="bg-slate-100 p-4 rounded">
                <code className="text-teal-600 font-bold">/coins balance</code>
                <p className="text-gray-600 mt-2">自分の残高を確認</p>
              </div>
              <div className="bg-slate-100 p-4 rounded">
                <code className="text-teal-600 font-bold">/coins ranking</code>
                <p className="text-gray-600 mt-2">月間ランキングを表示</p>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">チャンネル投稿</h3>
            <p className="text-gray-700">
              コインを送信すると、自動的に指定されたSlackチャンネルに投稿されます。
              チームメンバー全員が感謝のメッセージを共有できます。
            </p>
            <h3 className="text-xl font-bold text-gray-800 mt-6 mb-3">いいねボタン</h3>
            <p className="text-gray-700">
              Slack投稿には「👍 いいね」ボタンが付いており、Slack上から直接いいねを付けられます。
            </p>
          </div>
        )

      case 'faq':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">❓ よくある質問</h2>
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Q. 週のコイン上限はいつリセットされますか?</h3>
                <p className="text-gray-700">
                  A. 毎週月曜日の0時(日本時間)に自動的にリセットされ、新たに250枚が配布されます。
                </p>
              </div>
              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Q. 受け取ったコインに有効期限はありますか?</h3>
                <p className="text-gray-700">
                  A. いいえ、受け取ったコインに有効期限はありません。累積されていきます。
                </p>
              </div>
              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Q. コイン送信時にエラーが出ます</h3>
                <p className="text-gray-700">
                  A. 以下をご確認ください:<br/>
                  ・残高は十分にありますか?(週に250枚まで)<br/>
                  ・メッセージを入力していますか?(必須項目です)<br/>
                  ・ネットワーク接続は正常ですか?<br/>
                  問題が解決しない場合は、システム管理者にお問い合わせください。
                </p>
              </div>
              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Q. プッシュ通知が届きません</h3>
                <p className="text-gray-700">
                  A. 以下をご確認ください:<br/>
                  ・マイページで通知を有効にしていますか?<br/>
                  ・ブラウザの通知許可が「許可」になっていますか?<br/>
                  ・対応ブラウザを使用していますか?(Chrome, Firefox, Edge, Safari 16.4+)<br/>
                  ・HTTPSでアクセスしていますか?(本番環境のみ動作)
                </p>
              </div>
              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Q. 管理者権限がほしいのですが?</h3>
                <p className="text-gray-700">
                  A. 管理者権限の付与は既存の管理者のみが実行できます。システム管理者にご連絡ください。
                </p>
              </div>
              <div className="border-b border-slate-200 pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Q. Slack IDはどこで確認できますか?</h3>
                <p className="text-gray-700">
                  A. Slackで自分のプロフィールを開き、「その他」→「メンバーIDをコピー」で確認できます。
                  U01234ABCDEのような形式です。
                </p>
              </div>
              <div className="pb-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Q. 退職した社員のデータはどうなりますか?</h3>
                <p className="text-gray-700">
                  A. 管理者がユーザー削除を実行すると、そのユーザーのアカウントとログインデータが削除されます。
                  ただし、過去の取引履歴は監査のため保持されます。
                </p>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-24 py-16 px-4 overflow-x-hidden">
        <div className="container mx-auto max-w-5xl">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-teal-600 text-white p-8 text-center">
              <h1 className="text-4xl font-bold mb-2">📖 ヘルプ・ユーザーマニュアル</h1>
              <p className="text-teal-100">感謝なうの使い方ガイド</p>
            </div>

            {/* PC Layout: Sidebar + Content */}
            <div className="hidden lg:flex">
              {/* Left Sidebar */}
              <div className="w-80 bg-slate-50 border-r border-slate-200">
                <div className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4">目次</h3>
                  <nav className="space-y-2">
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setSelectedSection(section.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                          selectedSection === section.id 
                            ? 'bg-teal-100 text-teal-800 font-semibold' 
                            : 'text-gray-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xl">{section.icon}</span>
                        <span>{section.title}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
              
              {/* Right Content */}
              <div className="flex-1 p-8 max-h-screen overflow-y-auto">
                {renderSectionContent(selectedSection)}
              </div>
            </div>

            {/* Mobile Layout: Accordion */}
            <div className="lg:hidden p-6">
              <div className="space-y-4">
                {sections.map((section) => {
                  const isOpen = openSections.includes(section.id)
                  return (
                    <div key={section.id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full text-left px-6 py-4 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{section.icon}</span>
                          <span className="font-semibold text-gray-800">{section.title}</span>
                        </div>
                        <span className={`text-xl transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </button>
                      
                      {isOpen && (
                        <div className="p-6 bg-white animate-fade-in">
                          {renderSectionContent(section.id)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">お困りですか?</h3>
            <p className="text-gray-600 mb-4">
              このマニュアルで解決しない問題がある場合は、システム管理者にお問い合わせください。
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
