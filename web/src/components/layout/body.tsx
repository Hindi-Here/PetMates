import ProfileIcon from '@icons/profile.svg?react'
import VacancyIcon from '@icons/vacancy.svg?react'
import EventsIcon from '@icons/events.svg?react'
import UsersIcon from '@icons/users.svg?react'
import BugIcon from '@icons/bug.svg?react'

import './body.scss'
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import { useIsShort } from '../scripts/function';

import Search from '../common/search';

import Profile from '../pages/profile';
import Vacancy from '../pages/vacancy';
import Events from '../pages/events';
import Users from '../pages/users';
import Bug from '../pages/bug';
import ThirdProfile from '../pages/profile_third_side'

// left side navigation
const Navigation = () => {

const location = useLocation();
  
  const isMenuItemActive = (itemId: string, itemPath: string) => {
    const pathname = location.pathname;
    
    if (itemId === 'profile') {
      return pathname === '/profile' || 
      pathname.startsWith('/profile/') || /^\/users\/[^/]+$/.test(pathname);
    }
    
    if (itemId === 'users') {
      return pathname === '/users';
    }
    
    return pathname.startsWith(itemPath);
  };

  const menuItems = [
    { id: 'profile', label: 'Профиль', path: '/profile', Icon: ProfileIcon },
    { id: 'vacancy', label: 'Заявки', path: '/vacancy', Icon: VacancyIcon },
    { id: 'events', label: 'Мероприятия', path: '/events', Icon: EventsIcon },
    { id: 'users', label: 'Участники', path: '/users', Icon: UsersIcon },
    { id: 'bug', label: 'Бета-тестирование', path: '/bug', Icon: BugIcon },
  ];

  return (
    <div className='navigation-container'>
      <div className='navigation-panel-container'>
        
        {menuItems.map((item) => (
          <>
            {item.id === 'bug' && <hr className='separator' />}
            
            {/* auto route and change active element */}
            <NavLink 
              to={item.path}
              draggable={false}
              className={() => {
                const isActive = isMenuItemActive(item.id, item.path);
                return `navigation-panel-item-container ${isActive ? 'active' : ''}`;
              }}>
              <div className='navigation-panel-item-ico-container'>
                <item.Icon className='navigation-panel-item-ico' />
              </div>
              <div className='navigation-panel-item-text-container'>
                <p className='navigation-panel-item-text'>{item.label}</p>
              </div>
            </NavLink>
          </>
        ))}

      </div>
    </div>
  )
}

// routed content in dependency of activeId
const Content = () => {
  const location = useLocation(); // get current locatipn URL
  const activeId = location.pathname.split('/')[1] || 'vacancy'; // last part of link and equals with path in Route
  
  return (
    <div className='content-container'>
      <Routes>
        <Route path="/profile" element={<Profile />}>
          <Route index element={<Navigate to="info" replace />} />
          <Route path="info" element={null} />
          <Route path="activity" element={null} />
          <Route path="notifications" element={null} />
          <Route path="settings" element={null} />
        </Route>
        <Route path="/vacancy" element={<><Search activeId={activeId}/><Vacancy /></>} />
        <Route path="/events" element={<><Search activeId={activeId}/><Events/></>} />
        <Route path="/users" element={<><Search activeId={activeId}/><Users/></>} />
        <Route path="/users/:userId" element={<ThirdProfile />} />
        <Route path="/bug" element={<Bug/>}/>
        <Route path="*" element={<Navigate to="/vacancy" replace />} />
      </Routes>
    </div>
)}

export default function Main () {
  const isShortVer = useIsShort(965);

  return (
    <div className='main'>
      <div className='container'>
         { !isShortVer ? <Navigation/> : '' }
         <Content/>
      </div>
    </div>
  )
}