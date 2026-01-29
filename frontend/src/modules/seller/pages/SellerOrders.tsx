import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getOrders, Order, GetOrdersParams } from '../../../services/api/orderService';
import ThemedDropdown from '../components/ThemedDropdown';

type SortField = 'orderId' | 'deliveryDate' | 'orderDate' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function SellerOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [dateRange, setDateRange] = useState('');
  const [status, setStatus] = useState('All Status');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError('');
      try {
        const params: GetOrdersParams = {
          page: currentPage,
          limit: parseInt(entriesPerPage),
          sortBy: sortField || 'orderDate',
          sortOrder: sortDirection,
        };

        // Parse date range
        if (dateRange) {
          const [startDate, endDate] = dateRange.split(' - ');
          if (startDate && endDate) {
            params.dateFrom = startDate;
            params.dateTo = endDate;
          }
        }

        // Add status filter
        if (status !== 'All Status') {
          params.status = status;
        }

        // Add search
        if (searchQuery) {
          params.search = searchQuery;
        }

        const response = await getOrders(params);
        if (response.success && response.data) {
          setOrders(response.data);
        } else {
          setError(response.message || 'Failed to fetch orders');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [dateRange, status, entriesPerPage, searchQuery, currentPage, sortField, sortDirection]);

  const handleClearDate = () => {
    setDateRange('');
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExport = () => {
    // Create CSV content
    const headers = ['Order ID', 'Delivery Date', 'Order Date', 'Status', 'Amount'];
    const csvContent = [
      headers.join(','),
      ...orders.map(order =>
        [order.orderId, order.deliveryDate, order.orderDate, order.status, order.amount].join(',')
      )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination (client-side for now, can be moved to backend later)
  const entriesPerPageNum = parseInt(entriesPerPage);
  const totalPages = Math.ceil(orders.length / entriesPerPageNum);
  const startIndex = (currentPage - 1) * entriesPerPageNum;
  const endIndex = startIndex + entriesPerPageNum;
  const paginatedOrders = orders.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'Accepted':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'On the way':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'Delivered':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border border-neutral-200';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Orders List</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage and track your customer orders</p>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200">
          <Link to="/seller" className="text-teal-600 hover:text-teal-700 font-medium">
            Home
          </Link>
          <span className="text-neutral-400">/</span>
          <span className="text-neutral-600">Orders</span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {/* Filter Bar */}
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between">

            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
              {/* Date Range Filter */}
              <div className="w-full md:w-auto">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
                  Date Range
                </label>
                <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded-lg px-3 py-2 w-full md:w-64 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
                    <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input
                    type="text"
                    value={dateRange}
                    onChange={(e) => {
                      setDateRange(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="flex-1 text-sm bg-transparent focus:outline-none text-neutral-700 placeholder:text-neutral-400"
                    placeholder="MM/DD/YYYY - MM/DD/YYYY"
                  />
                  {dateRange && (
                    <button onClick={handleClearDate} className="text-neutral-400 hover:text-neutral-600">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6L18 18"></path></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter */}
              <div className="w-full md:w-48">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
                  Status
                </label>
                <ThemedDropdown
                  options={['All Status', 'Pending', 'Accepted', 'On the way', 'Delivered', 'Cancelled']}
                  value={status}
                  onChange={(val) => {
                    setStatus(val);
                    setCurrentPage(1);
                  }}
                />
              </div>

               {/* Entries Filter */}
               <div className="w-full md:w-24">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
                  Show
                </label>
                <ThemedDropdown
                  options={['10', '25', '50', '100']}
                  value={entriesPerPage}
                  onChange={(val) => {
                    setEntriesPerPage(val);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
               {/* Search Bar */}
               <div className="w-full md:w-64">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
                  Search
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-neutral-400"
                    placeholder="Search orders..."
                  />
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Export Button */}
              <div className="w-full md:w-auto self-end">
                <button
                  onClick={handleExport}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Loading and Error States */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-4"></div>
            <div className="text-neutral-500 font-medium">Loading orders data...</div>
          </div>
        )}
        {error && !loading && (
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="text-lg font-medium text-neutral-900">Error Loading Orders</h3>
            <p className="text-neutral-500 mt-1">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 text-teal-600 hover:text-teal-700 font-medium">Try Again</button>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-neutral-50/80 border-b border-neutral-200">
                <tr>
                  {[
                    { id: 'orderId', label: 'Order ID' },
                    { id: 'deliveryDate', label: 'Delivery Date' },
                    { id: 'orderDate', label: 'Order Date' },
                    { id: 'status', label: 'Status' },
                    { id: 'amount', label: 'Amount' },
                  ].map((header) => (
                    <th key={header.id} className="px-6 py-4 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort(header.id as SortField)}
                        className="flex items-center gap-2 hover:text-teal-700 transition-colors group"
                      >
                        {header.label}
                        <span className={`transition-colors ${sortField === header.id ? 'text-teal-600' : 'text-neutral-300 group-hover:text-neutral-400'}`}>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d={sortField === header.id && sortDirection === 'desc' ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                       <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                        </div>
                        <h3 className="text-lg font-medium text-neutral-900">No orders found</h3>
                        <p className="text-neutral-500 mt-1">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order, index) => (
                    <motion.tr
                      key={order.id}
                      className="hover:bg-teal-50/30 transition-colors group"
                      variants={itemVariants}
                      custom={index}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                        <span className="font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">#{order.orderId}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{order.deliveryDate}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{order.orderDate}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                             order.status === 'Delivered' ? 'bg-green-500' :
                             order.status === 'Cancelled' ? 'bg-red-500' :
                             order.status === 'Pending' ? 'bg-yellow-500' :
                             order.status === 'On the way' ? 'bg-purple-500' :
                             'bg-blue-500'
                          }`}></span>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-neutral-900">₹{order.amount.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => navigate(`/seller/orders/${order.id}`)}
                          className="text-teal-600 hover:text-teal-700 hover:bg-teal-50 p-2 rounded-lg transition-all transform hover:scale-105 active:scale-95"
                          title="View Details"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-neutral-500">
            Showing <span className="font-semibold text-neutral-900">{orders.length === 0 ? 0 : startIndex + 1}</span> to <span className="font-semibold text-neutral-900">{Math.min(endIndex, orders.length)}</span> of <span className="font-semibold text-neutral-900">{orders.length}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className={`p-2 rounded-lg border transition-all ${currentPage === 1
                ? 'border-neutral-200 text-neutral-300 cursor-not-allowed bg-white'
                : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-teal-500 hover:text-teal-600 shadow-sm hover:shadow'
                }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>

            <div className="hidden sm:flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                 let p = i + 1;
                 if (totalPages > 5 && currentPage > 3) {
                    p = currentPage - 2 + i;
                    if (p > totalPages) p = i + 1 + (totalPages - 5);
                 }
                 if (p > totalPages || p <= 0) return null;

                 return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-sm font-medium transition-all ${
                      currentPage === p
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {p}
                  </button>
                 );
              })}
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className={`p-2 rounded-lg border transition-all ${currentPage >= totalPages
                ? 'border-neutral-200 text-neutral-300 cursor-not-allowed bg-white'
                : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-teal-500 hover:text-teal-600 shadow-sm hover:shadow'
                }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6">
        <p className="text-sm text-neutral-500">
          Copyright © 2025. Developed By{' '}
          <Link to="/seller" className="text-teal-600 hover:text-teal-700 font-medium hover:underline">
            Geeta Stores
          </Link>
        </p>
      </footer>
    </motion.div>
  );
}
