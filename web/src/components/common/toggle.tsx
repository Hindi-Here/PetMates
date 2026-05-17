import './toggle.scss'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export const Toggle = ({ checked, onChange, disabled = false }: ToggleProps) => {
  return (
    <label className={`toggle-container ${disabled ? 'disabled' : ''}`}>
      
      <div className={`toggle-switch ${checked ? 'checked' : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="toggle-input"
        />
        <div className="toggle-slider" />
      </div>
    </label>
  )
}