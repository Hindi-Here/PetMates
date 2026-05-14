import './authorization.scss'
import './template_form.scss'
import RejectIcon from '@icons/reject.svg?react'
import InfoIcon from '@icons/info_circle.svg?react'
import RegisterIcon from '@icons/register.svg?react'
import SignIcon from '@icons/sign.svg?react'

import GoogleColorIcon from '@icons/google_color.svg?react'
import GithubColorIcon from '@icons/github_color.svg?react'
import TwitchColorIcon from '@icons/twitch_color.svg?react'

import { useEffect, useState } from 'react'
import { useBlockScroll, useChangeInput, validatorFormat, validatorRegex } from '../scripts/function'

import { authApi } from '../services/auth';

const Form = ({ onClose }: any) => {
  // switching between registration and login state
  const [isRegister, setIsRegister] = useState(true);
  // state for error type
  const [error, setError] = useState<string | null>(null);

  // regex field validate (level 2)
  const { data, touched, dirty, handleChange, handleBlur } = useChangeInput({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      rememberMe: false
    },
    {
      /* rules input */
      name: validatorRegex.username,
      email: validatorRegex.email, 
      password: validatorRegex.password, 
      confirmPassword: validatorRegex.password,
    }
  );

  // check on disabled for button (level 1)
  const isInvalid = !checkForm(data, isRegister);

  useEffect(() => {
    setError(null);
  }, [isRegister]);

  return (
    <div className='form-container'> 

        <div className='form-header-container'>
            {isRegister ? <RegisterIcon className='form-header-ico'/> : <SignIcon className='form-header-ico'/>}
            <p className='form-header-text'> 
            {isRegister ? 'Регистрация аккаунта' : 'Вход в аккаунт'} 
            </p>
            <button className='form-header-close-button' onClick={onClose}>
                <RejectIcon className='form-header-close-ico' />
            </button>
        </div>

        <div className='form-content-container'>
            {isRegister && (
            <div className='form-field-container'>
                <p className='form-field-text'> Имя пользователя </p>
                <input className={`form-field-input ${touched.name && dirty.name && checkFormat('name', data.name, data, isRegister) ? 'input-error' : ''}`}
                    name='name'
                    maxLength={50}
                    value={data.name}
                    onChange={handleChange}
                    onBlur={handleBlur}/>
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Имя пользователя должно быть от 3 до 50 символов </p>
                </div>
            </div>
            )}
            <div className='form-field-container'>
                <p className='form-field-text'> Email </p>
                <input className={`form-field-input ${touched.email && dirty.email && checkFormat('email', data.email, data, isRegister) ? 'input-error' : ''}`}
                    name='email'
                    maxLength={255}
                    value={data.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder='example@mail.su'/>
            </div>
            <div className='form-field-container'>
                <p className='form-field-text'> Пароль </p>
                <input className={`form-field-input ${touched.password && dirty.password && checkFormat('password', data.password, data, isRegister) ? 'input-error' : ''}`}
                    type='password'
                    name='password'
                    maxLength={255}
                    value={data.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder='!78uf_Hr93*'/>
                {isRegister && (
                <div className="form-field-helper-container">
                    <InfoIcon className='form-field-helper-ico'/>
                    <p className="form-field-helper-text"> Пароль должен содержать не менее 8 символов, включая цифры, буквы, спец. символы </p>
                </div>
                )}
                {!isRegister && (
                <div className="form-field-forgot-password-container">
                    <p className='form-field-forgot-password-text'>Забыли пароль?</p>
                </div>
                )}
            </div>
            {isRegister && (
            <div className='form-field-container'>
                <p className='form-field-text'> Подтверждение пароля </p>
                <input className={`form-field-input ${touched.confirmPassword && dirty.confirmPassword && checkFormat('confirmPassword', data.confirmPassword, data, isRegister) ? 'input-error' : ''}`}
                    type='password'
                    name='confirmPassword'
                    maxLength={255}
                    value={data.confirmPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}/>
            </div>
            )}
            <div className='form-remember-me-container'>
                <input type="checkbox" className='form-remember-me-checkbox' name='rememberMe' checked={data.rememberMe} onChange={handleChange}/>
                <p className='form-remember-me-text'>Запомнить меня на этом устройстве </p>
            </div>
            <div className='form-complete-container'>
                <button className='form-complete-button'
                        disabled={isInvalid}
                        onClick={isRegister ? () => Register(data, setError, onClose) : () => Login(data, setError, onClose)}>
                    {isRegister ? <RegisterIcon className='form-header-ico' /> : <SignIcon className='form-header-ico' />}
                    {isRegister ? 'Зарегистрироваться' : 'Войти'}
                </button>
                {error && <p className='complete-error-type'>{error}</p>}
            </div>
        </div>

        <div className='auth-service-container'>
            <div className='auth-service-separator-container'>
                <p className='auth-service-separator-text'> или </p>
            </div>
            <div className='auth-service-items-container'>
                <div className='auth-service-item-container' onClick={GoogleLogin}>
                    <GoogleColorIcon className='auth-service-item-ico google'/>
                    <p className='auth-service-item-text'> Google </p>
                </div>
                <div className='auth-service-item-container' onClick={GitHubLogin}>
                    <GithubColorIcon className='auth-service-item-ico git'/>
                    <p className='auth-service-item-text'> Github </p>
                </div>
                <div className='auth-service-item-container' onClick={TwitchLogin}>
                    <TwitchColorIcon className='auth-service-item-ico twitch'/>
                    <p className='auth-service-item-text'> Twitch </p>
                </div>
            </div>
        </div>

        <div className='auth-change-format-container'>
            <p className='auth-change-format-text'> 
            {isRegister ? 'Уже есть аккаунт?' : 'Еще нет аккаунта?'} 
            </p>
            <p className='auth-change-format-link' onClick={() => setIsRegister(!isRegister)}> 
            {isRegister ? 'Войти' : 'Зарегистрироваться'} 
            </p>
        </div>
    </div>
  )
}

export default function AuthorizationForm({ onClose }: any) { {/* onClose - you can close outside */}
  useBlockScroll(true); 
  return (
     <div className='dark-area-container' onClick={onClose}> 
        <div onClick={(e) => e.stopPropagation()}> {/* do not close when clicking on the form */}
            <Form onClose={onClose}/>
        </div>
    </div>
  )
}



// validate format and color support (level 1)
const checkFormat = (fieldName: string, value: string, data: any, isRegister: boolean): string | null => {
  
  const isLogin = !isRegister;
  
  const rules: Record<string, Array<[boolean, string]>> = {
    name: [
      [!validatorFormat.required(value), 'Введите имя'],
      [!validatorFormat.minLength(value, 3), 'Минимум 3 символа'],
      [!validatorFormat.maxLength(value, 50), 'Максимум 50 символов']
    ],
    email: [
      [!validatorFormat.required(value), 'Введите email'],
      [!isLogin && !validatorFormat.email(value), 'Неверный формат email'],
      [!validatorFormat.maxLength(value, 255), 'Слишком длинный email']
    ],
    password: [
      [!validatorFormat.required(value), 'Введите пароль'],
      [!isLogin && !validatorFormat.minLength(value, 8), 'Минимум 8 символов'],
      [!isLogin && !validatorFormat.maxLength(value, 255), 'Слишком длинный пароль'],
      [!isLogin && !validatorFormat.password(value), 'Пароль должен содержать буквы, цифры и спец. символы']
    ],
    confirmPassword: [
      [isRegister && !validatorFormat.required(value), 'Подтвердите пароль'],
      [isRegister && value !== data.password, 'Пароли не совпадают']
    ]
  };

  const fieldRules = rules[fieldName];
  if (!fieldRules) return null;
  
  const error = fieldRules.find(([isInvalid]) => isInvalid);
  return error?.[1] ?? null;
};

const checkForm = (data: any, isRegister: boolean): boolean => {
  if (!isRegister) {
    return (
      validatorFormat.required(data.email) && 
      validatorFormat.required(data.password)
    );
  }

  return (
    validatorFormat.required(data.name) &&
    validatorFormat.minLength(data.name, 3) &&
    validatorFormat.maxLength(data.name, 50) &&
    
    validatorFormat.required(data.email) &&
    validatorFormat.email(data.email) &&
    
    validatorFormat.required(data.password) &&
    validatorFormat.minLength(data.password, 8) &&
    validatorFormat.password(data.password) &&
    
    validatorFormat.required(data.confirmPassword) &&
    data.password === data.confirmPassword
  );
};

// handle event
// click register event
const Register = async (data: any, onError: (msg: string | null) => void, onClose?: () => void) => {
    onError(null); 
    try {
        await authApi.register(data.name, data.email, data.password);
        onClose?.();
    }
    catch (err: any) {
        const errorMessage = err.message || 'Ошибка регистрации';
        onError(errorMessage);
    }
};
// click login event
const Login = async (data: any, onError: (msg: string | null) => void, onClose?: () => void) => {
    onError(null);
    try {
        await authApi.login(data.email, data.password, data.rememberMe);
        onClose?.();
    }
    catch (err: any) {
        const errorMessage = err.message || 'Неверный email или пароль';
        onError(errorMessage);
    }
};
// github login event
const GitHubLogin = async () => {
    try{
    await authApi.signInWithGitHub();
    } catch (error) {
        console.error('Ошибка при входе через GitHub:', error);
    }
};
// google login event
const GoogleLogin = async () => {
    try {
        await authApi.signInWithGoogle();
    } catch (error) {
        console.error('Ошибка при входе через Google:', error);
    }
};

// twitch login event
const TwitchLogin = async () => {
    try {
        await authApi.signInWithTwitch();
    } catch (error) {
        console.error('Ошибка при входе через Twitch:', error);
    }
};