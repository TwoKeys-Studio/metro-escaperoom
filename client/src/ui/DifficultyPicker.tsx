import { DIFFICULTIES, type Difficulty } from '../../../shared/level'

const DESC: Record<Difficulty, string> = {
  easy: '90 мин · подсказки и метки целей',
  normal: '60 мин · 1 битая ячейка',
  hard: '45 мин · садится фонарь · штрафы',
  nightmare: '30 мин · 2 битые ячейки · тьма',
}

export function DifficultyPicker({ value, onChange, disabled, labelledBy }: {
  value: Difficulty; onChange: (d: Difficulty) => void; disabled?: boolean; labelledBy?: string
}) {
  return (
    <div className="chips" role="group" aria-labelledby={labelledBy}>
      {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
        <button
          type="button"
          key={d}
          className={`chip chip-${d}`}
          aria-pressed={value === d}
          disabled={disabled}
          onClick={() => onChange(d)}
        >
          <strong>{DIFFICULTIES[d].label}</strong>
          <span>{DESC[d]}</span>
        </button>
      ))}
    </div>
  )
}
