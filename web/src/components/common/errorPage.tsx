import './errorPage.scss'
import { Component, type ReactNode } from 'react'
import CloudBoltIcon from '@icons/cloud-bolt.svg?react'

export class ErrorPage extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('ErrorBoundary caught an error:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className='error-page-container'>
        <CloudBoltIcon className='error-page-container-icon' />
        
        <h1 className='error-page-container-title'>
          Что-то пошло не так
        </h1>
        
        <p className='error-page-container-message'>
          Произошла непредвиденная ошибка. Попробуйте обновить страницу или вернитесь позже.
        </p>
        
        <button 
          className='error-page-container-button' 
          onClick={() => window.location.reload()}
        >
          Обновить страницу
        </button>
      </div>
    )
  }
}