# Slack連携セットアップ手順（新仕様）

## 概要
新しいSlack連携では、Slackコマンドでモーダル（ダイアログ）を開き、その中でコインを送付します。Slack上のユーザー情報とアプリ上のユーザー情報の紐づけは不要で、実装が簡素化されています。

## 1) Slack App 作成
- https://api.slack.com/apps でアプリを作成
- **OAuth & Permissions** で以下のスコープを追加:
  - Bot Token Scopes: `chat:write`, `commands`, `im:write`, `users:read`, `views:open`
- **Slash Commands** で `/thanks` コマンドを追加:
  - Request URL: `https://<your-app>/api/slack/command`
- **Interactivity & Shortcuts** を有効化:
  - Request URL: `https://<your-app>/api/slack/interactive`

## 2) 環境変数設定
```
SLACK_BOT_TOKEN=xoxb-...（Bot User OAuth Token）
SLACK_SIGNING_SECRET=...（Signing Secret）
SLACK_CHANNEL_ID=...（感謝投稿を流すチャンネルID）
```

## 3) 使い方
1. Slackで `/thanks` コマンドを実行
2. モーダル（ダイアログ）が開く
3. モーダル内で以下を選択・入力:
   - **贈る相手**: アプリ上のユーザー一覧から選択
   - **コイン数**: 1-100の範囲で入力
   - **感謝のメッセージ**: 自由入力
4. 送信ボタンを押す

## 4) 機能
- ✅ Slackコマンドでモーダルを開く
- ✅ モーダル内でアプリ上のユーザー一覧から選択
- ✅ コイン送付の処理
- ✅ Slackの指定チャンネルに感謝投稿
- ✅ Webアプリからの感謝投稿もSlackチャンネルに投稿
- ✅ Slackチャンネル上でいいねボタン機能
- ✅ 受信者へのDM通知

## 5) 注意点
- Slackユーザー情報とアプリユーザー情報の紐づけは不要
- 感謝投稿はSlack上・アプリ上問わず指定チャンネルに流れる
- いいね機能はSlackチャンネル上で直接利用可能
- 本APIはサーバー側で `SUPABASE_SERVICE_ROLE_KEY` を使ってDB操作します
