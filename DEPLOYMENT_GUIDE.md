# 🚀 本番環境へのアップロード手順（超わかりやすい版）

## 📝 準備するもの
- パソコン
- インターネット接続
- メールアドレス（無料のGmailでOK）

所要時間：約30分

---

## ステップ1️⃣：データベースの設定（Supabase）

### 1-1. Supabaseにログイン
1. ブラウザで https://supabase.com/dashboard を開く
2. ログインする（メールアドレスとパスワード）

### 1-2. データベースにテーブルを追加
1. 左側のメニューで「SQL Editor」をクリック
2. 「New Query」ボタンをクリック
3. 下の長いコードを**全部コピー**して貼り付ける
4. 右上の「Run」ボタンをクリック
5. 「Success」と表示されたらOK！

```sql
-- いいねテーブルの作成
CREATE TABLE IF NOT EXISTS transaction_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES coin_transactions(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(transaction_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_likes_transaction ON transaction_likes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_likes_employee ON transaction_likes(employee_id);

-- 新しいRPC関数（受取・贈呈・いいね数を集計）
CREATE OR REPLACE FUNCTION aggregate_monthly_stats(year_in int, month_in int)
RETURNS TABLE(employee_id uuid, name text, email text, department text, total_received int, total_sent int, total_likes int) AS $$
  SELECT
    e.id,
    e.name,
    e.email,
    e.department,
    COALESCE(SUM(CASE WHEN ct_recv.receiver_id = e.id THEN ct_recv.coins ELSE 0 END), 0) AS total_received,
    COALESCE(SUM(CASE WHEN ct_sent.sender_id = e.id THEN ct_sent.coins ELSE 0 END), 0) AS total_sent,
    COALESCE((
      SELECT COUNT(*)
      FROM coin_transactions ct_like
      LEFT JOIN transaction_likes tl ON tl.transaction_id = ct_like.id
      WHERE ct_like.receiver_id = e.id
        AND ct_like.created_at >= make_date(year_in, month_in, 1)
        AND ct_like.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
    ), 0) AS total_likes
  FROM employees e
  LEFT JOIN coin_transactions ct_recv
    ON ct_recv.receiver_id = e.id
    AND ct_recv.created_at >= make_date(year_in, month_in, 1)
    AND ct_recv.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
  LEFT JOIN coin_transactions ct_sent
    ON ct_sent.sender_id = e.id
    AND ct_sent.created_at >= make_date(year_in, month_in, 1)
    AND ct_sent.created_at < (make_date(year_in, month_in, 1) + INTERVAL '1 month')
  GROUP BY e.id, e.name, e.email, e.department
  HAVING COALESCE(SUM(CASE WHEN ct_recv.receiver_id = e.id THEN ct_recv.coins ELSE 0 END), 0) > 0
      OR COALESCE(SUM(CASE WHEN ct_sent.sender_id = e.id THEN ct_sent.coins ELSE 0 END), 0) > 0;
$$ LANGUAGE sql STABLE;
```

---

## ステップ2️⃣：GitHubにコードを保存

### 2-1. GitHubアカウントを作る（持ってない人だけ）
1. https://github.com を開く
2. 「Sign up」をクリック
3. メールアドレスを入力して登録
4. メールが届くので、確認コードを入力

### 2-2. 新しいリポジトリを作る
1. https://github.com/new を開く
2. 「Repository name」に `coin-system` と入力
3. 「Private」を選択（公開したくない場合）
4. **他は何もチェックしない**
5. 「Create repository」をクリック

### 2-3. コードをアップロード
ターミナル（Macの場合）またはコマンドプロンプト（Windowsの場合）を開いて、以下を**1行ずつ**コピー＆ペーストして実行：

```bash
cd /Users/ishikawaakira/coin-system
```
↑ これでプロジェクトのフォルダに移動

```bash
git init
```
↑ これでGitを初期化

```bash
git add .
```
↑ これで全てのファイルを準備

```bash
git commit -m "感謝なうシステム 初回アップロード"
```
↑ これで保存の準備完了

```bash
git branch -M main
```
↑ これでメインブランチを作成

```bash
git remote add origin https://github.com/YOUR_USERNAME/coin-system.git
```
↑ **YOUR_USERNAME** を自分のGitHubユーザー名に変更してください！

```bash
git push -u origin main
```
↑ これでGitHubにアップロード完了！

---

## ステップ3️⃣：Vercelで公開する

### 3-1. Vercelアカウントを作る
1. https://vercel.com を開く
2. 「Sign Up」をクリック
3. 「Continue with GitHub」をクリック（GitHubでログイン）
4. 「Authorize Vercel」をクリック

### 3-2. プロジェクトを作る
1. https://vercel.com/new を開く
2. 「Import Git Repository」の下にある検索ボックスに `coin-system` と入力
3. 自分の `coin-system` リポジトリが表示されたら「Import」をクリック

### 3-3. 環境変数を設定（重要！）

「Environment Variables」のセクションで、以下の3つを設定します：

#### 3-3-1. NEXT_PUBLIC_SUPABASE_URL を設定
1. 「Name」に `NEXT_PUBLIC_SUPABASE_URL` と入力
2. 「Value」を取得：
   - Supabaseダッシュボードを開く
   - 左下の「⚙️ Project Settings」をクリック
   - 「API」をクリック
   - 「Project URL」の下にある `https://xxxxx.supabase.co` をコピー
3. コピーした内容を「Value」に貼り付け
4. 「Add」をクリック

#### 3-3-2. NEXT_PUBLIC_SUPABASE_ANON_KEY を設定
1. 「Name」に `NEXT_PUBLIC_SUPABASE_ANON_KEY` と入力
2. 「Value」を取得：
   - 同じSupabaseのAPI画面で
   - 「Project API keys」の「anon」「public」の下にある長い文字列をコピー
3. コピーした内容を「Value」に貼り付け
4. 「Add」をクリック

#### 3-3-3. SUPABASE_SERVICE_ROLE_KEY を設定
1. 「Name」に `SUPABASE_SERVICE_ROLE_KEY` と入力
2. 「Value」を取得：
   - 同じSupabaseのAPI画面で
   - 「service_role」の下にある長い文字列をコピー
   - ⚠️ これは絶対に誰にも見せないでください！
3. コピーした内容を「Value」に貼り付け
4. 「Add」をクリック

### 3-4. デプロイ開始！
1. 3つの環境変数を全て設定したら
2. 一番下の「Deploy」ボタンをクリック
3. 2〜3分待つ
4. 「Congratulations!」と表示されたら完成！🎉

---

## ステップ4️⃣：動作確認

### 4-1. サイトを開く
1. Vercelの画面に表示されている `https://coin-system-xxxxx.vercel.app` のようなURLをクリック
2. ログインページが表示されればOK！

### 4-2. ログインテスト
1. 自分のメールアドレスでログイン
2. メールが届くのでリンクをクリック
3. サイトが開けばOK！

### 4-3. Supabaseの設定を更新（重要！）
ログインできない場合：

1. Supabaseダッシュボードを開く
2. 左側の「Authentication」をクリック
3. 「URL Configuration」をクリック
4. 「Site URL」に Vercelのサイトアドレス（例：`https://coin-system-xxxxx.vercel.app`）を入力
5. 「Redirect URLs」の「Add URL」をクリック
6. `https://coin-system-xxxxx.vercel.app/auth/callback` を追加
7. 「Save」をクリック

---

## 🎉 完成！

これで本番環境にアップロードできました！
VercelのURLを社員に共有すれば、誰でもアクセスできます。

### 📱 URLの確認方法
Vercelのダッシュボード（https://vercel.com）で確認できます。

---

## ❓ トラブルが起きたら

### 😢 ログインできない
**解決方法：**
1. Supabaseダッシュボードを開く
2. 左側の「Authentication」をクリック
3. 「Providers」をクリック
4. 「Email」が緑色（有効）になっているか確認
5. なっていなければクリックして有効化

### 😢 ランキングが表示されない
**解決方法：**
1. ステップ1のSQLをもう一度実行したか確認
2. Supabaseの「SQL Editor」で以下を実行して確認：
```sql
SELECT * FROM aggregate_monthly_stats(2025, 12);
```
3. 結果が表示されればOK

### 😢 管理者ページが「アクセス権限なし」と出る
**解決方法：**
1. Supabaseダッシュボードを開く
2. 左側の「Table Editor」をクリック
3. 「employees」テーブルを選択
4. 自分のメールアドレスの行を探す
5. 「role」列を `admin` に変更
6. 保存

### 😢 Git push でエラーが出る
**解決方法：**
```bash
git config --global user.email "あなたのメール@example.com"
git config --global user.name "あなたの名前"
```
を実行してから、もう一度 `git push` を試す

---

## 🌟 おまけ：独自ドメインを使いたい場合

example.com のような独自ドメインを持っている場合：

1. Vercelのダッシュボードを開く
2. プロジェクトをクリック
3. 上の「Settings」をクリック
4. 左側の「Domains」をクリック
5. ドメイン名を入力して「Add」
6. 画面の指示に従ってDNS設定を変更
7. 数分〜数時間で反映されます

---

## 📞 困ったときは

- Vercelのドキュメント：https://vercel.com/docs
- Supabaseのドキュメント：https://supabase.com/docs
- GitHubのヘルプ：https://docs.github.com

それでも分からなければ、エラーメッセージをコピーして検索してみてください！
