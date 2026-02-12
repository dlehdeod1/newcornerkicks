'use client'

import { useMemo } from 'react'

interface RadarChartProps {
  data: { label: string; value: number; maxValue?: number }[]
  size?: number
  color?: string
  showLabels?: boolean
  showValues?: boolean
  className?: string
}

export function RadarChart({
  data,
  size = 200,
  color = '#10b981',
  showLabels = true,
  showValues = false,
  className = '',
}: RadarChartProps) {
  const center = size / 2
  const radius = size * 0.35
  const labelRadius = size * 0.45

  const points = useMemo(() => {
    const angleStep = (2 * Math.PI) / data.length
    return data.map((item, i) => {
      const angle = angleStep * i - Math.PI / 2 // 12시 방향부터 시작
      const maxValue = item.maxValue || 10
      const normalizedValue = Math.min(item.value / maxValue, 1)
      const r = radius * normalizedValue

      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        labelX: center + labelRadius * Math.cos(angle),
        labelY: center + labelRadius * Math.sin(angle),
        angle,
        ...item,
      }
    })
  }, [data, center, radius, labelRadius])

  // 그리드 라인 (5개 레벨)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0]

  // 데이터 폴리곤 경로
  const dataPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  // 축 라인
  const axisLines = points.map((p) => ({
    x1: center,
    y1: center,
    x2: center + radius * Math.cos(p.angle),
    y2: center + radius * Math.sin(p.angle),
  }))

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
    >
      {/* 배경 그리드 */}
      {gridLevels.map((level) => {
        const gridPath = data
          .map((_, i) => {
            const angle = (2 * Math.PI * i) / data.length - Math.PI / 2
            const r = radius * level
            const x = center + r * Math.cos(angle)
            const y = center + r * Math.sin(angle)
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
          })
          .join(' ') + ' Z'

        return (
          <path
            key={level}
            d={gridPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-slate-300 dark:text-slate-600"
          />
        )
      })}

      {/* 축 라인 */}
      {axisLines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-slate-300 dark:text-slate-600"
        />
      ))}

      {/* 데이터 영역 */}
      <path
        d={dataPath}
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth={2}
      />

      {/* 데이터 포인트 */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill={color}
        />
      ))}

      {/* 라벨 */}
      {showLabels && points.map((p, i) => (
        <text
          key={i}
          x={p.labelX}
          y={p.labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-600 dark:fill-slate-400 text-[10px] font-medium"
        >
          {p.label}
          {showValues && ` (${p.value})`}
        </text>
      ))}
    </svg>
  )
}

// 선수 능력치용 프리셋
export function PlayerRadarChart({
  stats,
  size = 200,
  className = '',
}: {
  stats: {
    shooting?: number
    offball_run?: number
    ball_keeping?: number
    passing?: number
    linkup?: number
    intercept?: number
    marking?: number
    stamina?: number
    speed?: number
    physical?: number
  }
  size?: number
  className?: string
}) {
  const data = [
    { label: '슈팅', value: stats.shooting || 5 },
    { label: '오프더볼', value: stats.offball_run || 5 },
    { label: '볼키핑', value: stats.ball_keeping || 5 },
    { label: '패스', value: stats.passing || 5 },
    { label: '연계', value: stats.linkup || 5 },
    { label: '인터셉트', value: stats.intercept || 5 },
    { label: '마킹', value: stats.marking || 5 },
    { label: '체력', value: stats.stamina || 5 },
    { label: '스피드', value: stats.speed || 5 },
    { label: '피지컬', value: stats.physical || 5 },
  ]

  return (
    <RadarChart
      data={data}
      size={size}
      color="#10b981"
      showLabels={true}
      className={className}
    />
  )
}

// 간소화된 5각형 차트 (공격/수비/체력/스피드/피지컬)
export function SimpleRadarChart({
  stats,
  size = 160,
  className = '',
}: {
  stats: {
    attack?: number    // 슈팅 + 오프더볼 + 볼키핑 평균
    playmaking?: number // 패스 + 연계 평균
    defense?: number   // 인터셉트 + 마킹 평균
    stamina?: number
    athletic?: number  // 스피드 + 피지컬 평균
  }
  size?: number
  className?: string
}) {
  const data = [
    { label: '공격', value: stats.attack || 5 },
    { label: '창조', value: stats.playmaking || 5 },
    { label: '수비', value: stats.defense || 5 },
    { label: '체력', value: stats.stamina || 5 },
    { label: '운동', value: stats.athletic || 5 },
  ]

  return (
    <RadarChart
      data={data}
      size={size}
      color="#10b981"
      showLabels={true}
      className={className}
    />
  )
}
