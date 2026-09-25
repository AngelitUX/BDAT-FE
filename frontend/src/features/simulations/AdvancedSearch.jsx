import { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Field, Input } from '@headlessui/react';
import clsx from 'clsx';
import FiltersModal from './FiltersModal';

const AdvancedSearch = ({ onSearch, onClear, showFiltersInline = true }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filters, setFilters] = useState({
        searchTerm: '',
        status: 'all',
        attenuation: 'all',
        meshType: 'all',
        porosityMin: '',
        porosityMax: '',
        dateFrom: '',
        dateTo: '',
        skinConfig: 'all'
    });

    const handleSearchTermChange = (value) => {
        const newFilters = { ...filters, searchTerm: value };
        setFilters(newFilters);
        onSearch(newFilters);
    };

    const handleApplyFilters = (newFilters) => {
        const updatedFilters = { ...filters, ...newFilters };
        setFilters(updatedFilters);
        onSearch(updatedFilters);
    };

    const handleRemoveFilter = (filterKey) => {
        let newFilters = { ...filters };
        if (filterKey === 'searchTerm') {
            newFilters.searchTerm = '';
        } else if (filterKey === 'porosity') {
            newFilters.porosityMin = '';
            newFilters.porosityMax = '';
        } else if (filterKey === 'date') {
            newFilters.dateFrom = '';
            newFilters.dateTo = '';
        } else {
            newFilters[filterKey] = 'all';
        }
        setFilters(newFilters);
        onSearch(newFilters);
    };

    const handleClear = () => {
        const clearedFilters = {
            searchTerm: '',
            status: 'all',
            attenuation: 'all',
            meshType: 'all',
            porosityMin: '',
            porosityMax: '',
            dateFrom: '',
            dateTo: '',
            skinConfig: 'all'
        };
        setFilters(clearedFilters);
        onClear();
    };

    const hasActiveFilters = () => {
        return filters.searchTerm !== '' ||
            filters.status !== 'all' ||
            filters.attenuation !== 'all' ||
            filters.meshType !== 'all' ||
            filters.porosityMin !== '' ||
            filters.porosityMax !== '' ||
            filters.dateFrom !== '' ||
            filters.dateTo !== '' ||
            filters.skinConfig !== 'all';
    };

    return (
        <div className="flex items-center gap-2">
            {/* Search Input */}
            <Field>
                <div className="relative flex-shrink-0" style={{ width: '280px' }}>
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                    <Input
                        type="text"
                        placeholder="Search by name, ID..."
                        value={filters.searchTerm}
                        onChange={(e) => handleSearchTermChange(e.target.value)}
                        className={clsx(
                            'block w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm/6 text-gray-900 shadow-sm transition-colors hover:border-gray-300',
                            'focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-blue-500 data-focus:border-transparent'
                        )}
                    />
                </div>
            </Field>

            {/* Filter and Clear Buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap shadow-sm flex-shrink-0 ${
                        hasActiveFilters()
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <Filter className="w-3.5 h-3.5" />
                    Filters
                    {hasActiveFilters() && (
                        <span className="bg-white text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                            {Object.values(filters).filter(v => v !== '' && v !== 'all').length}
                        </span>
                    )}
                </button>

                <div className="transition-all duration-300 ease-in-out flex-shrink-0" style={{
                    opacity: hasActiveFilters() ? 1 : 0,
                    width: hasActiveFilters() ? 'auto' : '0px',
                    overflow: 'hidden'
                }}>
                    {hasActiveFilters() && (
                        <button
                            onClick={handleClear}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 transition-all text-xs font-semibold whitespace-nowrap shadow-sm"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            {/* Filters Modal */}
            <FiltersModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                currentFilters={filters}
                onApply={handleApplyFilters}
            />

        </div>
    );
};

export default AdvancedSearch;
