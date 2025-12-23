import type { NextApiRequest, NextApiResponse } from 'next'

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slackId } = req.query
  if (!slackId || typeof slackId !== 'string') {
    return res.status(400).json({ error: 'slackId required' })
  }
  if (!SLACK_BOT_TOKEN) {
    return res.status(500).json({ error: 'Slack bot token not set' })
  }
  const resp = await fetch(`https://slack.com/api/users.info?user=${slackId}`, {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` }
  })
  const data = await resp.json()
  if (!data.ok) return res.status(404).json({ error: 'User not found' })
  res.json({ image: data.user.profile.image_192 })
}
