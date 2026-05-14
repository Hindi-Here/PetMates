import './template_search.scss'
import './users.scss'

import NotFoundContentIcon from '@icons/not_found_content.svg?react'

import { useState } from 'react'; 
import InviteForm from '../forms/invite_user';
import { useAuth } from '../hooks/useAuth';
import type { UserData } from '../services/users';
import { useUsers } from '../hooks/useUsers';
import { useNavigate } from 'react-router-dom';

// component count query
const FoundCount = ({ count }: { count: number }) => {
  return (
    <div className='content-item-count-container'>
        <p className='content-item-count-text'> Найдено: </p>
        <p className='content-item-count-text' id="count"> {count} </p>
    </div>
  )
}
  
// user card component
const UserCard = ({ 
  user, 
  onInvite 
}: { 
  user: UserData; 
  onInvite: (user: UserData) => void;
}) => {
  // meta info in profile
  const metaInfo = [
    user.realName,
    user.age && `${user.age} лет`,
    user.city,
    user.workplace
  ].filter(Boolean);

  // for tag generate
  const skills: string[] = user.hardSkills || [];
  
  // logic invite button disabled
  const { isAuthenticated, userId } = useAuth();
  const canInvite = isAuthenticated && userId !== user.userId;

  // navigate logic click user card and route
  const navigate = useNavigate(); 
  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.invite-button')) {
      return;
    }
    
    if (user.userId === userId) {
      navigate('/profile');
    } else {
      navigate(`/users/${user.userId}`);
    }
  };

  return (
    <div className='user-card-container' onClick={handleCardClick}>
      <div className='info-place-container'>
        <div className='avatar-container'>
          <img className='avatar-ico' src={user.avatarUrl}/>
        </div>
        <div className='info-container'>
          <div className='nickname-row'>
            <p className='nickname-text'>{user.nickname}</p>
            {metaInfo.length > 0 && (
              <div className='meta-info'>
                {metaInfo.map((item, index) => (
                  <>
                    {index > 0 && <div className='meta-separator'/>}
                    <p className='meta-item'>{item}</p>
                  </>
                ))}
              </div>
            )}
          </div>
          <p className='role-text'>{user.profileRole || 'Нет указанной роли'}</p>
          {user.isOnline ? (
            <div className='online-container'>
              <div className='circle-online'></div>
              <p className='online-text'>Онлайн</p>
            </div>
          ) : (
            <p className='online-text offline'>Был(а) {user.lastSeen}</p>
          )}
        </div>
      </div>

      <div className='tag-place-container'>
        {skills.length === 0 ? (
          <div className='tag-item empty'>
            <p className='tag-text empty'>Нет указанных ключевых навыков</p>
          </div>
        ) : (
          skills.slice(0, 7).map((skill, index) => (
            <div key={index} className='tag-item'>
              <p className='tag-text'>{skill}</p>
            </div>
          ))
        )}
        {skills.length > 7 && (
          <div className='tag-item more-tag'>
            <p className='tag-text'>+{skills.length - 7}</p>
          </div>
        )}
      </div>

      <div className='invite-place-container'>
        <button className='invite-button' disabled={!canInvite} onClick={() => onInvite(user)}>
          Пригласить
        </button>
        <p className='project-count-text'>Активность в 0 проектах</p>
      </div>
    </div>
  )
}

// fount content column
const FoundContent = () => {
  const { users } = useUsers();
  const [invitingUser, setInvitingUser] = useState<UserData | null>(null);

  return (
    <div className='found-content-container'>
      <FoundCount count={users.length} />
      <div className='content-item-container'>
        {users.length === 0 ? (
          <>
            <NotFoundContentIcon className='content-zero-ico'/>
            <p className='content-zero-text'>
              Упс! Кажется, здесь пока пусто.<br/>
              Попробуй другой запрос
            </p>
          </>
        ) : (
          users.map(user => (
            <UserCard key={user.userId} user={user} onInvite={setInvitingUser} />
          ))
        )}
      </div>

      {invitingUser && (
        <InviteForm
          onClose={() => setInvitingUser(null)}
          invitedUser={invitingUser}            
        />
      )}

    </div>
  )
}

export default function QueryContent () {
  return <FoundContent />
}