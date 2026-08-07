import { PROJECT_TYPE_OPTIONS } from "@/lib/team-data"

type ProjectTypePickerProps = {
  error?: string
  defaultValue?: string
  onChange?: () => void
}

export function ProjectTypePicker({ error, defaultValue = "", onChange }: ProjectTypePickerProps) {
  return (
    <fieldset
      className="form-field"
      aria-invalid={!!error}
      aria-describedby={error ? "projectType-err" : undefined}
    >
      <legend className="form-label">
        Milyen projekt? <span className="form-label-required">*</span>
      </legend>
      <div className="project-type-grid" role="radiogroup" aria-label="Projekt típusa">
        {PROJECT_TYPE_OPTIONS.map((opt) => (
          <label key={opt.value} className="project-type-card">
            <input
              type="radio"
              name="projectType"
              value={opt.value}
              defaultChecked={defaultValue === opt.value}
              required
              className="sr-only"
              onChange={onChange}
            />
            <span className="project-type-card__label">{opt.label}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p id="projectType-err" className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
