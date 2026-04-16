import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.scss'
import Header from './components/layout/header'
import Main from './components/layout/body'
import Footer from './components/layout/footer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Header/>
    <Main/>
    <Footer/>
  </StrictMode>,
)
