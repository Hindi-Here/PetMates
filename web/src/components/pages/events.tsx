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
  const [searchField, setSearchField] = useState('name')
  const [sortField, setSortField] = useState('date')
  const [isSortUp, setIsSortUp] = useState(true)

  const count = 0

  return (
    <>
      <Search
        activeId='events'
        searchValue={searchInput}
        onSearchValueChange={setSearchInput}
        onSearchSubmit={() => {}}
        selectedSearchId={searchField}
        onSearchFieldSelect={setSearchField}
        selectedSortId={sortField}
        onSortFieldSelect={setSortField}
        isSortUp={isSortUp}
        onToggleSortDirection={() => setIsSortUp(prev => !prev)}
        showBannedFilter={false}
        showBannedOnly={false}
        onToggleShowBannedOnly={() => {}}
        showStaffFilter={false}
        showStaffOnly={false}
        onToggleShowStaffOnly={() => {}}
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