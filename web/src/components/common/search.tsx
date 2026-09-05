import DropdownIcon from '@icons/dropdown.svg?react'
import SearchIcon from '@icons/search.svg?react'
import SortUpIcon from '@icons/sort_up.svg?react'
import SortDownIcon from '@icons/sort_down.svg?react'
import CheckIcon from '@icons/accept.svg?react'

import './search.scss'
import { Dropdown } from './dropdown';
import { useIsOpen } from '../scripts/function';

export interface SearchOption {
  id: string;
  label: string;
}

export const tabOpt: Record<string, { searchOpt: SearchOption[]; sortOpt: SearchOption[] }> = {
  vacancy: {
    searchOpt: [
      { id: 'name', label: 'Названию' },
      { id: 'tag', label: 'Тегу' },
      { id: 'author', label: 'Автору' },
      { id: 'project', label: 'Проекту' }
    ],
    sortOpt: [
      { id: 'date', label: 'Дате добавления' },
      { id: 'alphabet', label: 'Алфавиту' },
      { id: 'count', label: 'Количеству оценок' },
      { id: 'activity', label: 'Активности' }
    ]
  },
  events: {
    searchOpt: [
      { id: 'name', label: 'Названию' },
      { id: 'tag', label: 'Тегу' },
      { id: 'author', label: 'Автору' }
    ],
    sortOpt: [
      { id: 'date', label: 'Дате добавления' },
      { id: 'alphabet', label: 'Алфавиту' },
      { id: 'count', label: 'Количеству оценок' },
      { id: 'count_users', label: 'Количеству участников' }
    ]
  },
  users: {
    searchOpt: [
      { id: 'name', label: 'Названию' },
      { id: 'tag', label: 'Тегу' },
      { id: 'role', label: 'Роли' }
    ],
    sortOpt: [
      { id: 'date', label: 'Дате регистрации' },
      { id: 'alphabet', label: 'Алфавиту' },
      { id: 'activity', label: 'Активности' },
      { id: 'project_count', label: 'Количеству проектов' },
      { id: '_count', label: 'Количеству оценок' }
    ]
  }
};

interface SearchProps {
  activeId: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
  selectedSearchId: string;
  onSearchFieldSelect: (id: string) => void;
  selectedSortId: string;
  onSortFieldSelect: (id: string) => void;
  isSortUp: boolean;
  onToggleSortDirection: () => void;
  showBannedFilter?: boolean; 
  showBannedOnly: boolean;
  onToggleShowBannedOnly: () => void;
  showStaffFilter?: boolean;
  showStaffOnly: boolean;
  onToggleShowStaffOnly: () => void;
}

export default function Search({
  activeId,
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  selectedSearchId,
  onSearchFieldSelect,
  selectedSortId,
  onSortFieldSelect,
  isSortUp,
  onToggleSortDirection,
  showBannedFilter = false,
  showBannedOnly,
  onToggleShowBannedOnly,
  showStaffFilter = false,
  showStaffOnly,
  onToggleShowStaffOnly,
}: SearchProps) {
  const { isOpen: isSearchDropdownOpen, setIsOpen: setIsNameDropdownOpen, menuRef: searchMenuRef } = useIsOpen();
  const { isOpen: isSortDropdownOpen, setIsOpen: setIsDateDropdownOpen, menuRef: sortMenuRef } = useIsOpen();

  const currentOpt = tabOpt[activeId] || tabOpt['vacancy'];
  const selectedSearch = currentOpt.searchOpt.find(o => o.id === selectedSearchId) ?? currentOpt.searchOpt[0];
  const selectedSort = currentOpt.sortOpt.find(o => o.id === selectedSortId) ?? currentOpt.sortOpt[0];

  const handleSearchSelect = (item: SearchOption) => {
    onSearchFieldSelect(item.id);
    setIsNameDropdownOpen(false);
  };

  const handleSortSelect = (item: SearchOption) => {
    onSortFieldSelect(item.id);
    setIsDateDropdownOpen(false);
  };

  return (
    <div className="search-content-container">
      <div className="search-line-container">
        <div className="search-input-container">
          <SearchIcon className='search-ico' />
          <input
            className="search-input"
            placeholder="Поиск"
            value={searchValue}
            onChange={(e) => onSearchValueChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearchSubmit() }}
          />
        </div>
        <div className="search-button-container">
          <button className="search-button" onClick={onSearchSubmit}>Поиск</button>
        </div>
      </div>
      <div className="sort-line-container">
        <div className='sort-group-container'>
          <div ref={searchMenuRef} className={`sort-type-container ${isSearchDropdownOpen ? 'active' : ''}`} onClick={() => setIsNameDropdownOpen(!isSearchDropdownOpen)}>
            <p className='sort-type-text'>По {selectedSearch?.label.toLowerCase()}</p>
            <DropdownIcon className={`sort-type-dropdown-ico ${isSearchDropdownOpen ? 'rotated' : ''}`} />
          </div>
          <Dropdown isOpen={isSearchDropdownOpen} items={currentOpt.searchOpt} onSelect={handleSearchSelect} />
        </div>
        <div className='sort-group-container'>
          <div ref={sortMenuRef} className={`sort-type-container ${isSortDropdownOpen ? 'active' : ''}`} onClick={() => setIsDateDropdownOpen(!isSortDropdownOpen)}>
            <p className='sort-type-text'>Сортировка по {selectedSort?.label.toLowerCase()}</p>
            <DropdownIcon className={`sort-type-dropdown-ico ${isSortDropdownOpen ? 'rotated' : ''}`} />
          </div>
          <Dropdown isOpen={isSortDropdownOpen} items={currentOpt.sortOpt} onSelect={handleSortSelect} />
        </div>
        <div className='sort-vector-ico-container' onClick={onToggleSortDirection}>
          {isSortUp ? (<SortUpIcon className='sort-vector-ico' />) : (<SortDownIcon className='sort-vector-ico' />)}
        </div>
        {showStaffFilter && (
        <div className={`staff-filter-container ${showStaffOnly ? 'active' : ''}`} onClick={onToggleShowStaffOnly}>
          <div className='staff-filter-checkbox'>
            {showStaffOnly && <CheckIcon className='staff-filter-check-ico' />}
          </div>
          <p className='staff-filter-text'>Модерация</p>
        </div>
        )}
        {showBannedFilter && (
        <div className={`banned-filter-container ${showBannedOnly ? 'active' : ''}`} onClick={onToggleShowBannedOnly}>
          <div className='banned-filter-checkbox'>
            {showBannedOnly && <CheckIcon className='banned-filter-check-ico' />}
          </div>
          <p className='banned-filter-text'>Заблокированные</p>
        </div>
        )}
      </div>
    </div>
  )
}