/** Green (0) → yellow (50) → red (100) for risk percentage display */
export function riskScoreColor(score: number): string {
  const s = Math.max(0, Math.min(100, score))

  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)

  if (s <= 50) {
    const t = s / 50
    const r = lerp(34, 234, t)
    const g = lerp(197, 179, t)
    const b = lerp(94, 8, t)
    return `rgb(${r}, ${g}, ${b})`
  }

  const t = (s - 50) / 50
  const r = lerp(234, 239, t)
  const g = lerp(179, 68, t)
  const b = lerp(8, 68, t)
  return `rgb(${r}, ${g}, ${b})`
}
