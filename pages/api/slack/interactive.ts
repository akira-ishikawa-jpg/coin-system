import { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { supabase } from '../../../lib/supabaseClient'

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || ''
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || ''

// Slackリクエストの検証
function verifySlackRequest(timestamp: string, signature: string, body: string): boolean {
  if (!timestamp || !signature) return false
  
  const time = Math.floor(Date.now() / 1000)
  if (Math.abs(time - parseInt(timestamp)) > 300) return false
  
  const sigBasestring = `v0:${timestamp}:${body}`
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring, 'utf8')
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(signature, 'utf8')
  )
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const timestamp = req.headers['x-slack-request-timestamp'] as string
  const signature = req.headers['x-slack-signature'] as string
  const rawBody = (req as any).rawBody || new URLSearchParams(req.body).toString()

  // Slack署名検証 (一時的にスキップ)
  // if (!verifySlackRequest(timestamp, signature, rawBody)) {
  //   return res.status(401).json({ error: 'Invalid signature' })
  // }

  try {
    const payload = typeof req.body.payload === 'string' 
      ? JSON.parse(req.body.payload) 
      : req.body.payload

    // URL検証チャレンジ（初回のみ）
    if (payload.type === 'url_verification') {
      return res.status(200).json({ challenge: payload.challenge })
    }

    // モーダル送信処理
    if (payload.type === 'view_submission') {
      const values = payload.view.state.values
      const privateMetadata = JSON.parse(payload.view.private_metadata || '{}')
      
      const receiverId = parseInt(values.receiver.receiver_select.selected_option.value)
      const coins = parseInt(values.coins.coins_input.value)
      const message = values.message.message_input.value

      if (!receiverId || !coins || !message || !message.trim()) {
        return res.status(200).json({
          response_action: 'errors',
          errors: {
            receiver: !receiverId ? 'ユーザーを選択してください' : undefined,
            coins: !coins ? 'コイン数を入力してください' : undefined,
            message: !message || !message.trim() ? 'メッセージを入力してください' : undefined
          }
        })
      }

      if (coins < 1 || coins > 100) {
        return res.status(200).json({
          response_action: 'errors',
          errors: {
            coins: 'コイン数は1〜100の範囲で指定してください'
          }
        })
      }

      const senderId = privateMetadata.sender_id

      // 送信者・受信者の情報を取得
      const { data: sender } = await supabase
        .from('employees')
        .select('id, name, slack_id')
        .eq('id', senderId)
        .single()

      const { data: receiver } = await supabase
        .from('employees')
        .select('id, name, slack_id')
        .eq('id', receiverId)
        .single()

      if (!sender || !receiver) {
        return res.status(200).json({
          response_action: 'errors',
          errors: {
            receiver: 'ユーザー情報が見つかりません'
          }
        })
      }

      // 週の開始日を計算
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
          response_action: 'errors',
          errors: {
            coins: `残コイン不足です。今週の残コイン: ${remaining}`
          }
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
          slack_payload: { from_slack_modal: true }
        })
        .select()
        .single()

      if (insertError || !transaction) {
        return res.status(200).json({
          response_action: 'errors',
          errors: {
            coins: 'コイン送付に失敗しました: ' + (insertError?.message || '')
          }
        })
      }

      // Slackチャンネルに投稿
      const slackMessage = {
        channel: process.env.SLACK_CHANNEL_ID || '',
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
                value: transaction.id.toString()
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

      return res.status(200).json({ ok: true })
    }

    // ボタンクリック処理
    if (payload.type === 'block_actions') {
      const action = payload.actions[0]
      
      if (action.action_id === 'like_transaction') {
        const transactionId = action.value
        const userId = payload.user.id

        // いいねしたユーザーを取得
        const { data: liker } = await supabase
          .from('employees')
          .select('id, name')
          .eq('slack_id', userId)
          .limit(1)
          .maybeSingle()

        if (!liker) {
          return res.status(200).json({
            text: '❌ あなたのSlack IDがシステムに登録されていません'
          })
        }

        // 重複いいねチェック
        const { data: existing } = await supabase
          .from('transaction_likes')
          .select('id')
          .eq('transaction_id', transactionId)
          .eq('employee_id', liker.id)
          .limit(1)
          .maybeSingle()

        if (existing) {
          return res.status(200).json({
            text: '⚠️ すでにいいねしています'
          })
        }

        // いいねを追加
        await supabase
          .from('transaction_likes')
          .insert({
            transaction_id: transactionId,
            employee_id: liker.id
          })

        // 現在のいいね数を取得
        const { count } = await supabase
          .from('transaction_likes')
          .select('*', { count: 'exact', head: true })
          .eq('transaction_id', transactionId)

        // メッセージを更新（いいね数を表示）
        const updatedBlocks = payload.message.blocks.map((block: any) => {
          if (block.block_id === `like_${transactionId}`) {
            return {
              ...block,
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: `👍 いいね (${count || 1})`,
                    emoji: true
                  },
                  action_id: 'like_transaction',
                  value: transactionId
                }
              ]
            }
          }
          return block
        })

        await fetch('https://slack.com/api/chat.update', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channel: payload.channel.id,
            ts: payload.message.ts,
            blocks: updatedBlocks
          })
        })

        return res.status(200).json({
          text: `✅ いいねしました！（合計: ${count || 1}）`
        })
      }
    }

    return res.status(200).json({ ok: true })

  } catch (error: any) {
    console.error('Slack interactive error:', error)
    return res.status(200).json({
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
