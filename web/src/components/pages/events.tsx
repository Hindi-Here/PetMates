import './template_search.scss'

import NotFoundContentIcon from '@icons/not_found_content.svg?react'
import { useState } from 'react'
import Search from '../common/search'

const FoundCount = ({ count }: { count: number }) => (
  <div className='content-item-count-container'>
    <p className='content-item-count-text'> Найдено: </p>
    <p className='content-item-count-text' id="count"> {count} </p>
  </div>
)

export default function Events() {
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [searchField, setSearchField] = useState('name')
  const [sortField, setSortField] = useState('date')
  const [isSortUp, setIsSortUp] = useState(true)

  // Данных о мероприятиях пока нет — здесь появится useQuery,
  // как только будут готовы EventData/eventsApi/EventCard
  const count = 0

  return (
    <>
      <Search
        activeId='events'
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
        <FoundCount count={count} />
        <div className='content-item-container'>
          {count === 0 && (
            <>
              <NotFoundContentIcon className='content-zero-ico' />
              <p className='content-zero-text'> Упс! Кажется, здесь пока пусто. <br /> Попробуй другой запрос </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}