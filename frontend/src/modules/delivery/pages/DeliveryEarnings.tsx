import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { getDashboardStats, getEarningsHistory } from '../../../services/api/delivery/deliveryService';

export default function DeliveryEarnings() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [earningsHistory, setEarningsHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, historyData] = await Promise.all([
          getDashboardStats(),
          getEarningsHistory()
        ]);
        setStats(statsData);
        setEarningsHistory(historyData);
      } catch (err: any) {
        setError(err.message || 'Failed to load earnings data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center pb-20">
        <p className="text-neutral-500">Loading earnings...</p>
        <DeliveryBottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center pb-20">
        <p className="text-red-500">{error}</p>
        <DeliveryBottomNav />
      </div>
    );
  }

  const totalDeliveries = earningsHistory.reduce((sum, day) => sum + day.deliveries, 0);

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <DeliveryHeader />
      <div className="px-4 py-4">
        <div className="flex items-center mb-4">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 hover:bg-neutral-200 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 className="text-neutral-900 text-xl font-semibold">Earnings</h2>
        </div>

        {/* Total Earnings Card */}
        <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl p-6 text-white mb-4 shadow-sm">
          <p className="text-orange-100 text-sm mb-2">Total Earnings</p>
          <p className="text-3xl font-bold mb-1">₹ {stats?.totalEarning?.toFixed(2) || '0.00'}</p>
          <p className="text-orange-100 text-xs">From {totalDeliveries} deliveries (Past 30 days)</p>
        </div>

        {/* Today's Earnings */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-500 text-xs mb-1">Today's Earnings</p>
              <p className="text-neutral-900 text-2xl font-bold">₹ {stats?.todayEarning || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-neutral-500 text-xs mb-1">Deliveries Today</p>
              <p className="text-neutral-900 text-2xl font-bold">{stats?.todayDeliveredCount || 0}</p>
            </div>
          </div>
        </div>

        {/* Earnings History */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-4 border-b border-neutral-200">
            <h3 className="text-neutral-900 font-semibold">Recent Earnings</h3>
          </div>
          <div className="divide-y divide-neutral-200">
            {earningsHistory.length > 0 ? (
              earningsHistory.map((day, index) => (
                <div key={index} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="text-neutral-900 text-sm font-medium">{day.date}</p>
                    <p className="text-neutral-500 text-xs mt-1">{day.deliveries} deliveries</p>
                  </div>
                  <p className="text-neutral-900 text-lg font-bold">₹ {day.amount}</p>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-neutral-500 text-sm">No recent earnings</div>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 mt-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">Total (Lifetime)</p>
              <p className="text-neutral-900 text-xl font-bold">₹ {stats?.totalEarning || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">Avg per Delivery</p>
              <p className="text-neutral-900 text-xl font-bold">
                ₹ {totalDeliveries > 0 ? Math.round((stats?.totalEarning || 0) / (stats?.totalDeliveredCount || 1)) : 0}
              </p>
            </div>
          </div>
        </div>

        {/* Withdraw Button */}
        <button className="w-full mt-4 bg-orange-500 text-white rounded-xl py-3 font-semibold hover:bg-orange-600 transition-colors">
          Withdraw Earnings
        </button>
      </div>
      <DeliveryBottomNav />
    </div>
  );
}

