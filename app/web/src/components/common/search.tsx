import DropdownIcon from '@icons/dropdown.svg?react'
import SearchIcon from '@icons/search.svg?react'
import SortUpIcon from '@icons/sort_up.svg?react'
import SortDownIcon from '@icons/sort_down.svg?react'

import { useState, useEffect } from 'react'
import './search.scss'
import './dropdown.scss'
import Dropdown from './dropdown'
import { useIsOpen } from '../layout/header'

interface SearchProps {
  activeId: string;
}

interface SearchOption {
  id: string;
  label: string;
}

export default function Search ({ activeId }: SearchProps) {
  const [isSortUp, setIsSortUp] = useState(true);
  const setSort = () => setIsSortUp(prev => !prev);

  const { isOpen: isNameDropdownOpen, setIsOpen: setIsNameDropdownOpen, menuRef: nameMenuRef } = useIsOpen();
  const { isOpen: isDateDropdownOpen, setIsOpen: setIsDateDropdownOpen, menuRef: dateMenuRef } = useIsOpen();

  const tabOptions: Record<string, { searchOptions: SearchOption[]; sortOptions: SearchOption[] }> = {
    vacancy: {
      searchOptions: [
        { id: 'name', label: 'Названию' },
        { id: 'tag', label: 'Тегу' },
        { id: 'author', label: 'Автору' },
        { id: 'project', label: 'Проекту' }
      ],
      sortOptions: [
        { id: 'date', label: 'Дате добавления' },
        { id: 'alphabet', label: 'Алфавиту' },
        { id: 'count', label: 'Количеству оценок' },
        { id: 'activity', label: 'Активности' }
      ]
    },
    events: {
      searchOptions: [
        { id: 'name', label: 'Названию' },
        { id: 'tag', label: 'Тегу' },
        { id: 'author', label: 'Автору' }
      ],
      sortOptions: [
        { id: 'date', label: 'Дате добавления' },
        { id: 'alphabet', label: 'Алфавиту' },
        { id: 'count', label: 'Количеству оценок' },
        { id: 'count_users', label: 'Количеству участников' }
      ]
    },
    users: {
      searchOptions: [
        { id: 'name', label: 'Названию' },
        { id: 'tag', label: 'Тегу' },
        { id: 'role', label: 'Роли' }
      ],
      sortOptions: [
        { id: 'date', label: 'Дате регистрации' },
        { id: 'alphabet', label: 'Алфавиту' },
        { id: 'activity', label: 'Активности' },
        { id: 'project_count', label: 'Количеству проектов' },
        { id: '_count', label: 'Количеству оценок' }
      ]
    }
  };

  const currentOptions = tabOptions[activeId] || tabOptions.vacancy;

  const [selectedSearch, setSelectedSearch] = useState<SearchOption | null>(null);
  const [selectedSort, setSelectedSort] = useState<SearchOption | null>(null);

  useEffect(() => {
    const options = tabOptions[activeId] || tabOptions.vacancy;
    setSelectedSearch(options.searchOptions[0]);
    setSelectedSort(options.sortOptions[0]);
  }, [activeId]);

  const handleSearchSelect = (item: SearchOption) => {
    console.log('Selected search:', item);
    setSelectedSearch(item);
    setIsNameDropdownOpen(false);
  };

  const handleSortSelect = (item: SearchOption) => {
    console.log('Selected sort:', item);
    setSelectedSort(item);
    setIsDateDropdownOpen(false);
  };

  return (
    <div className="search-content-container">
        <div className="search-line-container">
            <div className="search-input-container">
                <SearchIcon className='search-ico'/>
                <input className="search-input" placeholder="Искать" tabIndex={-1}/>
            </div>
            <div className="search-button-container">
                <button className="search-button">Поиск</button>
            </div>
        </div>
        <div className="sort-line-container">
            <div className='sort-group'>
                <div ref={nameMenuRef} className={`sort-type-container ${isNameDropdownOpen ? 'active' : ''}`} onClick={() => setIsNameDropdownOpen(!isNameDropdownOpen)}>
                    <p className='sort-type-text'>По {selectedSearch?.label.toLowerCase() || 'названию'}</p>
                    <DropdownIcon className={`sort-type-dropdown-ico ${isNameDropdownOpen ? 'rotated' : ''}`}/>
                </div>
                <Dropdown isOpen={isNameDropdownOpen} items={currentOptions.searchOptions} onSelect={handleSearchSelect} />
            </div>
            <div className='sort-group'>
                <div ref={dateMenuRef} className={`sort-type-container ${isDateDropdownOpen ? 'active' : ''}`} onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}>
                    <p className='sort-type-text'>Сортировка по {selectedSort?.label.toLowerCase() || 'дате добавления'}</p>
                    <DropdownIcon className={`sort-type-dropdown-ico ${isDateDropdownOpen ? 'rotated' : ''}`}/>
                </div>
                <Dropdown isOpen={isDateDropdownOpen} items={currentOptions.sortOptions} onSelect={handleSortSelect} />
            </div>
             <div className='sort-vector-ico-container' onClick={setSort}>
                {isSortUp ? (<SortUpIcon className='sort-vector-ico'/>) : (<SortDownIcon className='sort-vector-ico'/>)}
            </div>
        </div>
    </div>
  )
}