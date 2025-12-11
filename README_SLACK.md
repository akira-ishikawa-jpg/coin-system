Slack連携セットアップ手順

1) Slack App 作成
- https://api.slack.com/apps でアプリを作成
- OAuth & Permissions:
  - Scopes (Bot Token Scopes): `chat:write`, `commands`, `im:write`, `users:read`
- Features -> Slash Commands: `/thanks` を追加
  - Request URL: `https://<your-app>/api/slack/thanks`

2) 環境変数設定
- `SLACK_BOT_TOKEN` (xoxb-...)
- `SLACK_SIGNING_SECRET`

3) Next.js サーバー実行（ローカルで試す場合）
- ngrok等で `https://` の公開URLを用意し、Slash CommandのRequest URLに設定

4) 動作確認
- Slack上で `/thanks @member 10 ありがとう！` を入力し送信
- APIが受け取り、DBに保存 → 受取側にDMが届く

注意: 本APIはサーバー側で `SUPABASE_SERVICE_ROLE_KEY` を使ってDB操作します。トークンは環境変数で安全に管理してください。
