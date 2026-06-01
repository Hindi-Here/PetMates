import Add from '@icons/plus.svg?react'
import './activity.scss'

export const Activity = () => {
  const projectsCount = 0

  return (
    <div className="activity-page">
      <div className="activity-header">
        <h2 className="section-title">
          Мои проекты: <span className="projects-count">{projectsCount}</span>
        </h2>
      </div>

      <button className="add-project-card">
        <div className="add-icon-container">
          <Add className="add-icon" />
        </div>
        <span className="add-project-text">Создать новый проект</span>
      </button>

      <div className="projects-list">
      </div>
    </div>
  )
}