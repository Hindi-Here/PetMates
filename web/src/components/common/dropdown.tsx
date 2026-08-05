import './dropdown.scss'
import { type JSX, useState, useRef, useEffect } from 'react';
import { useIsShort } from '../scripts/function';
import { AnimatedDropdown } from '../scripts/function';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/auth';

export function HeaderDropdownNavigation(): JSX.Element {
  const isShortVer = useIsShort(965);
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [isProfileSubmenuOpen, setIsProfileSubmenuOpen] = useState(false);
  const profileItemRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  interface MainMenuItem {
    id: string;
    label: string;
    hasSubmenu?: boolean;
    path?: string;
    short: boolean;
  }

  interface SubMenuItem {
    id: string;
    label: string;
    path: string;
  }

  const desktopMenuItems = userId ? [
    { id: 'info', label: 'Информация', path: `/profile/${userId}/info` },
    { id: 'activity', label: 'Активность', path: `/profile/${userId}/activity` },
    { id: 'responses', label: 'Отклики', path: `/profile/${userId}/responces` },
    { id: 'messages', label: 'Сообщения', path: `/profile/${userId}/messages` },
    { id: 'notifications', label: 'Уведомления', path: `/profile/${userId}/notifications` },
    { id: 'settings', label: 'Настройки', path: `/profile/${userId}/settings` },
  ] : [];

  const mobileMenuItems: MainMenuItem[] = [
    { id: 'profile', label: 'Профиль', hasSubmenu: true, short: false },
    { id: 'applications', label: 'Заявки', path: '/vacancy', short: true },
    { id: 'events', label: 'Мероприятия', path: '/events', short: true },
    { id: 'users', label: 'Участники', path: '/users', short: true },
    { id: 'beta', label: 'Бета-тестирование', path: '/bug', short: true },
  ];

  const profileSubmenuItems: SubMenuItem[] = userId ? [
    { id: 'info', label: 'Информация', path: `/profile/${userId}/info` },
    { id: 'activity', label: 'Активность', path: `/profile/${userId}/activity` },
    { id: 'responses', label: 'Отклики', path: `/profile/${userId}/responces` },
    { id: 'messages', label: 'Сообщения', path: `/profile/${userId}/messages` },
    { id: 'notifications', label: 'Уведомления', path: `/profile/${userId}/notifications` },
    { id: 'settings', label: 'Настройки', path: `/profile/${userId}/settings` },
  ] : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideItem = profileItemRef.current?.contains(target);
      const insideSubmenu = submenuRef.current?.contains(target);
      if (!insideItem && !insideSubmenu) {
        setIsProfileSubmenuOpen(false);
      }
    }

    if (isProfileSubmenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isProfileSubmenuOpen]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    }
  }, []);

  const openSubmenu = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsProfileSubmenuOpen(true);
  };

  const scheduleCloseSubmenu = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => setIsProfileSubmenuOpen(false), 120);
  };

  const handleProfileClick = () => {
    if (!userId) return;
    navigate(`/profile/${userId}/info`);
    setIsProfileSubmenuOpen(false);
  };

  return(
    <div className='dropdown-nav-container'>
      <hr className='separator' />

      {!isShortVer && desktopMenuItems.map((item) => (
        <NavLink 
          key={item.id} 
          to={item.path}
          draggable={false}
          className={({ isActive }) => `dropdown-nav-item ${isActive ? 'active' : ''}`}
          style={{ textDecoration: 'none', color: 'inherit' }}>
          <p className='dropdown-nav-item-text'>{item.label}</p>
        </NavLink>
      ))}

      {isShortVer && mobileMenuItems.map((item) => {
        if (!item.short || isShortVer) {
          if (item.hasSubmenu) {
            return (
              <div
                key={item.id}
                className='dropdown-nav-item has-submenu'
                ref={profileItemRef}
                onMouseEnter={openSubmenu}
                onMouseLeave={scheduleCloseSubmenu}
                onClick={handleProfileClick}
              >
                <p className='dropdown-nav-item-text'>{item.label}</p>
              </div>
            );
          } else {
            return (
              <NavLink 
                key={item.id} 
                to={item.path!}
                draggable={false}
                className={({ isActive }) => `dropdown-nav-item ${isActive ? 'active' : ''}`}
                style={{ textDecoration: 'none', color: 'inherit' }}>
                <p className='dropdown-nav-item-text'>{item.label}</p>
              </NavLink>
            );
          }
        }
        return null;
      })}

      <hr className='separator' />  
      <div className='dropdown-nav-item logout' onClick={authApi.logout}>
        <p className='dropdown-nav-item-text logout-text'> Выйти </p>
      </div>

      {isShortVer && isProfileSubmenuOpen && profileSubmenuItems.length > 0 && (
        <div
          className='submenu-container'
          ref={submenuRef}
          onMouseEnter={openSubmenu}
          onMouseLeave={scheduleCloseSubmenu}
        >
          <hr className='separator' />
          {profileSubmenuItems.map(subItem => (
            <NavLink 
              key={subItem.id} 
              to={subItem.path}
              className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
              onClick={() => setIsProfileSubmenuOpen(false)}
            >
              {subItem.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

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
            onSelect?.(item);
          }}>
          <p className="dropdown-item-text">{item.label}</p>
        </div>
      ))}
    </AnimatedDropdown>
  );
}