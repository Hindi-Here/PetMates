import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';

import { queryClient } from './components/scripts/query/queryClient'
import { QueryClientProvider } from '@tanstack/react-query'

import './main.scss'
import Header from './components/layout/header'
import Main from './components/layout/body'
import Footer from './components/layout/footer'
import { ScrollToTop } from './components/scripts/function';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ScrollToTop />
        <Header/>
        <Main/>
        <Footer/>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)