import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import querystring from 'querystring'

export const config = { api: { bodyParser: false } }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || ''
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || ''

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

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun,1=Mon
  const diff = (day === 0 ? -6 : 1) - day // make Monday the first day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const raw = await getRawBody(req)
  if (!verifySlackSignature(raw, req.headers)) {
    res.status(401).send('invalid signature')
    return
  }

  const body = querystring.parse(raw)
  // body.text example: "<@U12345> 50 ありがとう！" or "<@U12345> ありがとう！"
  const text = (body.text as string) || ''
  const user_id = body.user_id as string
  const user_name = body.user_name as string

  // Try pattern with coins first: <@USER_ID> coins message or @username coins message
  let m = text.match(/<@([A-Z0-9]+)>\s+(\d+)\s*(.*)/s) || text.match(/@([a-zA-Z0-9\-_.]+)\s+(\d+)\s*(.*)/s)
  let targetSlackId: string, coins: number, message: string, isUsernameFormat = false
  
  if (m) {
    // Pattern with explicit coins
    targetSlackId = m[1]
    coins = parseInt(m[2], 10)
    message = m[3] || ''
    isUsernameFormat = !targetSlackId.match(/^[A-Z0-9]+$/) // Check if it's a username instead of Slack ID
  } else {
    // Try pattern without coins: <@USER_ID> message or @username message (default to 5 coins)
    m = text.match(/<@([A-Z0-9]+)>\s*(.*)/s) || text.match(/@([a-zA-Z0-9\-_.]+)\s*(.*)/s)
    if (!m) {
      res.setHeader('Content-Type', 'application/json')
      res.status(200).json({ response_type: 'ephemeral', text: `使い方: /thanks @相手 [コイン数] メッセージ\n例: /thanks @田中さん ありがとう！\n例: /thanks @田中さん 10 いつもありがとう！\n\nデバッグ: "${text}"` })
      return
    }
    targetSlackId = m[1]
    coins = 5 // デフォルト5コイン
    message = m[2] || ''
    isUsernameFormat = !targetSlackId.match(/^[A-Z0-9]+$/) // Check if it's a username instead of Slack ID
  }

  // Debug: Log the actual text received and parsed IDs
  await supabase.from('audit_logs').insert({ 
    actor_id: null, 
    action: 'slack_debug', 
    payload: { 
      received_text: text, 
      user_id, 
      user_name,
      parsed_target_slack_id: targetSlackId,
      is_username_format: isUsernameFormat,
      parsed_coins: coins,
      parsed_message: message
    } 
  })

  if (isNaN(coins) || coins <= 0) {
    res.setHeader('Content-Type', 'application/json')
    res.status(200).json({ response_type: 'ephemeral', text: 'コイン数は1以上の数字で指定してください。' })
    return
  }

  // 即座にSlackに成功レスポンスを返す（全ての重い処理前に）
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json({ response_type: 'in_channel', text: `コイン送信処理を開始しました...` })

  // 全ての処理を非同期で実行
  setImmediate(async () => {
    try {
      // find sender and receiver in employees
      const { data: senderData } = await supabase.from('employees').select('id,name,slack_id,email').eq('slack_id', user_id).limit(1).maybeSingle()
      
      let receiverData: any
      if (isUsernameFormat) {
        // Search by username patterns (try different variations)
        const possibleUsernames = [
          targetSlackId.toLowerCase(),
          targetSlackId.replace(/-/g, ''),
          targetSlackId.replace(/_/g, ''),
          targetSlackId.replace(/[._-]/g, '')
        ]
        
        let found = false
        for (const username of possibleUsernames) {
          const { data } = await supabase.from('employees')
            .select('id,name,slack_id,email')
            .or(`email.ilike.%${username}%,name.ilike.%${username}%`)
            .limit(1)
            .maybeSingle()
          
          if (data) {
            receiverData = data
            found = true
            break
          }
        }
        
        if (!found) {
          return
        }
      } else {
        // Search by Slack ID
        const { data } = await supabase.from('employees').select('id,name,slack_id,email').eq('slack_id', targetSlackId).limit(1).maybeSingle()
        receiverData = data
      }

      if (!senderData || !receiverData) {
        return
      }

      // Check weekly remaining coins
      const weekStart = getWeekStart()
      const { data: sentTx } = await supabase.from('coin_transactions').select('coins').eq('sender_id', senderData.id).eq('week_start', weekStart).not('slack_payload', 'cs', '{"bonus":true}')
      const sentSum = (sentTx || []).reduce((s: number, r: any) => s + (r.coins || 0), 0)

      const { data: setting } = await supabase.from('settings').select('value').eq('key', 'default_weekly_coins').limit(1).maybeSingle()
      const defaultWeekly = setting ? parseInt(setting.value, 10) : 250
      const remaining = defaultWeekly - sentSum

      if (coins > remaining) {
        return
      }

      // prepare transaction payload
      const insertPayload = {
        sender_id: senderData.id,
        receiver_id: receiverData.id,
        coins,
        message,
        emoji: '',
        week_start: weekStart,
        slack_payload: { from_slack_user: user_id, raw_text: text }
      }

      // insert transaction
      const { error: insertError } = await supabase.from('coin_transactions').insert(insertPayload)
      if (insertError) {
        return
      }

      // 異常検知を実行
      const { detectAnomalies } = await import('../../../lib/anomalyDetection')
      await detectAnomalies(senderData.id, receiverData.id, coins, weekStart)
    // Send message to channel with like button
    const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || ''
    let messageTs = ''
    
    try {
      if (SLACK_CHANNEL_ID) {
        const channelResponse = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${SLACK_BOT_TOKEN}`
          },
          body: JSON.stringify({
            channel: SLACK_CHANNEL_ID,
            text: `:coin: *${senderData.name}* → *${receiverData.name}* (${coins}コイン)\n> ${message}`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:coin: *${senderData.name}* → *${receiverData.name}* (${coins}コイン)\n> ${message}`
                }
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: '👍 いいね'
                    },
                    action_id: 'like_transaction',
                    value: insertPayload.sender_id + '|' + insertPayload.receiver_id
                  }
                ]
              }
            ]
          })
        })
        
        const channelData = await channelResponse.json()
        if (channelData.ok) {
          messageTs = channelData.ts
        }
      }
    } catch (err) {
      await supabase.from('audit_logs').insert({ 
        actor_id: senderData.id, 
        action: 'slack_channel_post_failed', 
        payload: { error: String(err) } 
      })
    }

    // send DM to receiver
    try {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`
        },
        body: JSON.stringify({
          channel: receiverData.slack_id || targetSlackId,
          text: `:tada: *${senderData.name}* さんから ${coins} コインの感謝が届きました！\n> ${message}`
        })
      })
    } catch (err) {
      // log but continue
      await supabase.from('audit_logs').insert({ actor_id: senderData.id, action: 'slack_dm_failed', payload: { error: String(err) } })
    }
    } catch (error) {
      // Log any errors in background processing
      await supabase.from('audit_logs').insert({
        actor_id: null,
        action: 'slack_background_error',
        payload: { error: String(error) }
      })
    }
  })
}
