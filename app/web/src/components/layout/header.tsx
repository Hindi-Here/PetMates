import LogoIcon from '@icons/icon.svg?react'
import DropdownIcon from '@icons/dropdown.svg?react'
import NotificationIcon from '@icons/notification.svg?react'
import MenuIcon from '@icons/menu.svg?react'
import AvatarIcon from '@icons/18.png';

import './header.scss'
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const Logo = () => {
  return (
    <div className='logo-container'> 
      <div className='ico-container'> 
        <LogoIcon className='logo-ico'></LogoIcon>
      </div>
      <div className='name-project-container'> 
        <p className='name-project-text'> PetMates </p>
      </div>
    </div>
  )
}

const Login = () => {
  return (
    <div className='login-container'>
      <button className='login-button'> Войти </button>
    </div>
  )
}

const Profile = () => {
  const { isOpen, setIsOpen, menuRef } = useIsOpen();
  const openMenu = () => { setIsOpen(prev => !prev);};

  return(
    <div className='profile-container'>
      <div className='notification-panel-container'>
        <NotificationIcon className='notification-ico' fill='white'></NotificationIcon>
        <div className='new-notification'></div>
      </div>
      <div ref={menuRef} className={`profile-panel-container ${isOpen ? 'open' : ''}`} onClick={openMenu}>
        <div className='avatar-container'>
          <img className='avatar-image' src={AvatarIcon} />
        </div>
        <div className='username-container'>
          <p className='username-text'> User#60698 </p>
          <p className='mail-text'> petrichenk028f@gmail.com </p>
        </div>
        <div className='dropdown-ico-container'>
          <DropdownIcon className={`dropdown-ico ${isOpen ? 'rotated' : ''}`} fill='white'></DropdownIcon>
        </div>
      </div>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="dropdown-wrapper"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}>
              <HeaderDropdownNavigation />
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  )
}

const ShortMenu = () => {
  const { isOpen, setIsOpen, menuRef } = useIsOpen();
  const openMenu = () => setIsOpen(prev => !prev);

  return(
    <div ref={menuRef} className={`short-menu-container ${isOpen ? 'open' : ''}`} onClick={openMenu}>
      <MenuIcon className='short-menu-ico' width={20} height={20} fill='white'></MenuIcon>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="dropdown-wrapper"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}>
            <HeaderDropdownNavigation />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const HeaderDropdownNavigation = () => {
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

export default function Header() {
  const isShortVer = useIsShort(965);

  return (
    <div className='header'>
      <Logo></Logo>
      {/* { isShortVer ? <ShortMenu /> : <Profile /> } */}
      <div className="header-short-unauth-container">
        {isShortVer ? (
          <>
            <Login />
            <ShortMenu />
          </>
        ) : (
          <Login />
        )}
      </div>
    </div>
  )
}

// TSX scripts

// check mobile/small screen
export function useIsShort(smallPoint = 965): boolean {
  const [flag, setFlag] = useState(window.innerWidth < smallPoint);

  useEffect(() => {
    const resize = () => {
      setFlag(window.innerWidth < smallPoint);
    };

    window.addEventListener('resize', resize);
    
    return () => window.removeEventListener('resize', resize);
  }, [smallPoint]); 

  return flag;
}

// check open/close header dropdown menu
export function useIsOpen(){
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  return { isOpen, setIsOpen, menuRef };
}