import { useState, useEffect } from 'react';
import * as taxService from '../../../services/api/taxService';

export default function SellerTaxes() {
    const [taxes, setTaxes] = useState<taxService.Tax[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        const fetchTaxes = async () => {
            setLoading(true);
            try {
                const response = await taxService.getTaxes();
                if (response.success) {
                    setTaxes(response.data);
                }
            } catch (err) {
                console.error('Error fetching taxes:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTaxes();
    }, []);

    const filteredTaxes = taxes.filter(tax =>
        tax.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredTaxes.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayedTaxes = filteredTaxes.slice(startIndex, endIndex);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ column }: { column: string }) => (
        <span className="text-neutral-300 text-[10px]">
            {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
        </span>
    );

    return (
        <div className="flex flex-col h-full">
            {/* Page Header */}
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                   <h1 className="text-2xl font-bold text-neutral-800">Tax Management</h1>
                   <p className="text-sm text-neutral-500 mt-1">Manage tax rates and configurations</p>
                </div>
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 flex-1 flex flex-col overflow-hidden">
                <div className="bg-[var(--primary-color)] px-6 py-4 border-b border-[var(--primary-dark)]">
                    <h2 className="text-white text-lg font-semibold tracking-wide">Tax List</h2>
                </div>
                {/* Controls */}
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-600">Show</span>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => setRowsPerPage(Number(e.target.value))}
                            className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-[var(--primary-color)] focus:outline-none cursor-pointer"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const headers = ['ID', 'Name', 'Rate (%)', 'Status'];
                                const csvContent = [
                                    headers.join(','),
                                    ...filteredTaxes.map(tax => [
                                        tax._id,
                                        `"${tax.name}"`,
                                        tax.percentage,
                                        tax.status
                                    ].join(','))
                                ].join('\n');
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', `taxes_${new Date().toISOString().split('T')[0]}.csv`);
                                link.style.visibility = 'hidden';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Export
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </span>
                            <input
                                type="text"
                                className="pl-10 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] w-64 transition-shadow"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search taxes..."
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse border border-neutral-200">
                        <thead>
                            <tr className="bg-neutral-50 text-xs font-bold text-neutral-800">
                                <th
                                    className="p-4 w-16 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                    onClick={() => handleSort('id')}
                                >
                                    <div className="flex items-center justify-between">
                                        ID <SortIcon column="id" />
                                    </div>
                                </th>
                                <th
                                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center justify-between">
                                        Tax Name <SortIcon column="name" />
                                    </div>
                                </th>
                                <th
                                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                    onClick={() => handleSort('percentage')}
                                >
                                    <div className="flex items-center justify-between">
                                        Tax Rate (%) <SortIcon column="percentage" />
                                    </div>
                                </th>
                                <th
                                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center justify-between">
                                        Status <SortIcon column="status" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-neutral-400 border border-neutral-200">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
                                            <span>Loading tax data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayedTaxes.map((tax, index) => (
                                <tr key={tax._id} className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700">
                                    <td className="p-4 align-middle border border-neutral-200">{startIndex + index + 1}</td>
                                    <td className="p-4 align-middle border border-neutral-200 font-medium">{tax.name}</td>
                                    <td className="p-4 align-middle border border-neutral-200">{tax.percentage}%</td>
                                    <td className="p-4 align-middle border border-neutral-200">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tax.status === 'Active'
                                            ? 'bg-[var(--primary-alpha-20)] text-seller-800'
                                            : 'bg-rose-100 text-rose-800'
                                            }`}>
                                            {tax.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!loading && displayedTaxes.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-neutral-400 border border-neutral-200">
                                        No taxes found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                    <div className="text-xs sm:text-sm text-neutral-700">
                        Showing {startIndex + 1} to {Math.min(endIndex, filteredTaxes.length)} of {filteredTaxes.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className={`p-2 border border-[var(--primary-color)] rounded ${currentPage === 1
                                ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                                : 'text-[var(--primary-color)] hover:bg-[var(--primary-alpha-10)]'
                                }`}
                            aria-label="Previous page"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M15 18L9 12L15 6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                        <button
                            className="px-3 py-1.5 border border-[var(--primary-color)] bg-[var(--primary-color)] text-white rounded font-medium text-sm"
                        >
                            {currentPage}
                        </button>
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className={`p-2 border border-[var(--primary-color)] rounded ${currentPage === totalPages
                                ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                                : 'text-[var(--primary-color)] hover:bg-[var(--primary-alpha-10)]'
                                }`}
                            aria-label="Next page"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M9 18L15 12L9 6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

