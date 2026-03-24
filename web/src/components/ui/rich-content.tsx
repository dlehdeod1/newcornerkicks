'use client'

import { useMemo } from 'react'

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})(?:[^\s]*)/g

function extractVideoId(url: string): string | null {
  const match = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url)
  return match ? match[1] : null
}

type ContentPart = { type: 'text'; value: string } | { type: 'youtube'; videoId: string }

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  let lastIndex = 0

  const regex = new RegExp(YOUTUBE_REGEX.source, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    const videoId = extractVideoId(match[0])
    if (videoId) {
      parts.push({ type: 'youtube', videoId })
    } else {
      parts.push({ type: 'text', value: match[0] })
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return parts
}

export function RichContent({ content, className }: { content: string; className?: string }) {
  const parts = useMemo(() => parseContent(content), [content])

  const hasYoutube = parts.some((p) => p.type === 'youtube')

  if (!hasYoutube) {
    return <div className={className}>{content}</div>
  }

  return (
    <div className={className}>
      {parts.map((part, i) =>
        part.type === 'text' ? (
          <span key={i}>{part.value}</span>
        ) : (
          <div key={i} className="my-3">
            <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${part.videoId}`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            </div>
          </div>
        )
      )}
    </div>
  )
}
