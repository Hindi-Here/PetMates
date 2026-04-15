import VkIcon from '@icons/vk.svg?react'
import TelegramIcon from '@icons/telegram.svg?react'
import OdnoklassnikiIcon from '@icons/odnoklassniki.svg?react'

import './footer.scss'

export default function Footer() {
  return (
    <div className='footer'>
      <div className="contact-container">
        <div className='social-container'>
          <p> Социальные сети: </p>
          <VkIcon className='social-ico'></VkIcon>
          <TelegramIcon className='social-ico'></TelegramIcon>
          <OdnoklassnikiIcon className='social-ico'></OdnoklassnikiIcon>
        </div>
        <div className="mail-container">
          <p> E-mail: </p>
          <p id="mail"> petmates@yandex.ru </p>
        </div>
      </div>
    </div>
  )
}