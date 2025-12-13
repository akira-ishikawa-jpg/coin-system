import { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { supabase } from '../../../lib/supabaseClient'

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || ''
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || ''
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || ''

// Slackリクエストの検証
function verifySlackRequest(req: NextApiRequest): boolean {
  const timestamp = req.headers['x-slack-request-timestamp'] as string
  const slackSignature = req.headers['x-slack-signature'] as string
  
  if (!timestamp || !slackSignature) return false
  
  // タイムスタンプが5分以上古い場合は拒否
  const time = Math.floor(Date.now() / 1000)
  if (Math.abs(time - parseInt(timestamp)) > 300) return false
  
  const sigBasestring = `v0:${timestamp}:${JSON.stringify(req.body)}`
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring, 'utf8')
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(slackSignature, 'utf8')
  )
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Slack署名検証
  if (!verifySlackRequest(req)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const { text, user_id, user_name } = req.body

  try {
    // コマンドのパース: /thanks @user 10 ありがとう！
    const match = text.match(/<@(U[A-Z0-9]+)\|([^>]+)>\s+(\d+)\s+(.+)/)
    
    if (!match) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: '❌ 使い方: `/thanks @ユーザー名 コイン数 メッセージ`\n例: `/thanks @山田 10 いつもありがとう！`'
      })
    }

    const [, receiverSlackId, receiverName, coinsStr, message] = match
    const coins = parseInt(coinsStr, 10)

    if (coins < 1 || coins > 300) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: '❌ コイン数は1〜300の範囲で指定してください'
      })
    }

    // 送信者を取得
    const { data: sender } = await supabase
      .from('employees')
      .select('id, name')
      .eq('slack_id', user_id)
      .limit(1)
      .maybeSingle()

    if (!sender) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `❌ あなたのSlack ID（${user_id}）がシステムに登録されていません。管理者に連絡してください。`
      })
    }

    // 受信者を取得
    const { data: receiver } = await supabase
      .from('employees')
      .select('id, name, slack_id')
      .eq('slack_id', receiverSlackId)
      .limit(1)
      .maybeSingle()

    if (!receiver) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `❌ ${receiverName}さんのSlack ID（${receiverSlackId}）がシステムに登録されていません。`
      })
    }

    // 今週の開始日を計算
    const getWeekStart = () => {
      const d = new Date()
      const day = d.getDay()
      const diff = (day === 0 ? -6 : 1) - day
      d.setDate(d.getDate() + diff)
      d.setHours(0, 0, 0, 0)
      return d.toISOString().slice(0, 10)
    }

    const weekStart = getWeekStart()
    const weekStartDate = new Date(weekStart + 'T00:00:00.000Z')

    // 今週送ったコイン数を確認
    const { data: sentTx } = await supabase
      .from('coin_transactions')
      .select('coins')
      .eq('sender_id', sender.id)
      .gte('created_at', weekStartDate.toISOString())

    const sentSum = (sentTx || []).reduce((s: any, r: any) => s + (r.coins || 0), 0)

    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'default_weekly_coins')
      .limit(1)
      .maybeSingle()

    const defaultWeekly = setting ? parseInt(setting.value, 10) : 250
    const remaining = defaultWeekly - sentSum

    if (coins > remaining) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `❌ 残コイン不足です。今週の残コイン: ${remaining}`
      })
    }

    // コイン送付を実行
    const { data: transaction, error: insertError } = await supabase
      .from('coin_transactions')
      .insert({
        sender_id: sender.id,
        receiver_id: receiver.id,
        coins,
        message,
        week_start: weekStart,
        slack_payload: { user_id, user_name, channel_id: SLACK_CHANNEL_ID }
      })
      .select()
      .single()

    if (insertError || !transaction) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: '❌ コイン送付に失敗しました: ' + (insertError?.message || '')
      })
    }

    // Slackチャンネルに投稿
    const slackMessage = {
      channel: SLACK_CHANNEL_ID,
      text: `🎉 ${sender.name}さんが${receiver.name}さんに${coins}コインを贈りました！`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎉 *${sender.name}* → *${receiver.name}* へ *${coins}コイン* を贈りました！`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `💬 _${message}_`
          }
        },
        {
          type: 'actions',
          block_id: `like_${transaction.id}`,
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '👍 いいね',
                emoji: true
              },
              action_id: 'like_transaction',
              value: transaction.id
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `<!date^${Math.floor(Date.now() / 1000)}^{date_num} {time}|${new Date().toLocaleString('ja-JP')}>`
            }
          ]
        }
      ]
    }

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    })

    // 受信者にDM通知
    if (receiver.slack_id) {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: receiver.slack_id,
          text: `🎁 ${sender.name}さんから${coins}コインを受け取りました！\n💬 「${message}」\n\n詳細: https://coin-system-nine.vercel.app/thanks`
        })
      })
    }

    return res.status(200).json({
      response_type: 'ephemeral',
      text: `✅ ${receiver.name}さんに${coins}コインを贈りました！（残コイン: ${remaining - coins}）`
    })

  } catch (error: any) {
    console.error('Slack command error:', error)
    return res.status(200).json({
      response_type: 'ephemeral',
      text: '❌ エラーが発生しました: ' + error.message
    })
  }
}

export const config = {
  api: {
    bodyParser: {
      verify: (req: any, res: any, buf: Buffer) => {
        req.rawBody = buf.toString('utf8')
      }
    }
  }
}
