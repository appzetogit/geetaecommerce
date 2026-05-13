import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getReturnRequests, ReturnRequest, GetReturnRequestsParams, updateReturnStatus } from '../../../services/api/returnService';
import ThemedDropdown from '../components/ThemedDropdown';
import { useToast } from '../../../context/ToastContext';

type SortField = 'orderId' | 'date' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function SellerReturnRequests() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [dateRange, setDateRange] = useState('');
  const [status, setStatus] = useState('All Status');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Fetch return requests
  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      setError('');
      try {
        const params: GetReturnRequestsParams = {
          page: currentPage,
          limit: parseInt(entriesPerPage),
          requestType: 'Return',
          sortBy: sortField || 'date',
          sortOrder: sortDirection,
        };

        if (dateRange) {
          const [startDate, endDate] = dateRange.split(' - ');
          if (startDate && endDate) {
            params.dateFrom = startDate;
            params.dateTo = endDate;
          }
        }

        if (status !== 'All Status') {
          params.status = status;
        }

        if (searchQuery) {
          params.search = searchQuery;
        }

        const response = await getReturnRequests(params);
        if (response.success && response.data) {
          setRequests(response.data);
        } else {
          setError(response.message || 'Failed to fetch return requests');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch return requests');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [dateRange, status, entriesPerPage, searchQuery, currentPage, sortField, sortDirection]);

  const handleClearDate = () => { setDateRange(''); setCurrentPage(1); };
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExport = () => {
    const headers = ['Order Number', 'User Name', 'Product Name', 'Quantity', 'Status', 'Date'];
    const csvContent = [
      headers.join(','),
      ...requests.map(r => [r.orderId, r.customerName, r.product, r.quantity, r.status, r.date].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `return_requests_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'Approved': return 'bg-[var(--primary-alpha-20)] text-seller-800 border border-[var(--primary-alpha-30)]';
      case 'Rejected': return 'bg-red-100 text-red-800 border border-red-200';
      case 'Completed': return 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)] border border-blue-200';
      default: return 'bg-neutral-100 text-neutral-800 border border-neutral-200';
    }
  };

  const containerVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Return Requests</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage customer return requests for your products</p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200">
          <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium">Home</Link>
          <span className="text-neutral-400">/</span>
          <span className="text-neutral-600">Return Requests</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-[var(--primary-dark)] text-white px-4 sm:px-6 py-2 sm:py-3"><h2 className="text-base sm:text-lg font-semibold">Return Requests List</h2></div>
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
              <div className="w-full md:w-auto">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Date Range</label>
                <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded-lg px-3 py-2 w-full md:w-64 focus-within:ring-2 focus-within:ring-[var(--primary-color)]/20 focus-within:border-[var(--primary-color)] transition-all">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-400"><path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <input type="text" value={dateRange} onChange={(e) => { setDateRange(e.target.value); setCurrentPage(1); }} className="flex-1 text-sm bg-transparent focus:outline-none text-neutral-700 placeholder:text-neutral-400" placeholder="MM/DD/YYYY - MM/DD/YYYY" />
                  {dateRange && <button onClick={handleClearDate} className="text-neutral-400 hover:text-neutral-600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6L18 18"></path></svg></button>}
                </div>
              </div>
              <div className="w-full md:w-48"><label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Status</label><ThemedDropdown options={['All Status', 'Pending', 'Approved', 'Rejected', 'Completed']} value={status} onChange={(val) => { setStatus(val); setCurrentPage(1); }} /></div>
            </div>
            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
              <div className="w-full md:w-64">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Search</label>
                <div className="relative">
                  <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all placeholder:text-neutral-400" placeholder="Search order ID or customer..." />
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
              <div className="w-full md:w-auto self-end"><button onClick={handleExport} className="w-full md:w-auto flex items-center justify-center gap-2 bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow active:scale-95"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/></svg><span>Export</span></button></div>
            </div>
          </div>
        </div>

        {loading && <div className="flex flex-col items-center justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary-dark)] mb-4"></div><div className="text-neutral-500 font-medium">Loading requests...</div></div>}
        {error && !loading && <div className="p-6 text-center"><div className="text-red-600 mb-2">{error}</div><button onClick={() => window.location.reload()} className="text-[var(--primary-dark)] font-medium hover:underline">Try Again</button></div>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-neutral-50/80 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-500 uppercase">Order ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-500 uppercase">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-500 uppercase">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-500 uppercase">Qty</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-500 uppercase">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {requests.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-neutral-500">No return requests found</td></tr>
                ) : (
                  requests.map((request, index) => (
                    <motion.tr key={request.id} className="hover:bg-[var(--primary-alpha-10)]/30 transition-colors group" variants={itemVariants} custom={index}>
                      <td className="px-6 py-4 text-sm font-medium text-neutral-900"><span className="font-mono text-[var(--primary-darker)] bg-[var(--primary-alpha-10)] px-2 py-0.5 rounded border border-[var(--primary-alpha-20)]">#{request.orderId}</span></td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{request.customerName}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600 truncate max-w-[250px]" title={request.product}>{request.product}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{request.quantity}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-neutral-900">₹{request.total.toFixed(2)}</td>
                      <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>{request.status}</span></td>
                      <td className="px-6 py-4">
                        <button onClick={() => navigate(`/seller/return-requests/${request.id}`)} className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] hover:bg-[var(--primary-alpha-10)] p-2 rounded-lg transition-all transform hover:scale-105 active:scale-95" title="View Details"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
           <div className="text-sm text-neutral-500">Showing <span className="font-semibold text-neutral-900">{requests.length}</span> entries</div>
           <div className="flex gap-2">
             <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 border rounded-lg hover:bg-white disabled:opacity-50"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg></button>
             <button onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 border rounded-lg hover:bg-white"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg></button>
           </div>
        </div>
      </div>
      <footer className="text-center py-6"><p className="text-sm text-neutral-500">Copyright © 2025. Developed By <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium hover:underline">Geeta Stores</Link></p></footer>
    </motion.div>
  );
}
