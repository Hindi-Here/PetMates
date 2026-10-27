import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './components/common/theme'
import { ErrorPage } from './components/common/errorPage'

import { queryClient } from './components/scripts/query/queryClient'
import { QueryClientProvider } from '@tanstack/react-query'

import './main.scss'
import Header from './components/layout/header'
import Main from './components/layout/body'
import Footer from './components/layout/footer'
import BannedPage from './components/pages/ban'
import { useBanStatus } from './components/hooks/useBanStatus'
import { ScrollToTop } from './components/scripts/function';
import { AuthProvider } from './components/hooks/useAuth';
import React from 'react';

// Компонент, который проверяет статус бана пользователя и отображает соответствующую страницу
function AppGate() {
  const { isResolving, isBanned, bannedReason } = useBanStatus()

  if (isResolving) {
    return <div />
  }

  if (isBanned) {
    return <BannedPage reason={bannedReason} />
  }

  return (
    <>
      <Header/>
      <Main/>
      <Footer/>
    </>
  )
}

// Основной рендеринг приложения
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <ScrollToTop />
              <ErrorPage>
              <AppGate />
            </ErrorPage>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)