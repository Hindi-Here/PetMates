import './dropdown.scss'
import { type JSX } from 'react';
import { useIsShort } from '../scripts/function';
import { AnimatedDropdown } from '../scripts/function';
import { NavLink } from 'react-router-dom';

import { authApi } from '../services/auth';

// header dropdown navigation
export function HeaderDropdownNavigation(): JSX.Element {
  const isShortVer = useIsShort(965);

  const menuItems = [
    { id: 'profile', label: 'Профиль', path: '/profile', short: false },
    { id: 'projects', label: 'Мои проекты', path: '/projects', short: false },
    
    { id: 'applications', label: 'Заявки', path: '/vacancy', short: true },
    { id: 'events', label: 'Мероприятия', path: '/events', short: true },
    { id: 'users', label: 'Участники', path: '/users', short: true },
    
    { id: 'notifications', label: 'Уведомления', path: '/notifications', short: false },
    { id: 'settings', label: 'Настройки', path: '/settings', short: false },
    
    { id: 'beta', label: 'Бета-тестирование', path: '/bug', short: true },
  ];

  return(
    <div className='dropdown-nav-container'>
      <hr className='separator' />

      {menuItems.map((item) => {
        if (!item.short || isShortVer) {
          return (
            <NavLink 
              key={item.id} 
              to={item.path}
              draggable={false}
              className={({ isActive }) => `dropdown-nav-item ${isActive ? 'active' : ''}`}
              style={{ textDecoration: 'none', color: 'inherit' }}>
              <p className='dropdown-nav-item-text'>{item.label}</p>
            </NavLink>
          );
        }
      })}

      <hr className='separator' />  
      <div className='dropdown-nav-item logout' onClick={authApi.logout}>
        <p className='dropdown-nav-item-text logout-text'> Выйти </p>
      </div>
    </div>
  )
}

// all dropdown component
interface MenuItem {
  id: string;
  label: string;
}

interface DropdownProps {
  items: MenuItem[];
  isOpen: boolean;
  onSelect?: (item: MenuItem) => void;
}

export function Dropdown({ items, isOpen, onSelect }: DropdownProps) {
  return (
    <AnimatedDropdown isOpen={isOpen} className="dropdown-container">
      {items.map((item) => (
        <div
          key={item.id}
          className="dropdown-item"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(item);}}> {/* select event for change content in sort-type-container */}
          <p className="dropdown-item-text">{item.label}</p>
        </div>
      ))}
    </AnimatedDropdown>
  );
}