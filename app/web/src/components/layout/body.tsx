import ProfileIcon from '@icons/profile.svg?react'
import VacancyIcon from '@icons/vacancy.svg?react'
import EventsIcon from '@icons/events.svg?react'
import UsersIcon from '@icons/users.svg?react'
import BugIcon from '@icons/bug.svg?react'

import './body.scss'
import { useState } from 'react';
import { useIsShort } from './header';

import Search from '../common/search';
import QueryContent from '../pages/vacancy'

interface NavigationProps {
  activeId: string;
  setActiveId: (id: string) => void;
}

const Navigation = ({ activeId, setActiveId }: NavigationProps) => {
  const menuItems = [
    { id: 'profile', label: 'Профиль', Icon: ProfileIcon },
    { id: 'vacancy', label: 'Заявки', Icon: VacancyIcon },
    { id: 'events', label: 'Мероприятия', Icon: EventsIcon },
    { id: 'users', label: 'Участники', Icon: UsersIcon },
    { id: 'bug', label: 'Бета-тестирование', Icon: BugIcon },
  ];

  return (
    <div className='navigation-container'>
      <div className='navigation-panel-container'>
        
        {menuItems.map((item) => (
          <>
            {item.id === 'bug' && <hr className='separator' />}

            <div 
              key={item.id}
              className={`navigation-panel-item-container ${activeId === item.id ? 'active' : ''}`}
              onClick={() => setActiveId(item.id)}>

              <div className='navigation-panel-item-ico-container'>
                <item.Icon className='navigation-panel-item-ico' />
              </div>
              <div className='navigation-panel-item-text-container'>
                <p className='navigation-panel-item-text'>{item.label}</p>
              </div>

            </div>
          </>
        ))}

      </div>
    </div>
  )
}

const Content = ({ activeId }: { activeId: string }) => {
  return (
    <div className='content-container'>
      <Search activeId={activeId}/>
      <QueryContent></QueryContent>
    </div>
)}

export default function Main () {
  const isShortVer = useIsShort(965);
  const [activeId, setActiveId] = useState('vacancy');

  return (
    <div className='main'>
         { !isShortVer ? <Navigation activeId={activeId} setActiveId={setActiveId} /> : '' }
         <Content activeId={activeId} />
    </div>
  )
}