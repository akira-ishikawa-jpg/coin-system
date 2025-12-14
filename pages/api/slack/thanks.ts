import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import querystring from 'querystring'
import { detectAnomalies } from '../../../lib/anomalyDetection'

export const config = { api: { bodyParser: false } }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || ''
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || ''
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function getRawBody(req: NextApiRequest) {
  const chunks: Buffer[] = []
  for await (const chunk of req as any) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

function verifySlackSignature(rawBody: string, headers: any) {
  const timestamp = headers['x-slack-request-timestamp']
  const sig = headers['x-slack-signature']
  if (!timestamp || !sig) return false
  
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (age > 60 * 5) return false
  
  const basestring = `v0:${timestamp}:${rawBody}`
  const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET)
  hmac.update(basestring)
  const expected = `v0=${hmac.digest('hex')}`
  
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
}

// 週の開始日を取得
function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun,1=Mon
  const diff = (day === 0 ? -6 : 1) - day // make Monday the first day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

// Slack APIヘルパー関数
async function sendSlackMessage(userId: string, text: string) {
  try {
    console.log('📤 DM送信 (デバッグ):', { userId, text });
    
    // Slackトークンが無効な場合はログ出力のみ
    if (!SLACK_BOT_TOKEN || SLACK_BOT_TOKEN === 'xoxb-dummy') {
      console.log('⚠️ Slackトークンが無効 - DMスキップ (ログのみ)');
      return Promise.resolve(); // 即座にresolve
    }
    
    // タイムアウト付きでSlack API呼び出し
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒タイムアウト
    
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify({
        channel: userId,
        text: text
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
  } catch (error) {
    console.error('❌ Slack DM送信エラー (続行):', error.message);
    // エラーでも処理を続行
  }
}

async function postToSlack(channelId: string, text: string) {
  try {
    console.log('📣 チャンネル投稿 (デバッグ):', { channelId, text });
    
    // Slackトークンが無効な場合はログ出力のみ
    if (!SLACK_BOT_TOKEN || SLACK_BOT_TOKEN === 'xoxb-dummy') {
      console.log('⚠️ Slackトークンが無効 - チャンネル投稿スキップ (ログのみ)');
      return Promise.resolve(); // 即座にresolve
    }
    
    // タイムアウト付きでSlack API呼び出し
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒タイムアウト
    
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify({
        channel: channelId,
        text: text
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
  } catch (error) {
    console.error('❌ Slackチャンネル投稿エラー (続行):', error.message);
    // エラーでも処理を続行
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🚀 Slack /thanks コマンド開始');
  
  try {
    // 1. 署名検証
    const raw = await getRawBody(req)
    if (!verifySlackSignature(raw, req.headers)) {
      return res.status(401).send('invalid signature')
    }

    // 2. リクエストパース
    const body = querystring.parse(raw)
    const text = (body.text as string) || ''
    const user_id = body.user_id as string
    const user_name = body.user_name as string
    const channel_id = body.channel_id as string

    console.log('📝 リクエスト解析:', { text, user_id, user_name, channel_id });

    // 3. テキスト形式の基本チェック（軽量）
    // パターン1: @名前 数字 メッセージ (名前にスペース/記号を含む)
    let match = text.match(/^@(.+?)\s+(\d+)(?:\s+(.*))?$/);
    
    if (!match) {
      console.log('❌ 形式エラー:', text);
      return res.status(200).json({
        response_type: 'ephemeral',
        text: '❌ 使用法: `/thanks @username コイン数 メッセージ`\n例: `/thanks @田中 10 ありがとうございます！`'
      });
    }

    let [, recipientUsername, coinAmountStr, message] = match;
    
    // ユーザー名から先頭の@を除去（もしあれば）
    recipientUsername = recipientUsername.replace(/^@/, '').trim();
    
    const coinAmount = parseInt(coinAmountStr, 10);

    console.log('🎯 パース結果:', { 
      original: text, 
      recipientUsername: `"${recipientUsername}"`, 
      coinAmount, 
      message: `"${message || ''}"` 
    });

    if (isNaN(coinAmount) || coinAmount <= 0) {
      console.log('❌ コイン数エラー:', coinAmountStr);
      return res.status(200).json({
        response_type: 'ephemeral',
        text: '❌ コイン数は1以上の数字で指定してください。'
      });
    }

    console.log('✅ 基本チェック完了:', { recipientUsername, coinAmount, message });

    // 4. 即座にSlackにレスポンス（3秒以内）
    res.status(200).json({
      response_type: 'in_channel',
      text: '🚀 コイン送信処理を開始しました！処理完了までしばらくお待ちください...'
    });

    console.log('⚡ Slackレスポンス送信完了');

    // 5. 全ての重い処理を完全非同期で実行
    process.nextTick(async () => {
      console.log('🔄 非同期処理開始');
      
      try {
        // 進捗通知: 受取人検索開始
        await sendSlackMessage(user_id, '🔍 ユーザー検索中...');
        
        // 受取人検索（超シンプルテスト版）
        console.log('🔍 受取人検索開始:', recipientUsername);
        await sendSlackMessage(user_id, '📋 検索開始しました');
        
        // テスト：全ユーザーを取得
        try {
          console.log('📋 全ユーザー取得テスト');
          const allUsers = await supabase
            .from('employees')
            .select('id, name, email, slack_id')
            .limit(5);
          
          console.log('📋 全ユーザー結果:', allUsers);
          await sendSlackMessage(user_id, `📋 データベース接続OK: ${allUsers.data?.length || 0}人のユーザー確認`);
        } catch (error) {
          console.error('❌ データベーステストエラー:', error);
          await sendSlackMessage(user_id, '❌ データベース接続失敗');
          return;
        }
        
        // 実際の検索
        let recipients = null;
        
        try {
          console.log('🔍 実際の検索開始');
          const result = await supabase
            .from('employees')
            .select('id, name, email, remaining_coins, slack_id')
            .ilike('name', `%osamu%`);
          
          console.log('🔍 検索結果:', result);
          
          if (result.data && result.data.length > 0) {
            recipients = result.data;
            await sendSlackMessage(user_id, `✅ 検索成功: ${recipients.length}人見つかりました`);
          } else {
            await sendSlackMessage(user_id, '❌ ユーザーが見つかりませんでした');
            return;
          }
        } catch (error) {
          console.error('❌ 検索エラー:', error);
          await sendSlackMessage(user_id, '❌ 検索中にエラーが発生しました');
          return;
        }

        if (!recipients || recipients.length === 0) {
          console.log('❌ 受取人が見つかりません:', recipientUsername);
          await sendSlackMessage(user_id, `❌ ユーザー「${recipientUsername}」が見つかりません。正確な名前を指定してください。`);
          return;
        }

        if (recipients.length > 1) {
          console.log('⚠️ 複数のユーザーが見つかりました:', recipients.map(r => r.name));
          const names = recipients.map(r => r.name).join(', ');
          await sendSlackMessage(user_id, `⚠️ 複数のユーザーが見つかりました: ${names}\nより具体的な名前を指定してください。`);
          return;
        }

        const recipient = recipients[0];
        console.log('✅ 受取人確定:', recipient.name);

        // 進捗通知: 送信者確認
        await sendSlackMessage(user_id, `✅ 受取人確定: ${recipient.name}\n🔍 送信者アカウント確認中...`);

        // 送信者をSlack IDで検索
        console.log('🔍 送信者検索:', user_id);
        const { data: senders, error: senderError } = await supabase
          .from('employees')
          .select('id, name, remaining_coins, bonus_coins')
          .eq('slack_id', user_id);

        if (senderError) {
          console.error('❌ 送信者検索エラー:', senderError);
          await sendSlackMessage(user_id, `❌ データベースエラーが発生しました。\nエラー詳細: ${senderError.message}`);
          return;
        }

        if (!senders || senders.length === 0) {
          console.log('❌ 送信者が見つかりません:', user_id);
          await sendSlackMessage(user_id, '❌ あなたのアカウントが見つかりません。管理者にSlack IDの設定を依頼してください。');
          return;
        }

        const sender = senders[0];
        console.log('✅ 送信者確定:', sender.name);

        // コイン残高確認（通常コイン + ボーナスコイン）
        const totalAvailableCoins = (sender.remaining_coins || 0) + (sender.bonus_coins || 0);
        console.log('💰 利用可能コイン:', totalAvailableCoins, '(通常:', sender.remaining_coins, '+ ボーナス:', sender.bonus_coins, ')');

        if (totalAvailableCoins < coinAmount) {
          console.log('❌ コイン不足');
          await sendSlackMessage(user_id, `❌ 送信コイン数が不足しています。\n必要: ${coinAmount}コイン\n利用可能: ${totalAvailableCoins}コイン`);
          return;
        }

        // 進捗通知: 取引実行
        await sendSlackMessage(user_id, `💸 コイン送信実行中... (${coinAmount}コイン → ${recipient.name})`);

        // 取引記録
        console.log('💸 取引記録開始');
        const { error: transactionError } = await supabase
          .from('coin_transactions')
          .insert({
            sender_id: sender.id,
            recipient_id: recipient.id,
            amount: coinAmount,
            message: message || '',
            is_monthly: false
          });

        if (transactionError) {
          console.error('❌ 取引記録エラー:', transactionError);
          await sendSlackMessage(user_id, `❌ コイン送信に失敗しました。\nエラー詳細: ${transactionError.message}\n再度お試しください。`);
          return;
        }

        console.log('✅ 取引記録完了');

        // コイン残高更新（ボーナスコイン優先消費）
        let remainingAmount = coinAmount;
        let newBonusCoins = sender.bonus_coins || 0;
        let newRemainingCoins = sender.remaining_coins || 0;

        if (newBonusCoins >= remainingAmount) {
          newBonusCoins -= remainingAmount;
        } else {
          remainingAmount -= newBonusCoins;
          newBonusCoins = 0;
          newRemainingCoins -= remainingAmount;
        }

        console.log('💰 残高更新:', { newRemainingCoins, newBonusCoins });

        // 送信者の残高更新
        await supabase
          .from('employees')
          .update({
            remaining_coins: newRemainingCoins,
            bonus_coins: newBonusCoins
          })
          .eq('id', sender.id);

        // 受取人の残高更新
        await supabase
          .from('employees')
          .update({
            remaining_coins: (recipient.remaining_coins || 0) + coinAmount
          })
          .eq('id', recipient.id);

        console.log('✅ 残高更新完了');

        // 成功通知
        const channelMessage = `🎉 *${sender.name}* さんが *${recipient.name}* さんに **${coinAmount}コイン** を送りました！\n💬 ${message || ''}`;
        const dmMessage = `✅ ${recipient.name}さんに${coinAmount}コインを送信しました！\n残りコイン: ${newRemainingCoins + newBonusCoins}コイン`;

        await Promise.all([
          postToSlack(SLACK_CHANNEL_ID || channel_id, channelMessage),
          sendSlackMessage(user_id, dmMessage)
        ]);

        console.log('✅ 通知送信完了');

        // 異常検知（エラーでも処理は停止しない）
        try {
          console.log('🔍 異常検知開始');
          const weekStart = getWeekStart();
          await detectAnomalies(sender.id, recipient.id, coinAmount, weekStart);
          console.log('✅ 異常検知完了');
        } catch (anomalyError) {
          console.error('❌ 異常検知エラー（処理継続）:', anomalyError);
        }

        console.log('🎯 全処理完了');

      } catch (error) {
        console.error('❌ 非同期処理エラー:', error);
        try {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー';
          await sendSlackMessage(user_id, `❌ 処理中にエラーが発生しました。\nエラー詳細: ${errorMessage}\n管理者にお問い合わせください。`);
        } catch (notificationError) {
          console.error('❌ エラー通知送信失敗:', notificationError);
        }
      }
    });

  } catch (error) {
    console.error('❌ 初期処理エラー:', error);
    
    if (!res.headersSent) {
      res.status(200).json({
        response_type: 'ephemeral',
        text: '❌ 処理中にエラーが発生しました。'
      });
    }
  }
}