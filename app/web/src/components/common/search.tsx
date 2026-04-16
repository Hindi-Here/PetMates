import DropdownIcon from '@icons/dropdown.svg?react'
import SearchIcon from '@icons/search.svg?react'
import SortUpIcon from '@icons/sort_up.svg?react'
import SortDownIcon from '@icons/sort_down.svg?react'

import './search.scss'
import { useState, useEffect } from 'react'
import { Dropdown } from './dropdown';
import { useIsOpen } from '../config/function';

// options for each tab (vacancy, events, users)
interface SearchOption {
  id: string;
  label: string;
}

const tabOpt: Record<string, { searchOpt: SearchOption[]; sortOpt: SearchOption[] }> = {
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

// search manage
export function Search ({ activeId }: { activeId: string }) {
  // sort icon vector change 
  const [isSortUp, setIsSortUp] = useState(true);
  const setSort = () => setIsSortUp(prev => !prev);

  // for open/close dropdown, color search/sort-type-container, rotated dropdown-ico 
  const { isOpen: isSearchDropdownOpen, setIsOpen: setIsNameDropdownOpen, menuRef: searchMenuRef } = useIsOpen();
  const { isOpen: isSortDropdownOpen, setIsOpen: setIsDateDropdownOpen, menuRef: sortMenuRef } = useIsOpen();

  // get params from `tabOpt` for sort and search dropdown
  const currentOpt = tabOpt[activeId] || tabOpt['vacancy']; // || for safe click on all tabs outside `tabOpt` 

  // hooks for get params of search and sort & set default/user choice
  const [selectedSearch, setSelectedSearch] = useState<SearchOption | null>(null);
  const [selectedSort, setSelectedSort] = useState<SearchOption | null>(null);

  // default params for each tab
  useEffect(() => {
    const options = tabOpt[activeId] || tabOpt['vacancy'];
    setSelectedSearch(options.searchOpt[0]);
    setSelectedSort(options.sortOpt[0]);
  }, [activeId]);

  // user choise
  const handleSearchSelect = (item: SearchOption) => {
    setSelectedSearch(item);
    setIsNameDropdownOpen(false);
  };

  const handleSortSelect = (item: SearchOption) => {
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
            <div className='sort-group-container'>
                <div ref={searchMenuRef} className={`sort-type-container ${isSearchDropdownOpen ? 'active' : ''}`} onClick={() => setIsNameDropdownOpen(!isSearchDropdownOpen)}>
                    <p className='sort-type-text'>По {selectedSearch?.label.toLowerCase()}</p>
                    <DropdownIcon className={`sort-type-dropdown-ico ${isSearchDropdownOpen ? 'rotated' : ''}`}/>
                </div>
                <Dropdown isOpen={isSearchDropdownOpen} items={currentOpt.searchOpt} onSelect={handleSearchSelect} />
            </div>
            <div className='sort-group-container'>
                <div ref={sortMenuRef} className={`sort-type-container ${isSortDropdownOpen ? 'active' : ''}`} onClick={() => setIsDateDropdownOpen(!isSortDropdownOpen)}>
                    <p className='sort-type-text'>Сортировка по {selectedSort?.label.toLowerCase()}</p>
                    <DropdownIcon className={`sort-type-dropdown-ico ${isSortDropdownOpen ? 'rotated' : ''}`}/>
                </div>
                <Dropdown isOpen={isSortDropdownOpen} items={currentOpt.sortOpt} onSelect={handleSortSelect} />
            </div>
             <div className='sort-vector-ico-container' onClick={setSort}>
                {isSortUp ? (<SortUpIcon className='sort-vector-ico'/>) : (<SortDownIcon className='sort-vector-ico'/>)}
            </div>
        </div>
    </div>
  )
}