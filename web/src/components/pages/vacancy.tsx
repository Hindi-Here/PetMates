import './template_search.scss'
import './vacancy.scss'

import NotFoundContentIcon from '@icons/not_found_content.svg?react'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { vacanciesApi } from '../services/vacancy'
import { VacancyCard } from '../common/vacancyCard'

const FoundCount = ({ count }: { count: number }) => (
  <div className='content-item-count-container'>
    <p className='content-item-count-text'> Найдено: </p>
    <p className='content-item-count-text' id="count"> {count} </p>
  </div>
)

const FoundContent = () => {
  
  const { 
    data: vacancies = []
  } = useQuery({
    queryKey: queryKeys.vacancies.allList(),
    queryFn: () => vacanciesApi.getAll(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  return (
    <div className='found-content-container'>

      <FoundCount count={vacancies.length} />
      
      <div className='content-item-container'>
        {vacancies.length === 0 ? (
          <>
            <NotFoundContentIcon className='content-zero-ico' />
            <p className='content-zero-text'>
              Упс! Кажется, здесь пока пусто.<br />
              Попробуй другой запрос
            </p>
          </>
        ) : (
          vacancies.map(vacancy => (
            <VacancyCard key={vacancy.vacancyId} vacancy={vacancy} />
          ))
        )}
      </div>
    </div>
  )
}

export default function QueryContent() { 
  return <FoundContent /> 
}