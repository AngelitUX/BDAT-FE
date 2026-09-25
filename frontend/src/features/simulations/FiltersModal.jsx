import { useState, useEffect } from 'react';
import { X, Filter } from 'lucide-react';

const FiltersModal = ({ isOpen, onClose, currentFilters, onApply }) => {
    const [filters, setFilters] = useState({
        status: 'all',
        attenuation: 'all',
        meshType: 'all',
        porosityMin: '',
        porosityMax: '',
        dateFrom: '',
        dateTo: '',
        skinConfig: 'all'
    });

    // Initialize filters when modal opens
    useEffect(() => {
        if (isOpen && currentFilters) {
            setFilters({
                status: currentFilters.status || 'all',
                attenuation: currentFilters.attenuation || 'all',
                meshType: currentFilters.meshType || 'all',
                porosityMin: currentFilters.porosityMin || '',
                porosityMax: currentFilters.porosityMax || '',
                dateFrom: currentFilters.dateFrom || '',
                dateTo: currentFilters.dateTo || '',
                skinConfig: currentFilters.skinConfig || 'all'
            });
        }
    }, [isOpen, currentFilters]);

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleClear = () => {
        const clearedFilters = {
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
        onApply(clearedFilters);
        onClose();
    };

    const countActiveFilters = () => {
        return Object.entries(filters).filter(([key, value]) => {
            if (key === 'status' || key === 'attenuation' || key === 'meshType' || key === 'skinConfig') {
                return value !== 'all';
            }
            return value !== '';
        }).length;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in-backdrop">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative animate-scale-in overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Filter className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900 leading-tight">Advanced Filters</h2>
                            <p className="text-[11px] text-gray-400">Configure search filters for simulations</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Status Filter */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                            >
                                <option value="all">All Statuses</option>
                                <option value="Not started">Not Started</option>
                                <option value="Running">Running</option>
                                <option value="Finished">Finished</option>
                                <option value="Error">Error</option>
                                <option value="Aborted">Aborted</option>
                                <option value="Queued">Queued</option>
                                <option value="Processing">Processing</option>
                                <option value="Generating mesh">Generating Mesh</option>
                            </select>
                        </div>

                        {/* Attenuation Filter */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Attenuation (Domain)</label>
                            <select
                                value={filters.attenuation}
                                onChange={(e) => handleFilterChange('attenuation', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                            >
                                <option value="all">All</option>
                                <option value="0">No (Time Domain)</option>
                                <option value="1">Yes (Frequency Domain)</option>
                            </select>
                        </div>

                        {/* Mesh Type Filter */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Mesh Type</label>
                            <select
                                value={filters.meshType}
                                onChange={(e) => handleFilterChange('meshType', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                            >
                                <option value="all">All</option>
                                <option value="gmsh">GMSH</option>
                                <option value="mshr">MSHR</option>
                            </select>
                        </div>

                        {/* Skin Configuration Filter */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Soft Tissue Configuration</label>
                            <select
                                value={filters.skinConfig}
                                onChange={(e) => handleFilterChange('skinConfig', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
                            >
                                <option value="all">All</option>
                                <option value="none">None</option>
                                <option value="top">Top Only</option>
                                <option value="bottom">Bottom Only</option>
                                <option value="both">Top & Bottom</option>
                            </select>
                        </div>

                        {/* Porosity Min */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Porosity Min (%)</label>
                            <input
                                type="number"
                                placeholder="1"
                                min="1"
                                max="30"
                                value={filters.porosityMin}
                                onChange={(e) => handleFilterChange('porosityMin', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                        </div>

                        {/* Porosity Max */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Porosity Max (%)</label>
                            <input
                                type="number"
                                placeholder="30"
                                min="1"
                                max="30"
                                value={filters.porosityMax}
                                onChange={(e) => handleFilterChange('porosityMax', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                        </div>

                        {/* Date From */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Date From</label>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Date To</label>
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Active Filters Count */}
                    {countActiveFilters() > 0 && (
                        <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                                {countActiveFilters()} filter{countActiveFilters() !== 1 ? 's' : ''} configured
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-xs font-semibold"
                    >
                        <X className="w-3.5 h-3.5" />
                        Clear All
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-xs font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all text-xs font-semibold shadow-sm"
                        >
                            <Filter className="w-3.5 h-3.5" />
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FiltersModal;
