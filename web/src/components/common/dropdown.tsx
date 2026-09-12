import './dropdown.scss'
import { type JSX } from 'react';
import { useIsShort } from '../scripts/function';
import { AnimatedDropdown } from '../scripts/function';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/auth';

export function HeaderDropdownNavigation({
  isAuthenticated,
  onOpenAuth
}: {
  isAuthenticated: boolean | null
  onOpenAuth: () => void
}): JSX.Element {
  const isShortVer = useIsShort(965);
  const { userId } = useAuth();

  interface NavItem {
    id: string;
    label: string;
    path: string;
  }

  // Десктоп меню
  const desktopMenuItems: NavItem[] = userId ? [
    { id: 'info', label: 'Информация', path: `/profile/${userId}/info` },
    { id: 'activity', label: 'Активность', path: `/profile/${userId}/activity` },
    { id: 'responses', label: 'Отклики', path: `/profile/${userId}/responces` },
    { id: 'messages', label: 'Сообщения', path: `/profile/${userId}/messages` },
    { id: 'notifications', label: 'Уведомления', path: `/profile/${userId}/notifications` },
    { id: 'settings', label: 'Настройки', path: `/profile/${userId}/settings` },
  ] : [];

  // Мобильное меню
  const mobileMenuItemsAuthenticated: NavItem[] = userId ? [
    { id: 'info', label: 'Профиль', path: `/profile/${userId}/info` },
    { id: 'applications', label: 'Заявки', path: '/vacancy' },
    { id: 'events', label: 'Мероприятия', path: '/events' },
    { id: 'users', label: 'Участники', path: '/users' },
    { id: 'activity', label: 'Активность', path: `/profile/${userId}/activity` },
    { id: 'responses', label: 'Отклики', path: `/profile/${userId}/responces` },
    { id: 'messages', label: 'Сообщения', path: `/profile/${userId}/messages` },
    { id: 'notifications', label: 'Уведомления', path: `/profile/${userId}/notifications` },
    { id: 'beta', label: 'Бета-тестирование', path: '/bug' },
    { id: 'settings', label: 'Настройки', path: `/profile/${userId}/settings` },
  ] : [];

  // Режим гостя
  const mobileMenuItemsGuestTop: NavItem[] = [
    { id: 'profile', label: 'Профиль', path: '/profile' },
    { id: 'applications', label: 'Заявки', path: '/vacancy' },
    { id: 'events', label: 'Мероприятия', path: '/events' },
    { id: 'users', label: 'Участники', path: '/users' },
    { id: 'beta', label: 'Бета-тестирование', path: '/bug' },
  ];

  const renderNavItem = (item: NavItem) => (
    <NavLink
      key={item.id}
      to={item.path}
      draggable={false}
      className={({ isActive }) => `dropdown-nav-item ${isActive ? 'active' : ''}`}
      style={{ textDecoration: 'none', color: 'inherit' }}>
      <p className='dropdown-nav-item-text'>{item.label}</p>
    </NavLink>
  );

  return (
    <div className='dropdown-nav-container'>
      <hr className='separator' />

      {!isShortVer && desktopMenuItems.map(renderNavItem)}

      {isShortVer && isAuthenticated && mobileMenuItemsAuthenticated.map(renderNavItem)}
      {isShortVer && !isAuthenticated && mobileMenuItemsGuestTop.map(renderNavItem)}

      <hr className='separator' />

      {isAuthenticated ? (
        <div className='dropdown-nav-item logout' onClick={authApi.logout}>
          <p className='dropdown-nav-item-text logout-text'> Выйти </p>
        </div>
      ) : (
        <div className='dropdown-nav-item logout' onClick={onOpenAuth}>
          <p className='dropdown-nav-item-text logout-text'> Войти / Регистрация </p>
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