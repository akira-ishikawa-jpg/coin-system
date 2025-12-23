import useSWR from 'swr'

interface AvatarProps {
  slackId?: string
  size?: number
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function Avatar({ slackId, size = 40 }: AvatarProps) {
  const { data } = useSWR(slackId ? `/api/slack-avatar?slackId=${slackId}` : null, fetcher)
  if (!slackId) {
    return <div style={{ width: size, height: size }} className="bg-gray-300 rounded-full" />
  }
  if (!data || !data.image) {
    return <div style={{ width: size, height: size }} className="bg-gray-200 rounded-full animate-pulse" />
  }
  return (
    <img
      src={data.image}
      alt="avatar"
      style={{ width: size, height: size }}
      className="rounded-full border border-slate-200 bg-white object-cover"
      loading="lazy"
    />
  )
}
