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
  const rawBody = (req as any).rawBody || JSON.stringify(req.body)

  // Slack署名検証
  if (!verifySlackRequest(timestamp, signature, rawBody)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  try {
    const payload = typeof req.body.payload === 'string' 
      ? JSON.parse(req.body.payload) 
      : req.body.payload

    // URL検証チャレンジ（初回のみ）
    if (payload.type === 'url_verification') {
      return res.status(200).json({ challenge: payload.challenge })
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
