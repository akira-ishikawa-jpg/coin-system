# 社員感謝コインシステム（MVP）

このリポジトリは、社員が感謝の気持ちをコインで送り合い、月次の賞与反映用に集計するMVPです。

## 技術スタック
- Next.js 14 (TypeScript)
- Supabase (DB/Auth)
- TailwindCSS
- Slack (Bot / Slash Command)
- Vercel (ホスティング & Cron Jobs)

## 機能概要

### 社員向け
- **メール認証**：マジックリンクでログイン
- **コイン送信**（Web & Slack）：毎週250コイン
- **マイページ**：残コイン、受取合計、履歴表示
- **ランキング**：全体・部署別の月次ランキング

### 管理者向け
- **ダッシュボード**：月次受取集計の可視化
- **CSVエクスポート**：給与計算システムへの連携
- **システム設定**：コイン配布数・給与レート変更
- **監査ログ**：操作履歴

### 自動バッチ処理
- **週次配布**：毎週月曜 9:00 → 全社員に250コイン配布
- **月次集計**：毎月1日 9:00 → 前月分の受取合計を集計

## セットアップ

### 1. 依存関係をインストール
```bash
npm install
npm install --save-dev @types/node @types/react
```

### 2. 環境変数を設定
```bash
cp .env.example .env.local
# .env.local を編集して値を設定：
# - Supabase
SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# - Slack連携
SLACK_BOT_TOKEN=xoxb-xxx...
SLACK_SIGNING_SECRET=xxx...
SLACK_CHANNEL_ID=C01234ABC

# - タスク認証
TASK_SECRET=your-secret-key
```

### 3. Supabase のスキーマを適用
Supabase SQL エディタで `supabase/schema.sql` を実行：
- テーブル作成
- RPC関数（集計、配布）追加

### 4. ダミーデータ投入（テスト用）
```bash
npm run setup:dummy
```

### 5. 開発サーバー起動
```bash
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## 本番環境へのデプロイ

### Vercel へのデプロイ
詳しくは [DEPLOYMENT.md](DEPLOYMENT.md) を参照してください。

簡単な流れ：
1. GitHub にコードをプッシュ
2. Vercel で リポジトリをインポート
3. 環境変数を設定
4. デプロイ完了 — Cron Jobs は自動実行（Vercel Pro プラン必須）

## スクリプト

### ローカル実行
```bash
# ダミーデータ投入
npm run setup:dummy

# 週次コイン配布を手動実行
npm run distribute:weekly

# 月次集計を手動実行
npm run run:monthly
```

### Vercel での自動実行
`vercel.json` で定義済み：
- `POST /api/tasks/distribute_weekly` — 毎週月曜 09:00 実行
- `POST /api/tasks/monthly_close` — 毎月1日 09:00 実行

## データベーススキーマ

| テーブル | 説明 |
|---------|------|
| `employees` | 社員情報（名前、メール、部署、ロール） |
| `coin_transactions` | コインの送受信履歴 |
| `weekly_coins` | 週次配布記録 |
| `monthly_summary` | 月次受取集計（賞与計算用） |
| `audit_logs` | 操作ログ |
| `settings` | システム設定（コイン数、給与レート） |

## セキュリティ

- **認証**：Supabase Auth（メール認証）
- **API**：Bearer トークン検証（Supabase getUser）
- **管理者権限**：`employees.role = 'admin'` の確認
- **Slack**：Signing Secret で署名検証
- **バッチ実行**：`X-TASK-SECRET` ヘッダで保護

## トラブルシューティング

### Slack /thanks が反応しない
- Slack App の Request URL を正しく設定しているか確認
- Bot Token と Signing Secret を確認
- API のログを確認（Vercel/ローカル）

### Cron Jobs が実行されない
- Vercel Pro プラン を使用しているか確認
- 環境変数（`TASK_SECRET`）が正しく設定されているか確認
- Vercel ダッシュボードの Logs を確認

### ログイン時にメール確認が来ない
- Supabase プロジェクトのメール設定を確認
- 迷惑メールフォルダを確認
- Supabase コンソールでメールテンプレートを確認

## よくある質問

**Q: 給与への反映はどうやるのか？**  
A: `monthly_summary` テーブルから毎月CSVをダウンロードし、給与計算システムにインポートしてください。

**Q: ランキングは見た目に反映されるのか？**  
A: 本システムはコイン送受信のみで、人事評価・給与への直接的な反映は管理者が行う想定です。

**Q: スマートフォンから使えるのか？**  
A: TailwindCSS でレスポンシブ対応済みです。

## ライセンス

内部用。詳細は別途。


詳しい仕様・DBスキーマやAPI設計を続けて作成します。