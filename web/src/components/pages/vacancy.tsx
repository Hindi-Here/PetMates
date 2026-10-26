import './template_search.scss'
import './vacancy.scss'

import NotFoundContentIcon from '@icons/not_found_content.svg?react'

import { useState,  } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { vacanciesApi } from '../services/vacancy'
import { VacancyCard } from '../common/vacancyCard'
import Search from '../common/search'
import { useSystemRole } from '../hooks/useSystemRole'
import { STALE } from '../scripts/query/queryClient'

const FoundCount = ({ count }: { count: number }) => (
  <div className='content-item-count-container'>
    <p className='content-item-count-text'> Найдено: </p>
    <p className='content-item-count-text' id="count"> {count} </p>
  </div>
)

// Компонент страницы со списком вакансий, включая поиск, фильтрацию и сортировку
export default function Vacancy() {
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [searchField, setSearchField] = useState('name')
  const [sortField, setSortField] = useState('date')
  const [isSortUp, setIsSortUp] = useState(true)

  const currentSystemRole = useSystemRole()
  const isStaff = currentSystemRole === 'moderator' || currentSystemRole === 'admin'
  const [showBannedOnly, setShowBannedOnly] = useState(false)

  const { data: vacancies = [] } = useQuery({
    queryKey: [...queryKeys.vacancies.allList(), appliedSearch, searchField, sortField, isSortUp, showBannedOnly],
    queryFn: () => vacanciesApi.getAll({
      search: appliedSearch,
      searchField,
      sortField,
      sortAsc: isSortUp,
      showBannedOnly,
    }),
    staleTime: STALE.medium,
    placeholderData: keepPreviousData,
  })

  const filteredVacancies = vacancies

  return (
    <>
      <Search
        activeId='vacancy'
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearchSubmit={() => setAppliedSearch(searchInput)}
        selectedSearchId={searchField}
        onSearchFieldSelect={setSearchField}
        selectedSortId={sortField}
        onSortFieldSelect={setSortField}
        isSortUp={isSortUp}
        onToggleSortDirection={() => setIsSortUp(prev => !prev)}
        showBannedFilter={isStaff}
        showBannedOnly={showBannedOnly}
        onToggleShowBannedOnly={() => setShowBannedOnly(prev => !prev)}
        showStaffFilter={false}
        showStaffOnly={false}
        onToggleShowStaffOnly={() => {}}
      />

      <div className='found-content-container'>
        <FoundCount count={filteredVacancies.length} />

        <div className='content-item-container'>
          {filteredVacancies.length === 0 ? (
            <>
              <NotFoundContentIcon className='content-zero-ico' />
              <p className='content-zero-text'>
                Упс! Кажется, здесь пока пусто.<br />
                Попробуй другой запрос
              </p>
            </>
          ) : (
            filteredVacancies.map(vacancy => (
              <VacancyCard key={vacancy.vacancyId} vacancy={vacancy} clickable={true}/>
            ))
          )}
        </div>
      </div>
    </>
  )
}