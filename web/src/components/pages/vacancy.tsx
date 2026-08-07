import './template_search.scss'
import './vacancy.scss'

import NotFoundContentIcon from '@icons/not_found_content.svg?react'

import { useState, useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { vacanciesApi } from '../services/vacancy'
import { VacancyCard } from '../common/vacancyCard'
import Search from '../common/search'

const FoundCount = ({ count }: { count: number }) => (
  <div className='content-item-count-container'>
    <p className='content-item-count-text'> Найдено: </p>
    <p className='content-item-count-text' id="count"> {count} </p>
  </div>
)

export default function Vacancy() {
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [searchField, setSearchField] = useState('name')
  const [sortField, setSortField] = useState('date')
  const [isSortUp, setIsSortUp] = useState(true)

  const { data: vacancies = [] } = useQuery({
    queryKey: [...queryKeys.vacancies.allList(), appliedSearch, searchField, sortField, isSortUp],
    queryFn: () => vacanciesApi.getAll({
      search: appliedSearch,
      searchField,
      sortField,
      sortAsc: isSortUp,
    }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })

  const filteredVacancies = useMemo(() => {
    let result = [...vacancies]

    const query = appliedSearch.trim().toLowerCase()
    if (query) {
      result = result.filter(v => {
        if (searchField === 'name') {
          return v.title?.toLowerCase().includes(query)
        }
        if (searchField === 'tag') {
          return v.requiredTags?.some(tag => tag.toLowerCase().includes(query))
        }
        if (searchField === 'project') {
          return v.projectTitle?.toLowerCase().includes(query)
        }
        return true
      })
    }

    result.sort((a, b) => {
      let compare = 0
      if (sortField === 'date') {
        compare = new Date(a.publishedAt ?? 0).getTime() - new Date(b.publishedAt ?? 0).getTime()
      }
      else if (sortField === 'alphabet') {
        compare = (a.title || '').localeCompare(b.title || '')
      }
      else if (sortField === 'count') {
        compare = (a.ratingCount ?? 0) - (b.ratingCount ?? 0)
      }
      else if (sortField === 'activity') {
        compare = (a.membersCount ?? 0) - (b.membersCount ?? 0)
      }
      return isSortUp ? compare : -compare
    })

    return result
  }, [vacancies, appliedSearch, searchField, sortField, isSortUp])

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
              <VacancyCard key={vacancy.vacancyId} vacancy={vacancy} />
            ))
          )}
        </div>
      </div>
    </>
  )
}