# Supabaseメールテンプレート設定ガイド

## マジックリンクメールのカスタマイズ手順

### 1. Supabaseダッシュボードにアクセス
- https://supabase.com にログイン
- 対象プロジェクトを選択

### 2. 認証設定に移動
- 左サイドメニューから「Authentication」をクリック
- 「Settings」タブをクリック

### 3. Email Templates設定
- 下にスクロールして「Email Templates」セクションを見つける
- 「Magic Link」をクリックして展開

### 4. テンプレート設定（重要！）

#### 4-1. 件名（Subject）
```
【コインシステム】ログインリンクをお送りします
```

#### 4-2. HTMLテンプレート
- `supabase/templates/magic-link.html`の内容を全てコピー
- 「Body (HTML)」フィールドに貼り付け

#### 4-3. テキストテンプレート 
- `supabase/templates/magic-link.txt`の内容を全てコピー
- 「Body (Text)」フィールドに貼り付け

### 5. 保存
- **「Save」ボタンをクリック**（必須！）
- 設定反映まで数分かかる場合があります

## URL設定の確認

マジックリンクが正常に動作するために、以下の設定も確認してください：

### Site URL設定
- Supabaseダッシュボード → Authentication → URL Configuration
- Site URL: `https://your-app-domain.vercel.app`
- Redirect URLs: `https://your-app-domain.vercel.app/auth/callback`

### 本番環境での設定
```bash
# Vercelの環境変数を確認
vercel env ls

# 必要に応じて以下を設定
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### トラブルシューティング

**問題**: マジックリンクをクリックしてもログインできない
- Site URLとRedirect URLsが正しく設定されているか確認
- ブラウザの開発者ツールでエラーメッセージを確認
- Supabaseのログを確認（Dashboard → Logs）

**問題**: メールが届かない
- Supabaseの使用量制限を確認
- スパムフォルダを確認
- SMTP設定が正しいか確認（カスタムSMTP使用時）