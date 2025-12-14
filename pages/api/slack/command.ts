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

  const { trigger_id, user_id } = req.body

  try {
    // 送信者を確認
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

    // アプリ上の全ユーザー一覧を取得
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name')
      .neq('id', sender.id) // 自分以外
      .order('name')

    if (!employees || employees.length === 0) {
      return res.status(200).json({
        response_type: 'ephemeral',
        text: '❌ 送付可能なユーザーが見つかりません。'
      })
    }

    // ユーザー選択肢を作成（最大100個まで）
    const userOptions = employees.slice(0, 100).map(emp => ({
      text: {
        type: 'plain_text',
        text: emp.name
      },
      value: emp.id.toString()
    }))

    // モーダルを開く
    const modal = {
      type: 'modal',
      title: {
        type: 'plain_text',
        text: '感謝のコインを贈る'
      },
      submit: {
        type: 'plain_text',
        text: '送信'
      },
      close: {
        type: 'plain_text',
        text: 'キャンセル'
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*感謝のメッセージとコインを贈りましょう！*'
          }
        },
        {
          type: 'input',
          block_id: 'receiver',
          element: {
            type: 'static_select',
            placeholder: {
              type: 'plain_text',
              text: '贈る相手を選択してください'
            },
            options: userOptions,
            action_id: 'receiver_select'
          },
          label: {
            type: 'plain_text',
            text: '贈る相手'
          }
        },
        {
          type: 'input',
          block_id: 'coins',
          element: {
            type: 'number_input',
            is_decimal_allowed: false,
            min_value: '1',
            max_value: '100',
            initial_value: '10',
            action_id: 'coins_input'
          },
          label: {
            type: 'plain_text',
            text: 'コイン数 (1-100)'
          }
        },
        {
          type: 'input',
          block_id: 'message',
          element: {
            type: 'plain_text_input',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'いつもありがとうございます！'
            },
            action_id: 'message_input'
          },
          label: {
            type: 'plain_text',
            text: '感謝のメッセージ'
          }
        }
      ],
      private_metadata: JSON.stringify({ sender_id: sender.id })
    }

    const modalResponse = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trigger_id: trigger_id,
        view: modal
      })
    })

    const modalResult = await modalResponse.json()
    
    if (!modalResult.ok) {
      console.error('Modal open failed:', modalResult)
      return res.status(200).json({
        response_type: 'ephemeral',
        text: '❌ モーダルを開けませんでした。もう一度お試しください。'
      })
    }

    return res.status(200).json({ ok: true })

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
