import { useState, useEffect } from "react";
import DashboardCard from "../components/DashboardCard";
import OrderChart from "../components/OrderChart";
import SalesLineChart from "../components/SalesLineChart";
import GaugeChart from "../components/GaugeChart";
import ErrorBoundary from "../../../components/ErrorBoundary";
import { useAuth } from "../../../context/AuthContext";
import {
  getDashboardStats,
  getSalesAnalytics,
  getOrderAnalytics,
  getTodaySales,
  getTopSellers,
  getRecentOrders,
  getSalesByLocation,
  type DashboardStats,
  type TopSeller,
  type RecentOrder,
  type SalesByLocation,
  type SalesAnalytics,
  type TodaySales,
} from "../../../services/api/admin/adminDashboardService";

export default function AdminDashboard() {
  const { isAuthenticated, token } = useAuth();

  const getSharingText = (link: string) => `प्रिय ग्राहकों, अब 🛍️ अपने पसंदीदा स्टोर गीता स्टोर्स सरपंच साहब की दुकान से सीधे अपने 📱 मोबाइल से खरीदारी करें। अपने प्रोडक्ट घर पर पाएं। 🚚 एक्सप्रेस कॉन्टैक्ट-लेस डिलीवरी, 💳 ऑनलाइन भुगतान और बहुत कुछ। ऑर्डर करने के लिए 👉 https://${link} पर जाएं`;

  // State hooks - All placed at the very top
  const [storeLink, setStoreLink] = useState("geeta-82938.store.shoopy.in");
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingText, setSharingText] = useState(getSharingText("geeta-82938.store.shoopy.in"));

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [newOrders, setNewOrders] = useState<RecentOrder[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [salesByLocation, setSalesByLocation] = useState<SalesByLocation[]>([]);
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [orderAnalytics, setOrderAnalytics] = useState<SalesAnalytics | null>(null);
  const [orderAnalyticsDaily, setOrderAnalyticsDaily] = useState<SalesAnalytics | null>(null);
  const [todaySales, setTodaySales] = useState<TodaySales | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch dashboard data on component mount
  useEffect(() => {
    // Don't fetch if not authenticated
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all dashboard data in parallel
        const [
          statsResponse,
          ordersResponse,
          sellersResponse,
          locationResponse,
          analyticsResponse,
          orderAnalyticsResponse,
          orderAnalyticsDailyResponse,
          todaySalesResponse,
        ] = await Promise.all([
          getDashboardStats(),
          getRecentOrders(10),
          getTopSellers(10),
          getSalesByLocation(),
          getSalesAnalytics("day"), // Use daily data for the sales line chart
          getOrderAnalytics("month"),
          getOrderAnalytics("day"),
          getTodaySales(),
        ]);

        if (statsResponse.success) {
          console.log("Dashboard stats received:", statsResponse.data);
          setStats(statsResponse.data);
        } else {
          console.error("Failed to fetch dashboard stats:", statsResponse);
        }

        if (ordersResponse.success) {
          setNewOrders(ordersResponse.data);
        }

        if (sellersResponse.success) {
          setTopSellers(sellersResponse.data);
        }

        if (locationResponse.success) {
          setSalesByLocation(locationResponse.data);
        }

        if (analyticsResponse.success) {
          setSalesAnalytics(analyticsResponse.data);
        }

        if (orderAnalyticsResponse.success) {
          setOrderAnalytics(orderAnalyticsResponse.data);
        }

        if (orderAnalyticsDailyResponse.success) {
          setOrderAnalyticsDaily(orderAnalyticsDailyResponse.data);
        }

        if (todaySalesResponse.success) {
          setTodaySales(todaySalesResponse.data);
        }
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError(
          err.response?.data?.message ||
            "Failed to load dashboard data. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAuthenticated, token]);

  // Icons for KPI cards
  const userIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="12"
        cy="8"
        r="4"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M4 20c0-4 3.5-7 8-7s8 3 8 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );

  const categoryIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
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
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
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
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const ordersIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
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
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
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
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
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
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
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

  const soldOutIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 12H16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  const lowStockIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 9V15M9 12H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  const abandonedCartIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="9" x2="14" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="9" x2="12" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  // Transform sales analytics data for charts
  const salesThisMonth = salesAnalytics?.thisPeriod || [];
  const salesLastMonth = salesAnalytics?.lastPeriod || [];

  // Transform order analytics data for charts (real data from backend)
  const orderDataDec2025 = orderAnalyticsDaily?.thisPeriod || [];
  const orderData2025 = orderAnalytics?.thisPeriod || [];

  const totalPagesNewOrders = Math.ceil(newOrders.length / entriesPerPage);
  const startIndexNewOrders = (currentPage - 1) * entriesPerPage;
  const endIndexNewOrders = startIndexNewOrders + entriesPerPage;
  const displayedNewOrders = newOrders.slice(
    startIndexNewOrders,
    endIndexNewOrders
  );

  const totalPagesTopSellers = Math.ceil(topSellers.length / entriesPerPage);
  const startIndexTopSellers = (currentPage - 1) * entriesPerPage;
  const endIndexTopSellers = startIndexTopSellers + entriesPerPage;
  const displayedTopSellers = topSellers.slice(
    startIndexTopSellers,
    endIndexTopSellers
  );

  // Calculate sales today and comparison from today's sales data
  const salesToday = todaySales?.salesToday || 0;
  const salesLastWeekSameDay = todaySales?.salesLastWeekSameDay || 0;
  const salesDifference = salesToday - salesLastWeekSameDay;
  const salesPercentChange =
    salesLastWeekSameDay > 0
      ? ((salesDifference / salesLastWeekSameDay) * 100).toFixed(0)
      : salesToday > 0 ? "100" : "0";

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-color)] mb-4"></div>
          <p className="text-neutral-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            Error Loading Dashboard
          </h3>
          <p className="text-neutral-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white px-4 py-2 rounded-lg transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No stats data
  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-neutral-600">No dashboard data available</p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-4 sm:space-y-6 relative">
      {/* Sharing Modal Overlay */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-6 sm:hidden" />

            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-neutral-800">Sharing text</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="relative group mb-8">
              <textarea
                value={sharingText}
                onChange={(e) => setSharingText(e.target.value)}
                rows={6}
                className="w-full bg-neutral-50 border border-neutral-100 rounded-3xl p-5 text-sm text-neutral-700 leading-relaxed outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all resize-none shadow-inner"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sharingText);
                  alert('Copied to clipboard!');
                }}
                className="absolute right-4 top-4 p-2 bg-white rounded-xl shadow-sm border border-neutral-100 text-neutral-400 hover:text-[var(--primary-color)] transition-colors"
                title="Copy to clipboard"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Geeta Stores',
                    text: sharingText,
                    url: `https://${storeLink}`
                  }).catch(err => console.log('Error sharing', err));
                } else {
                  navigator.clipboard.writeText(sharingText);
                  alert('Sharing text copied to clipboard!');
                }
                setShowShareModal(false);
              }}
              className="w-full bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white py-4 rounded-3xl font-bold text-lg shadow-lg shadow-[var(--primary-color)]/20 transition-all active:scale-[0.98]"
            >
              Share Now
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid - 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <DashboardCard
          icon={userIcon}
          title="Total User"
          value={stats.totalUser}
          accentColor="var(--primary-color)"
        />
        <DashboardCard
          icon={categoryIcon}
          title="Total Category"
          value={stats.totalCategory}
          accentColor="#eab308"
        />
        <DashboardCard
          icon={subcategoryIcon}
          title="Total Subcategory"
          value={stats.totalSubcategory ?? 0}
          accentColor="var(--primary-color)"
        />
        <DashboardCard
          icon={productIcon}
          title="Total Product"
          value={stats.totalProduct}
          accentColor="#ef4444"
        />
        <DashboardCard
          icon={ordersIcon}
          title="Total Orders"
          value={stats.totalOrders}
          accentColor="var(--primary-color)"
        />
        <DashboardCard
          icon={completedOrdersIcon}
          title="Completed Orders"
          value={stats.completedOrders}
          accentColor="#16a34a"
        />
        <DashboardCard
          icon={pendingOrdersIcon}
          title="Pending Orders"
          value={stats.pendingOrders}
          accentColor="#a855f7"
        />
        <DashboardCard
          icon={cancelledOrdersIcon}
          title="Cancelled Orders"
          value={stats.cancelledOrders}
          accentColor="#ef4444"
        />
        <DashboardCard
          icon={soldOutIcon}
          title="Product Sold Out"
          value={stats.soldOutProducts}
          accentColor="var(--primary-color)"
        />
        <DashboardCard
          icon={lowStockIcon}
          title="Product low on Stock"
          value={stats.lowStockProducts}
          accentColor="#eab308"
        />
        <DashboardCard
          icon={abandonedCartIcon}
          title="Abandoned Carts"
          value={JSON.parse(localStorage.getItem('abandoned_carts') || '[]').length || 3}
          accentColor="var(--primary-color)"
        />
      </div>

      {/* Online Store Link Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 sm:p-6 mt-4">
        <div className="flex flex-col space-y-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Your online store link</h3>
            <p className="text-sm text-neutral-500">Share with customers to start getting orders.</p>
          </div>

          <div className="flex items-center">
            <div className="flex-1 bg-white border border-neutral-200 rounded-full px-5 py-3 flex items-center justify-between shadow-sm focus-within:ring-2 focus-within:ring-[var(--primary-color)]/20 focus-within:border-[var(--primary-color)] transition-all">
              <input
                type="text"
                value={storeLink}
                onChange={(e) => setStoreLink(e.target.value)}
                className="flex-1 text-[var(--primary-color)] font-medium outline-none bg-transparent mr-2 min-w-0"
              />
              <button
                onClick={() => {
                  setSharingText(getSharingText(storeLink));
                  setShowShareModal(true);
                }}
                className="p-2 rounded-full border border-[var(--primary-color)] text-[var(--primary-color)] hover:bg-[var(--primary-color)]/5 transition-colors flex-shrink-0"
                aria-label="Share"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                <span className="font-bold">www.geeta.com</span> URL is available
              </p>
            </div>
            <button className="px-6 py-2 rounded-full border-2 border-[var(--primary-color)] text-[var(--primary-color)] text-sm font-bold hover:bg-[var(--primary-color)]/5 transition-colors whitespace-nowrap">
              Connect domain
            </button>
          </div>
        </div>
      </div>

      {/* Sales Section - Top Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Total Sales Today */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-neutral-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            Total Sales Today
          </h3>
          <div className="mb-4">
            <p className="text-3xl font-bold text-neutral-900">
              ₹{salesToday.toFixed(2)}
            </p>
            {salesDifference >= 0 ? (
              <p className="text-sm text-[var(--primary-color)] mt-1">
                ▲ ₹{Math.abs(salesDifference).toFixed(2)} (+{salesPercentChange}%)
                vs same day last week
              </p>
            ) : (
              <p className="text-sm text-red-600 mt-1">
                ▼ ₹{Math.abs(salesDifference).toFixed(2)} ({salesPercentChange}%)
                vs same day last week
              </p>
            )}
          </div>
          <SalesLineChart
            thisMonthData={salesThisMonth}
            lastMonthData={salesLastMonth}
            height={200}
          />
        </div>

        {/* Sales by Location & Gauge */}
        <div className="space-y-4 sm:space-y-6">
          {/* Sales by Location */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Sales by Location
            </h3>
            <div className="space-y-3">
              {salesByLocation.length > 0 ? (
                salesByLocation.map((location, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">
                      {location.location}
                    </span>
                    <span className="text-sm font-semibold text-neutral-900">
                      ₹{(location.amount / 1000).toFixed(1)}K
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">
                  No location data available
                </p>
              )}
            </div>
          </div>

          {/* Avg. Completed Order Value */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Avg. Completed Order Value
            </h3>
            <GaugeChart
              value={stats.avgCompletedOrderValue}
              maxValue={521}
              label="Average Order Value"
            />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ErrorBoundary fallback={<div className="text-sm text-red-600 p-4">Chart failed to load</div>}>
          <OrderChart
            title="Order - Dec 2025"
            data={orderDataDec2025}
            maxValue={3}
            height={400}
          />
        </ErrorBoundary>
        <ErrorBoundary fallback={<div className="text-sm text-red-600 p-4">Chart failed to load</div>}>
          <OrderChart
            title="Order - 2025"
            data={orderData2025}
            maxValue={80}
            height={400}
          />
        </ErrorBoundary>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {/* View New Orders Table */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-[var(--primary-color)] text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">
              View New Orders
            </h2>
          </div>

          <div className="px-4 sm:px-6 py-3 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-700">Show</span>
              <input
                type="number"
                value={entriesPerPage}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 10;
                  setEntriesPerPage(Math.max(1, Math.min(100, value)));
                  setCurrentPage(1);
                }}
                className="w-16 px-2 py-1 border border-neutral-300 rounded text-sm text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
                min="1"
                max="100"
              />
              <span className="text-sm text-neutral-700">entries</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      ID
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-neutral-400 cursor-pointer">
                        <path
                          d="M7 10L12 5L17 10M7 14L12 19L17 14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    User Details
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      O. Date
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-neutral-400 cursor-pointer">
                        <path
                          d="M7 10L12 5L17 10M7 14L12 19L17 14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      Status
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-neutral-400 cursor-pointer">
                        <path
                          d="M7 10L12 5L17 10M7 14L12 19L17 14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      Amount
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-neutral-400 cursor-pointer">
                        <path
                          d="M7 10L12 5L17 10M7 14L12 19L17 14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {displayedNewOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 sm:px-6 py-8 text-center text-sm text-neutral-500">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  displayedNewOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50">
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                        {order.orderNumber || order.id}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                        {order.customerName}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-neutral-600 bg-neutral-50">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                        ₹ {order.amount.toFixed(2)}
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <button
                          className="bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white p-2 rounded transition-colors"
                          aria-label="View order">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            <div className="text-xs sm:text-sm text-neutral-700">
              Showing {startIndexNewOrders + 1} to{" "}
              {Math.min(endIndexNewOrders, newOrders.length)} of{" "}
              {newOrders.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 border border-neutral-300 rounded ${
                  currentPage === 1
                    ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
                aria-label="Previous page">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
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
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(totalPagesNewOrders, prev + 1)
                  )
                }
                disabled={currentPage === totalPagesNewOrders}
                className={`p-2 border border-neutral-300 rounded ${
                  currentPage === totalPagesNewOrders
                    ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
                aria-label="Next page">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
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

        {/* View Top Seller Table */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-[var(--primary-color)] text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">
              View Top Seller
            </h2>
          </div>

          <div className="px-4 sm:px-6 py-3 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-700">Show</span>
              <input
                type="number"
                value={entriesPerPage}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 10;
                  setEntriesPerPage(Math.max(1, Math.min(100, value)));
                  setCurrentPage(1);
                }}
                className="w-16 px-2 py-1 border border-neutral-300 rounded text-sm text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)]"
                min="1"
                max="100"
              />
              <span className="text-sm text-neutral-700">entries</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      ID
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-neutral-400 cursor-pointer">
                        <path
                          d="M7 10L12 5L17 10M7 14L12 19L17 14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Seller Name
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Store Name
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      Total Revenue
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-neutral-400 cursor-pointer">
                        <path
                          d="M7 10L12 5L17 10M7 14L12 19L17 14"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {displayedTopSellers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 sm:px-6 py-8 text-center text-sm text-neutral-500">
                      No top sellers data available
                    </td>
                  </tr>
                ) : (
                  displayedTopSellers.map((seller) => (
                    <tr key={seller.sellerId} className="hover:bg-neutral-50">
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                        {seller.sellerId}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                        {seller.sellerName}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                        {seller.storeName}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                        ₹ {seller.totalRevenue.toFixed(2)}
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <button
                          className="bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white p-2 rounded transition-colors"
                          aria-label="View seller">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            <div className="text-xs sm:text-sm text-neutral-700">
              Showing {startIndexTopSellers + 1} to{" "}
              {Math.min(endIndexTopSellers, topSellers.length)} of{" "}
              {topSellers.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 border border-neutral-300 rounded ${
                  currentPage === 1
                    ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
                aria-label="Previous page">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M15 18L9 12L15 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <span className="px-3 py-2 border border-neutral-300 rounded text-sm text-neutral-700 bg-white">
                {currentPage}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(totalPagesTopSellers, prev + 1)
                  )
                }
                disabled={currentPage === totalPagesTopSellers}
                className={`p-2 border border-neutral-300 rounded ${
                  currentPage === totalPagesTopSellers
                    ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
                aria-label="Next page">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
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

      {/* Footer */}
      <div className="text-center text-sm text-neutral-500 py-4">
        Copyright © 2025. Developed By{" "}
        <a href="#" className="text-[var(--primary-color)] hover:text-[var(--primary-dark)]">
          Geeta Stores - 10 Minute App
        </a>
      </div>
    </div>
  );
}
