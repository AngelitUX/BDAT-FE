import { useState, useRef, useEffect } from 'react';
import {
    Play, RotateCcw, Loader2, ChevronDown,
    CheckCircle2, ZapOff, Zap,
    Archive, ListFilter, X, Trash2, Search,
    ChevronLeft, ChevronRight,
    SlidersHorizontal, Download, Plus, Upload, Clock, XCircle
} from 'lucide-react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import AdvancedSearch from '../AdvancedSearch';

const SimulationControlBar = ({
    simulations = [],
    onRunAll, onStopAll, onDownloadAll, onDownloadSelected,
    isRunningAll = false, isStoppingAll = false,
    isDownloadingAll = false, isDownloadingSelected = false,
    activeFilter, onQuickFilter,
    onSearch, onClearSearch, searchFilters, hasActiveFilters,
    selectedIds = [], onRunSelected, onDeleteSelected, onDeleteAll,
    isRunningBatch = false,
    filteredCount = 0, currentPage = 1, totalPages = 1,
    onPrevPage, onNextPage,
    onNewSimulation, onImport, onOpenQueue, isBatchCreating = false,
    activeSimulations = [], onGoToPage, onAbort, isAborting
}) => {
    const counts = {
        notStarted: simulations.filter(s => s.p_status === 'Not started').length,
        running: simulations.filter(s => s.p_status === 'Running').length,
        queued: simulations.filter(s => s.p_status === 'Queued').length,
        error: simulations.filter(s => s.p_status === 'Error').length,
        aborted: simulations.filter(s => s.p_status === 'Aborted').length,
        finished: simulations.filter(s => s.p_status === 'Finished').length,
    };
    const eligibleRun = counts.notStarted;
    const eligibleDownload = counts.finished;
    const eligibleDelete = simulations.length - counts.running;
    const hasActive = counts.running > 0 || counts.queued > 0;

    const QUICK_FILTERS = [
        { label: 'All', value: null },
        { label: 'Running', value: 'Running', dot: true },
        { label: 'Queued', value: 'Queued' },
        { label: 'Not started', value: 'Not started' },
        { label: 'Finished', value: 'Finished' },
        { label: 'Error', value: 'Error' },
        { label: 'Aborted', value: 'Aborted' },
    ];

    const activeFilterTags = hasActiveFilters ? hasActiveFilters() : false;

    return (
        <div className="bg-white border-b border-gray-200 flex-shrink-0 px-3 py-2">
            <div className="flex flex-col gap-2">
                {/* ── ROW 1: All Buttons, Filters & Search ── */}
                <div className="flex items-center gap-2 flex-wrap justify-between min-h-[36px]">
                    
                    {/* Left side items */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Primary Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={onNewSimulation} disabled={isBatchCreating}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm ${isBatchCreating ? 'bg-zinc-600 cursor-not-allowed opacity-70 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>
                                <Plus className="w-3.5 h-3.5" /> New
                            </button>
                            <button onClick={onImport} disabled={isBatchCreating}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all shadow-sm ${isBatchCreating ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                                <Upload className="w-3.5 h-3.5" /> Import
                            </button>
                            <div style={{ overflow: 'hidden', transition: 'width 0.3s, opacity 0.3s', width: counts.queued > 0 ? 'auto' : '0px', opacity: counts.queued > 0 ? 1 : 0 }}>
                                {counts.queued > 0 && (
                                    <button onClick={onOpenQueue} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 transition-all ml-1">
                                        <Clock className="w-3.5 h-3.5" /> Queue
                                        <span className="bg-gray-700 text-white text-[10px] font-bold px-1 py-0.5 rounded-full">{counts.queued}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="w-px h-5 bg-gray-200 flex-shrink-0 mx-0.5" />

                        {/* Search Bar */}
                        <div className="flex-shrink-0">
                            <AdvancedSearch onSearch={onSearch} onClear={onClearSearch} showFiltersInline={false} />
                        </div>

                        <div className="w-px h-5 bg-gray-200 flex-shrink-0 mx-0.5" />

                        {/* Bulk Controls */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => onRunAll('not-started')} disabled={isRunningAll || eligibleRun === 0}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all shadow-sm ${isRunningAll || eligibleRun === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'}`} title="Run all">
                                {isRunningAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Run All
                                {eligibleRun > 0 && <span className="text-[10px] px-1 py-0.5 rounded-full font-bold bg-white/25 text-white leading-none">{eligibleRun}</span>}
                            </button>
                            <button onClick={onStopAll} disabled={isStoppingAll || !hasActive}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all shadow-sm ${isStoppingAll || !hasActive ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`} title="Stop all">
                                {isStoppingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ZapOff className="w-3.5 h-3.5" />} Stop All
                                {hasActive && <span className="text-[10px] font-bold bg-red-100 text-red-500 px-1 py-0.5 rounded-full leading-none">{counts.running + counts.queued}</span>}
                            </button>
                            <button onClick={onDownloadAll} disabled={isDownloadingAll || eligibleDownload === 0}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all shadow-sm ${isDownloadingAll || eligibleDownload === 0 ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`} title="Download all">
                                {isDownloadingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />} Download All
                                {eligibleDownload > 0 && <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full leading-none ml-0.5">{eligibleDownload}</span>}
                            </button>
                            <button onClick={onDeleteAll} disabled={simulations.length === 0 || eligibleDelete === 0}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all shadow-sm ${simulations.length === 0 || eligibleDelete === 0 ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600'}`} title="Delete all">
                                <Trash2 className="w-3.5 h-3.5" /> Delete All
                                {eligibleDelete > 0 && simulations.length !== eligibleDelete && <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-1 py-0.5 rounded-full leading-none ml-0.5">{eligibleDelete}</span>}
                            </button>
                        </div>

                        <div className="w-px h-5 bg-gray-200 flex-shrink-0 mx-0.5" />

                        {/* Running Simulation Indicator */}
                        <div className="flex-shrink-0 flex items-center">
                            {activeSimulations.length > 0 && (
                                <RunningSimulationIndicator 
                                    activeSimulations={activeSimulations} 
                                    onGoToPage={onGoToPage} 
                                    currentPage={currentPage} 
                                    onAbort={onAbort} 
                                    isAborting={isAborting} 
                                />
                            )}
                        </div>
                    </div>

                    {/* Right side items */}
                    <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
                        <div className={`flex items-center transition-opacity duration-300 ${selectedIds.length > 0 ? 'opacity-100' : 'opacity-0 invisible pointer-events-none'}`}>
                            {selectedIds.length > 0 && (
                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1 shadow-sm whitespace-nowrap">
                                    <span className="text-[11px] font-bold text-gray-900">{selectedIds.length} <span className="text-gray-500 font-semibold">selected</span></span>
                                    <span className="w-px h-3.5 bg-gray-300 mx-0.5" />
                                    <button onClick={onRunSelected} disabled={isRunningBatch}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-all shadow-sm">
                                        {isRunningBatch ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Run
                                    </button>
                                    {selectedIds.length > 0 && selectedIds.every(id => simulations.find(s => s.id === id)?.p_status === 'Finished') && (
                                        <button onClick={onDownloadSelected} disabled={isDownloadingSelected}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700 text-[11px] font-semibold hover:bg-gray-50 hover:border-gray-300 disabled:opacity-60 transition-all shadow-sm">
                                            {isDownloadingSelected ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3 text-gray-500" />} ZIP
                                        </button>
                                    )}
                                    <button onClick={onDeleteSelected}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-gray-200 text-red-600 text-[11px] font-semibold hover:bg-red-50 hover:border-red-200 transition-all shadow-sm">
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            <span className="text-[11px] text-gray-400 whitespace-nowrap mr-1">
                                {filteredCount} result{filteredCount !== 1 ? 's' : ''}
                                {totalPages > 1 && <span className="ml-1 text-gray-300">· p.{currentPage}/{totalPages}</span>}
                            </span>
                            <button onClick={onPrevPage} disabled={currentPage <= 1}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                            </button>
                            <button onClick={onNextPage} disabled={currentPage >= totalPages}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── ROW 2: Active Filter Tags ── */}
                {activeFilterTags && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-gray-100">
                        {searchFilters?.searchTerm && <Tag>"{searchFilters.searchTerm}"</Tag>}
                        {searchFilters?.status && searchFilters.status !== 'all' && <Tag>Status: {searchFilters.status}</Tag>}
                        {searchFilters?.attenuation && searchFilters.attenuation !== 'all' && (
                            <Tag>{searchFilters.attenuation === '0' ? 'Time Domain' : 'Freq. Domain'}</Tag>
                        )}
                        {searchFilters?.meshType && searchFilters.meshType !== 'all' && <Tag>{searchFilters.meshType?.toUpperCase()}</Tag>}
                        {searchFilters?.skinConfig && searchFilters.skinConfig !== 'all' && <Tag>Tissue: {searchFilters.skinConfig}</Tag>}
                        {(searchFilters?.porosityMin || searchFilters?.porosityMax) && (
                            <Tag>Porosity: {searchFilters?.porosityMin || '1'}-{searchFilters?.porosityMax || '30'}%</Tag>
                        )}
                        {(searchFilters?.dateFrom || searchFilters?.dateTo) && (
                            <Tag>{searchFilters?.dateFrom || '...'} - {searchFilters?.dateTo || '...'}</Tag>
                        )}
                        <button onClick={onClearSearch}
                            className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-red-500 transition-colors ml-1">
                            <X className="w-3 h-3" /> Clear all
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const RunningSimulationIndicator = ({ activeSimulations, onGoToPage, currentPage, onAbort, isAborting }) => {
    const first = activeSimulations[0];
    const [elapsed, setElapsed] = useState('00:00');

    useEffect(() => {
        if (!first?.start_datetime) return;
        const tick = () => {
            const diff = Math.floor((Date.now() - new Date(first.start_datetime).getTime()) / 1000);
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            setElapsed(h > 0
                ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [first?.start_datetime]);

    if (!first) return null;

    return (
        <div
            className="flex items-center gap-3 px-3 py-1.5 ml-2 bg-indigo-50 border border-indigo-100 rounded-md shadow-sm hover:bg-indigo-100 transition-colors cursor-pointer"
            onClick={() => onGoToPage(first.page)}
        >
            <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                <span className="text-xs font-semibold text-indigo-700 truncate max-w-[150px]">
                    {first.sim_name}
                </span>
                {activeSimulations.length > 1 && (
                    <span className="text-[10px] bg-indigo-200 text-indigo-800 font-bold px-1.5 py-0.5 rounded-full">
                        +{activeSimulations.length - 1}
                    </span>
                )}
            </div>

            <div className="w-px h-3.5 bg-indigo-200" />

            <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-medium text-indigo-600 w-10 text-center">
                    {elapsed}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAbort(first);
                    }}
                    disabled={isAborting || first.p_status === 'Aborting'}
                    className="text-indigo-400 hover:text-red-500 transition-colors"
                    title="Abort simulation"
                >
                    {isAborting || first.p_status === 'Aborting' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <XCircle className="w-3.5 h-3.5" />
                    )}
                </button>
            </div>
        </div>
    );
};

const Tag = ({ children }) => (
    <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-full text-[10px] font-medium">
        {children}
    </span>
);

export default SimulationControlBar;
