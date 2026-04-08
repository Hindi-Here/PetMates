import LogoIcon from '@icons/icon.svg?react'
import DropdownIcon from '@icons/dropdown.svg?react'
import NotificationIcon from '@icons/notification.svg?react'
import MenuIcon from '@icons/menu.svg?react'
import AvatarIcon from '@icons/18.png';

import './header.scss'
import { useState, useEffect, useRef } from 'react';

const Logo = () => {
return (
  <div className='logo-container'> 
    <div className='ico-container'> 
      <LogoIcon width={40} height={40}></LogoIcon>
    </div>
    <div className='name-project-container'> 
      <p className='name-project-text'> PetMates </p>
    </div>
  </div>
)}

const Login = () => {
return (
  <div className='login-container'>
    <button className='login-button'> Войти </button>
  </div>
)}

const Profile = () => {
  const { isOpen, openMenu, menuRef } = useIsOpen();

return(
  <div className='profile-container'>
    <div className='notification-panel-container'>
      <NotificationIcon className='notification-ico' width={15} height={20} fill='white'></NotificationIcon>
      <div className='new-notification'></div>
    </div>
    <div className='profile-panel-container' onClick={openMenu}>
      <div className='avatar-container'>
        <img className='avatar-image' src={AvatarIcon} />
      </div>
      <div className='username-container'>
        <p className='username-text'> User#60698 </p>
        <p className='mail-text'> petrichenk028f@gmail.com </p>
      </div>
      <div className='dropdown-container'>
        <DropdownIcon className='dropdown-ico' width={15} height={15} fill='white'></DropdownIcon>
      </div>
      {isOpen && (
      <div ref={menuRef} className='dropdown-wrapper'> 
        <HeaderDropdownNavigation />
      </div>
      )}
    </div>
  </div>
)}

const ShortMenu = () => {
  const { isOpen, openMenu, menuRef } = useIsOpen();
return(
  <div className='short-menu-container' onClick={openMenu}>
    <MenuIcon className='short-menu-ico' width={20} height={20} fill='white'></MenuIcon>
       {isOpen && (
        <div ref={menuRef}>
          <HeaderDropdownNavigation></HeaderDropdownNavigation>
        </div>
      )}
  </div>
)}

const HeaderDropdownNavigation = () => {
  const isShortVer = useIsShort(768);

return(
  <div className='dropdown-nav-container'>
    <hr className='separator'></hr>
    <div className='dropdown-nav-item'>
      <p className='dropdown-nav-item-text'> Профиль </p>
    </div>
    <div className='dropdown-nav-item'>
      <p className='dropdown-nav-item-text'> Мои проекты </p>
    </div>

    {isShortVer && (
      <div className='dropdown-nav-item'>
        <p className='dropdown-nav-item-text'> Заявки </p>
      </div>
    )}
    {isShortVer && (
      <div className='dropdown-nav-item'>
        <p className='dropdown-nav-item-text'> Мероприятия </p>
      </div>
    )}
    {isShortVer && (
      <div className='dropdown-nav-item'>
        <p className='dropdown-nav-item-text'> Участники </p>
      </div>
    )}

    <div className='dropdown-nav-item'>
      <p className='dropdown-nav-item-text'> Уведомления </p>
    </div>
    <div className='dropdown-nav-item'>
      <p className='dropdown-nav-item-text'> Настройки </p>
    </div>

    {isShortVer && (
      <div className='dropdown-nav-item'>
        <p className='dropdown-nav-item-text'> Бета-тестинг </p>
      </div>
    )}

    <hr className='separator'></hr>
    <div id='logout' className='dropdown-nav-item'>
      <p id='logout-text' className='dropdown-nav-item-text'> Выйти </p>
    </div>
  </div>
)}

export default function Header() {
  const isShortVer = useIsShort(768);

  return (
    <div className='header'>
      <Logo></Logo>
      { isShortVer ? <ShortMenu /> : <Profile /> }
    </div>
  )
}

// TSX scripts

// check mobile/small screen
function useIsShort(smallPoint = 768): boolean {
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
function useIsOpen(){
  const [isOpen, setIsOpen] = useState<boolean>(false);
  
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {

      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return { isOpen, openMenu, menuRef };
}