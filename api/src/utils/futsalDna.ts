export interface FutsalDNA {
  type: string
  emoji: string
}

export function getFutsalDNA(player: {
  shooting?: number; offball_run?: number; ball_keeping?: number
  passing?: number; linkup?: number
  intercept?: number; marking?: number; physical?: number
  stamina?: number; speed?: number
}): FutsalDNA | null {
  const s = (v?: number) => v ?? 5
  const stats = [
    s(player.shooting), s(player.offball_run), s(player.ball_keeping),
    s(player.passing), s(player.linkup),
    s(player.intercept), s(player.marking),
    s(player.stamina), s(player.speed), s(player.physical),
  ]
  if (stats.every(v => v === 5)) return null

  const attack = (s(player.shooting) * 1.5 + s(player.offball_run) + s(player.ball_keeping)) / 3.5
  const playmaking = (s(player.passing) * 1.5 + s(player.linkup) * 1.5) / 3
  const defense = (s(player.intercept) * 1.5 + s(player.marking) * 1.5 + s(player.physical)) / 4
  const engine = (s(player.stamina) * 1.5 + s(player.speed) * 1.5) / 3

  const values = [attack, playmaking, defense, engine]
  const max = Math.max(...values)
  const range = max - Math.min(...values)

  if (range < max * 0.1) return { type: '올라운더', emoji: '⚡' }
  if (max === attack) return { type: '스트라이커', emoji: '🎯' }
  if (max === playmaking) return { type: '플레이메이커', emoji: '🎩' }
  if (max === defense) return { type: '수비수', emoji: '🛡️' }
  if (max === engine) return { type: '엔진', emoji: '🏃' }
  return { type: '올라운더', emoji: '⚡' }
}
