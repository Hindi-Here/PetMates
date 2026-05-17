import InfoIcon from '@icons/info_circle.svg?react'

import './bug.scss'
import { validatorFormat, useChangeInput } from '../scripts/function';
import {useAuth} from '../hooks/useAuth'

export default function Bug () {
  const { isAuthenticated } = useAuth();
  const { data, handleChange } = useChangeInput({ report: '',},{});
  const isInvalid = validate(data);

  return (
    <div className='bug-container'>
        <div className='about-section-container'>
            <p className='about-title'> Помощь в тестировании и обратная связь </p>
            <p className='about-description'>
                PetMates — это платформа для поиска единомышленников в pet-проекты. Символично, но мы сами являемся <em>pet-проектом</em>.
            </p>
            <p className='about-description'>
                Поэтому нам очень важен ваш опыт взаимодействия с платформой и мнение. Это позволит нам расти и становиться лучше.
            </p>
            <p className='about-description'>
                Этот раздел предназначен для нашей с вами связи.
            </p>
        </div>
        <div className='about-section-container'> 
            <p className='about-title'> Github репозиторий </p>
             <p className='about-description'>
                PetMates является <em>open-source</em> проектом, код которого полностью доступен любому для изучения и доработки.
            </p>
            <p className='about-description'>
                Мы приветствуем предложения по улучшению программной логики или архитектуры нашей платформы.
            </p>
            <p className='about-description'>
                Нашли баг, проблему с оптимизацией или уязвимость? Или у вас есть крутая идея? Зафиксируйте это в GitHub Issues
                нашего <span className='about-description-link'><a href='https://github.com/Hindi-Here/PetMates' target='_blank' rel='noreferrer'> репозитория</a></span>.
            </p>
        </div>
        <div className='about-section-container'> 
            <p className='about-title'> Как с нами связаться </p>
            <p className='about-description'>
                Для связи с нами вы можете воспользоваться одним из нескольких способов:
            </p>
            <p className='about-description'>
                1. <strong>Форма обратной связи:</strong> Напишите нам прямо здесь. Сообщение мгновенно поступит в наш рабочий чат.
            </p>
            <p className='about-description'>
                2. <strong>Социальные сети:</strong> Мы на связи в <span className='about-description-link'><a href=''>ВК</a></span>, 
                <span className='about-description-link'><a href=''> Telegram</a></span> и 
                <span className='about-description-link'><a href=''> Одноклассники</a></span>.
                Пишите в личные сообщения сообществ и следите за новостями.
            </p>
            <p className='about-description'>
                3. <strong>Электронная почта:</strong> Наша официальная <span className='about-description-link'><a href=''>почта</a></span> для официальных запросов или объемных писем.
            </p>
        </div>
        <div className='about-section-container'>
            <p className='about-title'> Форма отправки сообщения </p>
            <p className='about-description'>
                Ниже предоставлена форма, через которую вы можете отправить нам свое мнение. Если вы нашли какой-то баг, уязвимость или неточность — смело обращайтесь к нам.
            </p>
            <p className='about-description'>
                Вы можете оставить свое сообщение <em>анонимным</em>, если вы не авторизованы. Если сообщение не является анонимным и оно нас заинтересовало — мы можем связаться с вами.
            </p>
            <textarea className='send-area' name='report' value={data.report} onChange={handleChange}></textarea>
            <div className='send-manage-container'>
                <button className='send-manage-button' disabled={isInvalid}> Отправить </button>
                <input type="checkbox" className='send-anonymous-box' checked={!isAuthenticated ? false : undefined} disabled={!isAuthenticated}/>
                <p className='send-anonymous-text'> Анонимное сообщение </p>
                <div className="send-anonymous-helper-container">
                    <InfoIcon className='send-anonymous-helper-ico'/>
                    <p className='send-anonymous-helper-text'> Оставьте активным, если хотите, чтобы ваше сообщение было анонимным </p>
                </div>
            </div>
        </div>
    </div>
  )
}

const validate = (data: any): boolean => {
  return !validatorFormat.required(data.report)
};