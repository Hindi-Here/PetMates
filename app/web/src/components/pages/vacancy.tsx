import NotFoundContentIcon from '@icons/not_found_content.svg?react'

import './vacancy.scss'

const FoundCount = ({ count }: { count: number }) => {
  return (
    <div className='content-item-count-container'>
        <p className='content-item-count-text'> Найдено: </p>
        <p className='content-item-count-text' id="count"> {count} </p>
    </div>
  )
}

const FoundContent = () => {
  const count = 0;

  return (
    <div className='found-content-container'>
        <FoundCount count={count} />
        <div className='content-item-container'>
            {count === 0 ? (
                <>
                    <NotFoundContentIcon className='content-zero-ico'/>
                    <p className='content-zero-text'> Упс! Кажется, здесь пока пусто. <br/> Попробуй другой запрос </p>
                </>
            ): ('')}
        </div>
    </div>
  )
}

export default function QueryContent () {

  return (
    <FoundContent></FoundContent>
  )
}