import { ChevronLeft, ChevronRight, Database } from 'lucide-react';

export default function PaginationsButtons({
    numberOfSimulations,
    currentPage,
    totalPages,
    onPrev,
    onNext
}) {
    const hasMultiplePages = totalPages > 1;
    
    return (
        <div className="flex justify-between items-center mb-4 px-2 gap-8">
            {/* Total simulations badge */}
            <div className="flex items-center gap-1 text-xs text-gray-400">
                <span className="font-semibold">
                    {numberOfSimulations}
                </span>
                <span className="">
                    {numberOfSimulations === 1 ? 'simulation' : 'simulations'} in total
                </span>
            </div>

            {/* Pagination controls */}
            <div className={`flex items-center gap-2 transition-opacity duration-200 ${!hasMultiplePages ? 'opacity-80' : 'opacity-100'}`}>
                <button
                    className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-sm border border-zinc-200 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white group"
                    onClick={onPrev}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                >
                    <ChevronLeft className="w-5 h-5 text-gray-600 group-disabled:text-gray-400 transition-colors" />
                </button>

                {/* Page indicator */}
                <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2 rounded-lg border border-gray-200 shadow-sm min-w-[100px] justify-center">
                    <span className="text-sm font-bold text-gray-700">
                        {currentPage}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                        of
                    </span>
                    <span className="text-sm font-bold text-gray-700">
                        {totalPages}
                    </span>
                </div>

                <button
                    className="flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-sm border border-zinc-200 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white group"
                    onClick={onNext}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                >
                    <ChevronRight className="w-5 h-5 text-gray-600 group-disabled:text-gray-400 transition-colors" />
                </button>
            </div>
        </div>
    );
}