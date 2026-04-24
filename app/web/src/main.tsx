import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';

import './main.scss'
import Header from './components/layout/header'
import Main from './components/layout/body'
import Footer from './components/layout/footer'

// import form for testing
// import CreateVacancyForm from './components/forms/create_vacancy';
// import InviteUserForm from './components/forms/invite_user';
// import DeleteAccountForm from './components/forms/delete_account';
// import DeleteProjectForm from './components/forms/delete_project';
import {ScrollToTop} from './components/scripts/function';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Header/>
      <Main/>
      <Footer/>
      {/* ctrlV here import form */}
    </BrowserRouter>
  </StrictMode>,
)
