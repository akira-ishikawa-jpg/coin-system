# Vercel デプロイガイド

## 前提条件
- Vercel アカウント（https://vercel.com で登録）
- GitHub リポジトリ

## デプロイ手順

### 1. GitHub にプッシュ
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/coin-system.git
git push -u origin main
```

### 2. Vercel で リポジトリをインポート
1. https://vercel.com/new にアクセス
2. "Import Project" → GitHub を選択
3. coin-system リポジトリを選択
4. "Import" をクリック

### 3. 環境変数を設定
Vercel のプロジェクト設定で以下を追加：
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase プロジェクト URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase Anon キー
- `SUPABASE_SERVICE_ROLE_KEY` — Service Role Key（デプロイ用スクリプト）
- `SUPABASE_URL` — Supabase URL（バックエンド用）
- `SLACK_BOT_TOKEN` — Slack Bot Token
- `SLACK_SIGNING_SECRET` — Slack Signing Secret
- `TASK_SECRET` — 任意の強い文字列（バッチ実行用）

### 4. Cron Jobs 確認
`vercel.json` に定義済み：
- **毎週月曜 09:00** — `POST /api/tasks/distribute_weekly`（週次250コイン配布）
- **毎月1日 09:00** — `POST /api/tasks/monthly_close`（月次集計）

Vercel Pro 以上で自動実行されます。Free プランの場合は、外部スケジューラー（GitHub Actions, AWS Lambda など）で実行してください。

### 5. デプロイ確認
```
https://coin-system-XXXXX.vercel.app
```

## トラブルシューティング

### Cron Jobs が実行されない
- Vercel Pro プラン を使用しているか確認
- `/api/tasks/*` エンドポイントのログを確認：Vercel ダッシュボード → Logs
- `X-TASK-SECRET` ヘッダを確認

### Supabase 接続エラー
- 環境変数が正しく設定されているか確認
- Supabase プロジェクトの RLS ポリシーを確認
- Service Role Key の権限を確認

### Slack 連携が機能しない
- Slack App の Request URL を Vercel の本番 URL に更新：
  `https://coin-system-XXXXX.vercel.app/api/slack/thanks`
- Signing Secret が正しくコピーされているか確認
- Slack Bot の権限（scopes）を確認
