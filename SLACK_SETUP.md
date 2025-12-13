# Slack連携セットアップガイド

## 1. Slack Appの作成

1. https://api.slack.com/apps にアクセス
2. 「Create New App」をクリック
3. 「From scratch」を選択
4. App Name: `感謝なう` / Workspace: あなたのワークスペースを選択
5. 「Create App」をクリック

## 2. Bot Token Scopesの設定

1. 左メニューの「OAuth & Permissions」をクリック
2. 「Scopes」セクションまでスクロール
3. 「Bot Token Scopes」に以下を追加:
   - `chat:write` - メッセージ投稿
   - `chat:write.public` - 公開チャンネルへの投稿
   - `im:write` - DMの送信
   - `users:read` - ユーザー情報の取得
   - `reactions:write` - リアクションの追加
   - `commands` - Slash Commandの使用

## 3. Slash Commandの設定

1. 左メニューの「Slash Commands」をクリック
2. 「Create New Command」をクリック
3. 以下を入力:
   - Command: `/thanks`
   - Request URL: `https://coin-system-nine.vercel.app/api/slack/command`
   - Short Description: `感謝のコインを贈る`
   - Usage Hint: `@ユーザー名 10 ありがとうございます！`
4. 「Save」をクリック

## 4. Interactive Componentsの設定

1. 左メニューの「Interactivity & Shortcuts」をクリック
2. 「Interactivity」をONにする
3. Request URL: `https://coin-system-nine.vercel.app/api/slack/interactive`
4. 「Save Changes」をクリック

## 5. Event Subscriptionsの設定（オプション）

1. 左メニューの「Event Subscriptions」をクリック
2. 「Enable Events」をONにする
3. Request URL: `https://coin-system-nine.vercel.app/api/slack/events`
4. 「Subscribe to bot events」で以下を追加:
   - `reaction_added` - リアクション追加イベント
5. 「Save Changes」をクリック

## 6. Bot Tokenの取得

1. 左メニューの「OAuth & Permissions」をクリック
2. 「Install to Workspace」をクリック
3. 「許可する」をクリック
4. **Bot User OAuth Token**（`xoxb-`で始まる）をコピー

## 7. Signing Secretの取得

1. 左メニューの「Basic Information」をクリック
2. 「App Credentials」セクションの「Signing Secret」を表示してコピー

## 8. 環境変数の設定

### ローカル開発（.env.local）
```
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_CHANNEL_ID=C0123456789
```

### Vercel本番環境
1. Vercelダッシュボード → プロジェクト → Settings → Environment Variables
2. 以下の3つを追加:
   - `SLACK_BOT_TOKEN`: Bot User OAuth Token
   - `SLACK_SIGNING_SECRET`: Signing Secret
   - `SLACK_CHANNEL_ID`: 投稿先チャンネルID（例: `C0123456789`）

### チャンネルIDの確認方法
1. Slackアプリを開く
2. 投稿したいチャンネルを右クリック
3. 「リンクをコピー」
4. URLの最後の部分がチャンネルID（例: `https://app.slack.com/client/T.../C0123456789`）

## 9. ワークスペースへのインストール

1. 左メニューの「Install App」をクリック
2. 「Reinstall to Workspace」をクリック（既にインストール済みの場合）
3. Slackで `/thanks` コマンドが使えることを確認

## 10. Slack IDの紐付け

管理画面からユーザーを追加する際に、Slack IDを設定してください。

### Slack IDの確認方法
1. Slackでユーザーのプロフィールを開く
2. 「...」→「プロフィールをコピー」
3. メモ帳に貼り付けるとIDが表示される（`U0123456789`形式）

または、`/thanks @ユーザー名 10 テスト` を実行すると、エラーメッセージにSlack IDが表示されます。

## トラブルシューティング

### コマンドが反応しない
- Request URLが正しいか確認
- Vercelのデプロイが完了しているか確認
- Slash Commandが保存されているか確認

### ボタンが動かない
- Interactive ComponentsのRequest URLが正しいか確認
- Signing Secretが正しく設定されているか確認

### DMが送信されない
- `im:write` スコープが追加されているか確認
- Bot Tokenが正しく設定されているか確認

## 完了チェックリスト

- [ ] Slack App作成完了
- [ ] Bot Token Scopes設定完了
- [ ] Slash Command設定完了
- [ ] Interactive Components設定完了
- [ ] Bot Token取得完了
- [ ] Signing Secret取得完了
- [ ] 環境変数設定完了（Vercel）
- [ ] ワークスペースにインストール完了
- [ ] テストコマンド実行成功
