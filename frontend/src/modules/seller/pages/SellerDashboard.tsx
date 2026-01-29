import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import DashboardCard from '../components/DashboardCard';
import OrderChart from '../components/OrderChart';
import AlertCard from '../components/AlertCard';
import { getSellerDashboardStats, DashboardStats, NewOrder } from '../../../services/api/dashboardService';

export default function SellerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEnabled = user?.isEnabled !== false;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [newOrders, setNewOrders] = useState<NewOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await getSellerDashboardStats();
        if (response.success) {
          setStats(response.data.stats);
          setNewOrders(response.data.newOrders);
        } else {
          setError(response.message || 'Failed to fetch dashboard data');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getStatusBadgeClass = (status: NewOrder['status']) => {
    switch (status) {
      case 'Out For Delivery':
        return 'text-blue-800 bg-blue-100 border border-blue-400';
      case 'Received':
        return 'text-blue-600 bg-blue-50';
      case 'Payment Pending':
        return 'text-orange-600 bg-orange-50';
      case 'Cancelled':
        return 'text-red-600 bg-pink-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const totalPages = Math.ceil(newOrders.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const displayedOrders = newOrders.slice(startIndex, endIndex);

  // Icons for KPI cards
  const userIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );

  const categoryIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const subcategoryIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const productIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const ordersIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const completedOrdersIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 7H18C19.1046 7 20 7.89543 20 9V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V9C4 7.89543 4.89543 7 6 7H8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const pendingOrdersIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const cancelledOrdersIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 7L8 15M8 7L16 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 7H18C19.1046 7 20 7.89543 20 9V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V9C4 7.89543 4.89543 7 6 7H8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // Alert icons
  const soldOutIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  const lowStockIcon = (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9V15M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 10,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 text-center text-red-500 bg-white rounded-lg shadow-sm border border-neutral-200">
        {error || 'Stats not available'}
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-4 sm:space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {!isEnabled && (
        <motion.div
          variants={itemVariants}
          className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm"
        >
          <div className="flex items-center">
            <svg className="w-6 h-6 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-red-800 font-bold">Your Seller Account is Disabled</p>
              <p className="text-red-700 text-sm">You can view your dashboard and orders, but you cannot add products, update stock, or perform write operations. Please contact the administrator for more information.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* KPI Cards Grid */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
        variants={itemVariants}
      >
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="h-full">
          <DashboardCard icon={userIcon} title="Total User" value={stats.totalUser} accentColor="#3b82f6" />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="h-full">
          <DashboardCard icon={categoryIcon} title="Total Category" value={stats.totalCategory} accentColor="#eab308" />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="h-full">
          <DashboardCard icon={subcategoryIcon} title="Total Subcategory" value={stats.totalSubcategory} accentColor="#ec4899" />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="h-full">
          <DashboardCard icon={productIcon} title="Total Product" value={stats.totalProduct} accentColor="#f97316" />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="h-full">
          <DashboardCard icon={ordersIcon} title="Total Orders" value={stats.totalOrders} accentColor="#3b82f6" />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="h-full">
          <DashboardCard icon={completedOrdersIcon} title="Completed Orders" value={stats.completedOrders} accentColor="#16a34a" />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="h-full">
          <DashboardCard icon={pendingOrdersIcon} title="Pending Orders" value={stats.pendingOrders} accentColor="#a855f7" />
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }} className="h-full">
          <DashboardCard icon={cancelledOrdersIcon} title="Cancelled Orders" value={stats.cancelledOrders} accentColor="#ef4444" />
        </motion.div>
      </motion.div>

      {/* Charts Row */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6"
        variants={itemVariants}
      >
        <motion.div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 border border-neutral-100 overflow-hidden" whileHover={{ y: -4 }}>
          <OrderChart title={`Order - ${new Date().toLocaleString('default', { month: 'short' })} ${new Date().getFullYear()}`} data={stats.dailyOrderData} maxValue={Math.max(...stats.dailyOrderData.map(d => d.value), 5)} height={400} />
        </motion.div>
        <motion.div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 border border-neutral-100 overflow-hidden" whileHover={{ y: -4 }}>
          <OrderChart title={`Order - ${new Date().getFullYear()}`} data={stats.yearlyOrderData} maxValue={Math.max(...stats.yearlyOrderData.map(d => d.value), 20)} height={400} />
        </motion.div>
      </motion.div>

      {/* Alerts and Button Row */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        variants={itemVariants}
      >
        {/* Alert Cards - Side by Side */}
        <motion.div whileHover={{ scale: 1.01 }} className="h-full">
          <AlertCard icon={soldOutIcon} title="Product Sold Out" value={stats.soldOutProducts} accentColor="#ec4899" />
        </motion.div>
        <motion.div whileHover={{ scale: 1.01 }} className="h-full">
          <AlertCard icon={lowStockIcon} title="Product low on Stock" value={stats.lowStockProducts} accentColor="#eab308" />
        </motion.div>
      </motion.div>

      {/* View New Orders Table Section */}
      <motion.div
        className="bg-white rounded-xl shadow-lg border border-neutral-100 overflow-hidden"
        variants={itemVariants}
      >
        {/* Teal Header Bar */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold tracking-tight">View New Orders</h2>
          <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
            Live Updates
          </div>
        </div>

        {/* Show Entries Control */}
        <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/30 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-neutral-600">Show</span>
              <div className="relative">
                <select
                  value={entriesPerPage}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 10;
                    setEntriesPerPage(Math.max(1, Math.min(100, value)));
                    setCurrentPage(1);
                  }}
                  className="appearance-none w-20 px-3 py-1.5 border border-neutral-300 rounded-lg text-sm text-neutral-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-sm transition-all"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <span className="text-sm font-medium text-neutral-600">entries</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[700px]">
            <thead className="bg-neutral-50 border-b border-neutral-200/60">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">Order Date</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {displayedOrders.map((order, index) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-teal-50/30 transition-colors duration-150 group"
                >
                  <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                    <span className="font-mono bg-neutral-100 px-2 py-1 rounded text-neutral-600 group-hover:bg-white group-hover:shadow-sm transition-all">#{order.id}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{order.orderDate}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${getStatusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-neutral-900">₹ {order.amount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => navigate(`/seller/orders/${order.id}`)}
                      className="bg-white border border-teal-200 text-teal-600 hover:bg-teal-600 hover:text-white p-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95"
                      aria-label="View order details"
                      title="View Details"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2.45825 12C3.73253 7.94288 7.52281 5 12.0002 5C16.4776 5 20.2679 7.94288 21.5422 12C20.2679 16.0571 16.4776 19 12.0002 19C7.52281 19 3.73253 16.0571 2.45825 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm font-medium text-neutral-500">
            Showing <span className="text-neutral-900">{startIndex + 1}</span> to <span className="text-neutral-900">{Math.min(endIndex, newOrders.length)}</span> of <span className="text-neutral-900">{newOrders.length}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`flex items-center justify-center p-2 rounded-lg border transition-all ${currentPage === 1
                ? 'border-neutral-200 text-neutral-300 cursor-not-allowed bg-neutral-50'
                : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-teal-500 hover:text-teal-600 shadow-sm hover:shadow'
                }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="hidden sm:flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                 let p = i + 1;
                 if (totalPages > 5 && currentPage > 3) {
                    p = currentPage - 2 + i;
                    if (p > totalPages) p = i + 1 + (totalPages - 5);
                 }

                 return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-sm font-medium transition-all ${
                      currentPage === p
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {p}
                  </button>
                 );
              })}
            </div>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`flex items-center justify-center p-2 rounded-lg border transition-all ${currentPage === totalPages
                ? 'border-neutral-200 text-neutral-300 cursor-not-allowed bg-neutral-50'
                : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-teal-500 hover:text-teal-600 shadow-sm hover:shadow'
                }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
