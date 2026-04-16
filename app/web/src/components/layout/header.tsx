import LogoIcon from '@icons/icon.svg?react'
import DropdownIcon from '@icons/dropdown.svg?react'
import NotificationIcon from '@icons/notification.svg?react'
import MenuIcon from '@icons/menu.svg?react'

import './header.scss'
import { AnimatedDropdown } from '../config/function';
import { useIsShort, useIsOpen } from '../config/function';
import { HeaderDropdownNavigation } from '../common/dropdown';

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
         {/* <img className='avatar-image' src={AvatarIcon} /> */}
        </div>
        <div className='username-container'>
          <p className='username-text'> User#60698 </p>
          <p className='mail-text'> petrichenk028f@gmail.com </p>
        </div>
        <div className='dropdown-ico-container'>
          <DropdownIcon className={`dropdown-ico ${isOpen ? 'rotated' : ''}`} fill='white'></DropdownIcon>
        </div>
      </div>
        <AnimatedDropdown isOpen={isOpen} className="dropdown-wrapper">
          <HeaderDropdownNavigation />
        </AnimatedDropdown>
    </div>
  )
}

const ShortMenu = () => {
  const { isOpen, setIsOpen, menuRef } = useIsOpen();
  const openMenu = () => setIsOpen(prev => !prev);

  return(
    <div ref={menuRef} className={`short-menu-container ${isOpen ? 'open' : ''}`} onClick={openMenu}>
      <MenuIcon className='short-menu-ico'/>
      <AnimatedDropdown isOpen={isOpen} className="dropdown-wrapper">
        <HeaderDropdownNavigation />
      </AnimatedDropdown>
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