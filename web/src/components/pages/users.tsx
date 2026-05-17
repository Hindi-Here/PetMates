import './template_search.scss'
import './users.scss'

import NotFoundContentIcon from '@icons/not_found_content.svg?react'

import { useState, useEffect, useRef } from 'react'; 
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

  // only one row meta
  const rowRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(metaInfo.length);

  useEffect(() => {
  const row = rowRef.current;
  if (!row) return;

  requestAnimationFrame(() => {
    if (!row) return;
    
    const rowWidth = row.clientWidth;
    const nickEl = row.querySelector('.nickname-text') as HTMLElement;
    if (!nickEl) return;

    let usedWidth = nickEl.offsetWidth + 12;
    let count = 0;

    const items = row.querySelectorAll('.meta-item') as NodeListOf<HTMLElement>;
    const separators = row.querySelectorAll('.meta-separator') as NodeListOf<HTMLElement>;

    items.forEach((item, i) => {
      const sepWidth = i > 0 ? (separators[i - 1]?.offsetWidth ?? 0) + 8 : 0;
      usedWidth += item.offsetWidth + 8 + sepWidth;
      if (usedWidth <= rowWidth) count++;
    });

    setVisibleCount(count);
  });
}, [metaInfo]);

// only one row tags
const tagRowRef = useRef<HTMLDivElement>(null);
const [visibleTagCount, setVisibleTagCount] = useState(skills.length);

useEffect(() => {
  const row = tagRowRef.current;
  if (!row) return;

  requestAnimationFrame(() => {
    if (!row) return;

    const rowWidth = row.clientWidth - 32;
    let usedWidth = 0;
    let count = 0;

    const items = row.querySelectorAll('.tag-item:not(.more-tag)') as NodeListOf<HTMLElement>;

    items.forEach((item) => {
      usedWidth += item.offsetWidth + 8;
      if (usedWidth <= rowWidth) count++;
    });

    if (count < skills.length) {
      const moreTag = row.querySelector('.more-tag') as HTMLElement;
      const moreWidth = moreTag ? moreTag.offsetWidth + 8 : 50;

      let recalc = 0;
      usedWidth = 0;
      items.forEach((item) => {
        usedWidth += item.offsetWidth + 8;
        if (usedWidth + moreWidth <= rowWidth) recalc++;
      });
      count = recalc;
    }

    setVisibleTagCount(count);
  });
}, [skills]);

  return (
    <div className='user-card-container' onClick={handleCardClick}>
      <div className='info-place-container'>
        <div className='avatar-container'>
          <img className='avatar-ico' src={user.avatarUrl}/>
        </div>
        <div className='info-container'>
          <div className='nickname-row' ref={rowRef}>
            <p className='nickname-text'>{user.nickname}</p>
            {visibleCount > 0 && (
            <div className='meta-info'>
              {metaInfo.slice(0, visibleCount).map((item, index) => (
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

      <div className='tag-place-container' ref={tagRowRef}>
  {skills.length === 0 ? (
    <div className='tag-item empty'>
      <p className='tag-text empty'>Нет указанных ключевых навыков</p>
    </div>
  ) : (
    <>
      {skills.map((skill, index) => (
        <div 
          key={index} 
          className='tag-item'
          style={index >= visibleTagCount ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' } : {}}
        >
          <p className='tag-text'>{skill}</p>
        </div>
      ))}
      <div
        className='tag-item more-tag'
        style={visibleTagCount >= skills.length ? { position: 'absolute', visibility: 'hidden', pointerEvents: 'none' } : {}}
      >
        <p className='tag-text'>+{skills.length - visibleTagCount}</p>
      </div>
    </>
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
  const [showInviteForm, setShowInviteForm] = useState<UserData | null>(null);

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
            <UserCard key={user.userId} user={user} onInvite={setShowInviteForm} />
          ))
        )}
      </div>

      {showInviteForm && (
        <InviteForm
          onClose={() => setShowInviteForm(null)}
          invitedUser={showInviteForm}            
        />
      )}

    </div>
  )
}

export default function QueryContent () {
  return <FoundContent />
}