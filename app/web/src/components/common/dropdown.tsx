import './dropdown.scss'
import { type JSX } from 'react';
import { useIsShort } from '../config/function';
import { AnimatedDropdown } from '../config/function';

// header dropdown navigation
export function HeaderDropdownNavigation(): JSX.Element {
  const isShortVer = useIsShort(965);

  const menuItems = [
    { id: 'profile', label: 'Профиль', short: false },
    { id: 'projects', label: 'Мои проекты', short: false },
    
    { id: 'applications', label: 'Заявки', short: true },
    { id: 'events', label: 'Мероприятия', short: true },
    { id: 'users', label: 'Участники', short: true },
    
    { id: 'notifications', label: 'Уведомления', short: false },
    { id: 'settings', label: 'Настройки', short: false },
    
    { id: 'beta', label: 'Бета-тестирование', short: true },
  ];

  return(
    <div className='dropdown-nav-container'>
      <hr className='separator' />

      {menuItems.map((item) => {
        if (!item.short || isShortVer) {
          return (
            <div key={item.id} className='dropdown-nav-item'>
              <p className='dropdown-nav-item-text'>{item.label}</p>
            </div>
          );
        }
      })}

      <hr className='separator' />  
      <div id='logout' className='dropdown-nav-item'>
        <p id='logout-text' className='dropdown-nav-item-text'> Выйти </p>
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
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(item);}}> {/* select event for change content in sort-type-container */}
          <p className="dropdown-item-text">{item.label}</p>
        </div>
      ))}
    </AnimatedDropdown>
  );
}