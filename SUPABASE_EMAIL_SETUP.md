# Supabaseメールテンプレート設定ガイド

## マジックリンクメールのカスタマイズ

1. **Supabaseダッシュボードにログイン**
   - https://supabase.com にアクセス
   - プロジェクトを選択

2. **認証設定に移動**
   - サイドメニューから「Authentication」→「Settings」をクリック

3. **メールテンプレートを設定**
   - 「Email Templates」セクションを探す
   - 「Magic Link」テンプレートを選択

4. **HTMLテンプレートを適用**
   - `supabase/templates/magic-link.html`の内容をコピー
   - Supabaseの「HTML Template」フィールドに貼り付け
   
5. **件名を設定**
   ```
   【コインシステム】ログインリンクをお送りします
   ```

6. **保存**
   - 「Save」ボタンをクリックして設定を保存

## マジックリンク認証の動作確認

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