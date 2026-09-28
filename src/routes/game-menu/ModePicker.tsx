import { Music2, Grid2X2, Zap, Check } from "lucide-react"
import type { Mode } from "../../../convex/partyModel"
const modes = [
  { id: "songle" as const, title: "Songle", tagline: "Know it? Name it.", detail: "5 songs · speed + artist bonus", icon: Music2, color: "#f472b6" },
  { id: "wordle" as const, title: "Wordle", tagline: "Five letters. First place.", detail: "5 rounds · solve faster, score higher", icon: Grid2X2, color: "#a3e635" },
  { id: "trivia" as const, title: "Pop Trivia", tagline: "Think fast. Stay alive.", detail: "10 questions max · sudden death", icon: Zap, color: "#fbbf24" },
]
export default function ModePicker({ value, onChange, disabled = false }: { value: Mode; onChange: (mode: Mode) => void; disabled?: boolean }) {
  return <div className="mode-list" role="group" aria-label="Game mode">{modes.map(({ id, title, tagline, detail, icon: Icon, color }) => <button key={id} type="button" className={`mode-card ${value === id ? "selected" : ""}`} aria-pressed={value === id} disabled={disabled} onClick={() => onChange(id)} style={{ "--mode-color": color } as React.CSSProperties}>
    <span className="mode-icon"><Icon size={25} /></span><span className="mode-copy"><strong>{title}</strong><span>{tagline}</span><small>{detail}</small></span>{value === id && <Check size={19} aria-label="Selected" />}
  </button>)}</div>
}
