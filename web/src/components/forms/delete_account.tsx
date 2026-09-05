import './delete_account.scss'
import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import ImportantWarningIcon from '@icons/important_warning.svg?react'
import InfoIcon from '@icons/info_circle.svg?react'

import { useState, useEffect, useMemo, useRef } from 'react';
import { useBlockScroll, useChangeInput, validatorFormat } from '../scripts/function';
import { useAuth } from '../hooks/useAuth';
import { usersApi } from '../services/users';
import { settingApi } from '../services/setting';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/cfg';

const Form = ({ onClose }: any) => {
  const navigate = useNavigate();
  const { userId: currentUserId } = useAuth();
  const [step, setStep] = useState(1);
  const [currentNickname, setCurrentNickname] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, handleChange } = useChangeInput({
    name: '',
    confirmCode: ''
  }, {});

  useEffect(() => {
    const fetchUserNickname = async () => {
      if (!currentUserId) return;
      try {
        const userData = await usersApi.getUserById(currentUserId);
        setCurrentNickname(userData?.nickname || '');
      } catch (error) {
        console.error('Ошибка получения данных пользователя:', error);
      }
    };
    fetchUserNickname();
  }, [currentUserId]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const isInvalid = useMemo(() => {
    if (step === 1) {
      return !validatorFormat.required(data.name);
    }
    if (step === 2) {
      return !validatorFormat.required(data.confirmCode);
    }
    return false;
  }, [step, data.name, data.confirmCode]);

  const next = async () => { 
    if (step === 1) {
      if (currentNickname && data.name.trim().toLowerCase() !== currentNickname.trim().toLowerCase()) {
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        
        setNicknameError('Введённый никнейм не совпадает с текущим');
        
        errorTimerRef.current = setTimeout(() => setNicknameError(null), 3000);
        return;
      }
      
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      setNicknameError(null);
      setStep(X => X + 1);
    } else if (step < 3) {
      setStep(X => X + 1);
    } else {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        await settingApi.deleteAccount(data.name);
        await supabase.auth.signOut();
        navigate('/', { replace: true });
      } catch (error: any) {
        setErrorMessage(error.message || 'Не удалось удалить аккаунт');
        setIsLoading(false);
      }
    }
  };

  const back = () => { 
    if (step > 1) setStep(X => X - 1); 
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(e);
    if (nicknameError) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      setNicknameError(null);
    }
  };

  return (
    <div className='form-container'> 
      <div className='form-header-container red'>
        <ImportantWarningIcon className='form-header-ico'/>
        <p className='form-header-text'> Удаление аккаунта </p>
        <button className='form-header-close-button red' onClick={onClose}>
          <RejectIcon className='form-header-close-ico' />
        </button>
      </div>

      <div className='form-content-container'>
        <div className='form-steps-container'>
          <div className={`form-step-container ${step > 1 ? 'active' : ''}`}>
            <p className='form-step-number'> 1 </p>
          </div>
          <div className={`form-step-container ${step > 2 ? 'active' : ''}`}>
            <p className='form-step-number' id='middle'> 2 </p>
          </div>
          <div className={`form-step-container ${step > 3 ? 'active' : ''}`}>
            <p className='form-step-number'> 3 </p>
          </div>
        </div>

        {step === 1 && (
          <div className='form-field-container'>
            <p className='form-field-text'> Введите ваше имя пользователя </p>
            <input 
              className={`form-field-input red ${nicknameError ? 'input-error' : ''}`} 
              name='name' 
              maxLength={50} 
              value={data.name} 
              onChange={handleNameChange}
            />
            <div className="form-field-helper-container">
              <InfoIcon className='form-field-helper-ico'/>
              <p className="form-field-helper-text"> Это поможет убедиться, что вы удаляете именно свой аккаунт </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className='form-field-container'>
            <p className='form-field-text'> Введите код подтверждения </p>
            <input 
              className='form-field-input red' 
              name='confirmCode' 
              value={data.confirmCode} 
              onChange={handleChange}
            />
            <div className="form-field-helper-container">
              <InfoIcon className='form-field-helper-ico'/>
              <p className="form-field-helper-text"> Это подтвердит подлинность владения аккаунтом </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className='form-info-container'>
            <p className='form-info-text'> 
              <span className='form-info-text-title'> Вы действительно хотите удалить этот аккаунт? </span> <br/> <br/>
              <span className='form-info-text-description'> Это действие необратимо. Ваша учетная запись, созданные проекты и личные данные будут удалены навсегда </span> 
            </p>
            {errorMessage && (
              <p className='form-info-text-description error-text'>
                {errorMessage}
              </p>
            )}
          </div>
        )}

        <div className='form-manage'>
          <button 
            className='form-manage-button red' 
            onClick={next} 
            disabled={isInvalid || isLoading}
          > 
            Удалить
          </button>
          {step > 1 && !isLoading && (
            <button className='form-manage-button back' onClick={back}>
              Назад
            </button>
          )}
          {!isLoading && (
            <button className='form-manage-button cancellation' onClick={onClose}> Отмена </button>
          )}
        </div>

        {nicknameError && (
          <p className='save-error-text message-auto-hide'>{nicknameError}</p>
        )}
      </div>
    </div>
  )
}

export default function DeleteAccountForm({ onClose }: any) {
  useBlockScroll(true);
  return (
     <div className='dark-area-container' onClick={onClose}> 
        <div onClick={(e) => e.stopPropagation()}>
            <Form onClose={onClose}/>
        </div>
    </div>
  )
}