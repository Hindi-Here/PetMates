import LogoIcon from '@icons/icon.svg?react'
import DropdownIcon from '@icons/dropdown.svg?react'
import NotificationIcon from '@icons/notification.svg?react'
import MenuIcon from '@icons/menu.svg?react'

import './header.scss'
import { AnimatedDropdown } from '../scripts/function';
import { useIsShort, useIsOpen } from '../scripts/function';
import { HeaderDropdownNavigation } from '../common/dropdown';

import { useState } from 'react';
import AuthorizationForm from '../forms/authorization';

import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile'

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

const Login = ({ onOpen }: any) => {
  return (
    <div className='login-container'>
      <button className='login-button' onClick={onOpen}> Войти </button>
    </div>
  )
}

const Profile = () => {
  const { isOpen, setIsOpen, menuRef } = useIsOpen();
  const openMenu = () => { setIsOpen(X => !X);};

  const { isAuthenticated } = useAuth();
  const { data: user } = useProfile(isAuthenticated); 

  return(
    <div className='profile-container'>
      <div className='notification-panel-container'>
        <NotificationIcon className='notification-ico' fill='white'></NotificationIcon>
        <div className='new-notification'></div>
      </div>
      <div ref={menuRef} className={`profile-panel-container ${isOpen ? 'open' : ''}`} onClick={openMenu}>
        <div className='avatar-container'>
          <img className='avatar-image' src={user?.avatarUrl} alt="Avatar" />
        </div>
        <div className='username-container'>
          <p className='username-text'> {user?.nickname} </p>
          <p className='mail-text'> {user?.email} </p>
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
  const openMenu = () => setIsOpen(X => !X);

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
  const { isAuthenticated} = useAuth();
  const isShortVer = useIsShort(965);

  // state authorzation form visible
  const [isAuthOpen, setIsAuthOpen] = useState(false); 

  return (
    <div className='header'>
      <div className="container">
      <Logo />
      <div className="header-short-container">
        {isAuthenticated ? <Profile /> : <Login onOpen={() => setIsAuthOpen(true)} />} {/* change on open, activate isAuthOpen if part*/}
        {isShortVer && <ShortMenu />}
      </div>

      {isAuthOpen && (
        <AuthorizationForm onClose={() => setIsAuthOpen(false)} /> /* close rules in authorization.tsx */
      )}
    </div>
    </div>
  )
}