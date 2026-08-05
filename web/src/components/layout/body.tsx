import { Fragment } from 'react'
import ProfileIcon from '@icons/profile.svg?react'
import VacancyIcon from '@icons/vacancy.svg?react'
import EventsIcon from '@icons/events.svg?react'
import UsersIcon from '@icons/users.svg?react'
import BugIcon from '@icons/bug.svg?react'

import './body.scss'
import { Routes, Route, Navigate, NavLink, useLocation, useParams } from 'react-router-dom'
import { useIsShort } from '../scripts/function';
import { useAuth } from '../hooks/useAuth';

import Search from '../common/search';

import Profile from '../pages/profile';
import Vacancy from '../pages/vacancy';
import Events from '../pages/events';
import Users from '../pages/users';
import Bug from '../pages/bug';
import { Project } from '../pages/project'
import { Activity } from '../pages/activity'
import { Setting } from '../pages/setting'
import { Responses } from '../pages/response'
import { Messages } from '../pages/message'
import { Chat } from '../pages/chat'

interface MenuItem {
  id: string;
  label: string;
  path: string;
  Icon: React.ComponentType<{ className?: string }>;
}

// Рендер навигационного меню
const Navigation = () => {
  const location = useLocation();
  const { userId } = useAuth();
  
  const menuItems: MenuItem[] = [
    { id: 'profile', label: 'Профиль', path: '/profile', Icon: ProfileIcon },
    { id: 'vacancy', label: 'Заявки', path: '/vacancy', Icon: VacancyIcon },
    { id: 'events', label: 'Мероприятия', path: '/events', Icon: EventsIcon },
    { id: 'users', label: 'Участники', path: '/users', Icon: UsersIcon },
    { id: 'bug', label: 'Бета-тестирование', path: '/bug', Icon: BugIcon },
  ];

  // Проверка: активен ли пункт меню
  const isMenuItemActive = (itemId: string, itemPath: string) => {
    const pathname = location.pathname;
    
    if (itemId === 'profile') {
      return pathname === '/profile' || pathname.startsWith('/profile/');
    }
    
    if (itemId === 'users') {
      return pathname === '/users';
    }
    
    return pathname.startsWith(itemPath);
  };

  // Проверка: находится ли пользователь на своём профиле
  const isOnOwnProfile = () => {
    const pathname = location.pathname;
    if (!userId) return false;
    
    if (pathname === '/profile') return true;
    
    const pathParts = pathname.split('/');
    const urlProfileId = pathParts[2];
  
    return urlProfileId === userId;
  };

  // Обработка клика по пункту навигации
  const handleNavigationClick = (e: React.MouseEvent, itemId: string) => {
    if (itemId === 'profile') {
      if (isOnOwnProfile()) {
        e.preventDefault();
        e.stopPropagation();
      }
    } else {
      const isActive = isMenuItemActive(itemId, menuItems.find(m => m.id === itemId)?.path || '');
      if (isActive) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  return (
    <div className='navigation-container'>
      <div className='navigation-panel-container'>
        
        {menuItems.map((item) => (
          <Fragment key={item.id}>
            {item.id === 'bug' && <hr className='separator' />}
            
            <NavLink 
              to={item.path}
              draggable={false}
              onClick={(e) => handleNavigationClick(e, item.id)}
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
          </Fragment>
        ))}

      </div>
    </div>
  )
}

// Перенаправление на вкладку информации профиля пользователя
const RedirectUsersProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  return <Navigate to={`/profile/${userId}/info`} replace />;
};

// Рендер контента с маршрутизацией
const Content = () => {
  const location = useLocation();
  const { userId } = useAuth();
  const activeId = location.pathname.split('/')[1] || 'vacancy';
  
  return (
    <div className='content-container'>
      <Routes>
        <Route path="/profile" element={userId ? <Navigate to={`/profile/${userId}/info`} replace /> : <Profile />} />
        <Route path="/profile/:profileId" element={<Profile />}>
          <Route index element={<Navigate to="info" replace />} />
          <Route path="info" element={null} />
          <Route path="activity" element={<Activity />} />
          <Route path="activity/project/:projectId" element={<Project />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:conversationId" element={<Chat />} />
          <Route path="responces" element={<Responses />} />
          <Route path="notifications" element={null} />
          <Route path="settings" element={<Setting />} />
        </Route>
        <Route path="/vacancy" element={<><Search activeId={activeId}/><Vacancy /></>} />
        <Route path="/events" element={<><Search activeId={activeId}/><Events/></>} />
        <Route path="/users" element={<><Search activeId={activeId}/><Users/></>} />
        <Route path="/users/:userId" element={<RedirectUsersProfile />} />
        <Route path="/bug" element={<Bug/>}/>
        <Route path="*" element={<Navigate to="/vacancy" replace />} />
      </Routes>
    </div>
  )
}

// Главный компонент макета страницы
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