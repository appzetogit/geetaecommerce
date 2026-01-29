import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DeliveryHeader from '../components/DeliveryHeader';
import DeliveryBottomNav from '../components/DeliveryBottomNav';
import { getReturnTasks, updateReturnTaskStatus } from '../../../services/api/delivery/deliveryService';
import { useToast } from '../../../context/ToastContext';

export default function DeliveryReturnOrders() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'Return' | 'Replacement'>('Return');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await getReturnTasks();
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load return tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, status: string, type: string) => {
      try {
          const response = await updateReturnTaskStatus(taskId, status);
          if (response.success) {
              showToast(`${type} status updated to ${status}`, 'success');
              fetchTasks();
          }
      } catch (err: any) {
          showToast(err.message || 'Failed to update status', 'error');
      }
  };

  const filteredTasks = tasks.filter(t => t.requestType === activeTab);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center pb-20">
        <p className="text-neutral-500 font-medium">Loading tasks...</p>
        <DeliveryBottomNav />
      </div>
    );
  }

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
          <h2 className="text-neutral-900 text-xl font-semibold">Tasks</h2>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-white rounded-xl mb-4 border border-neutral-200">
            <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'Return' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-neutral-500'}`}
                onClick={() => setActiveTab('Return')}
            >
                Return Pickups
            </button>
            <button
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'Replacement' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-neutral-500'}`}
                onClick={() => setActiveTab('Replacement')}
            >
                Replacements
            </button>
        </div>

        {error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center mb-4">
                {error}
                <button onClick={fetchTasks} className="block w-full mt-2 text-sm underline">Retry</button>
            </div>
        ) : (
            <div className="space-y-3">
                {filteredTasks.map((task) => (
                    <div key={task.id} className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                    task.requestType === 'Return' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                                }`}>
                                    {task.requestType}
                                </span>
                                <h3 className="font-semibold text-gray-900 mt-1">{task.orderNumber}</h3>
                                <p className="text-sm text-gray-700 font-medium">{task.productName}</p>
                            </div>
                            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded font-medium">
                                {task.status}
                            </span>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1 mb-3">
                            <p><span className="font-medium text-gray-700">Customer:</span> {task.customerName}</p>
                            <p><span className="font-medium text-gray-700">Phone:</span> {task.customerPhone}</p>
                            <p><span className="font-medium text-gray-700">Address:</span> {task.address?.address}, {task.address?.city}</p>
                            <p><span className="font-medium text-gray-700">Reason:</span> {task.reason}</p>
                        </div>

                        <div className="flex gap-2">
                            {task.status === 'Assigned' && (
                                <button
                                    onClick={() => handleUpdateStatus(task.id, 'Accepted', task.requestType)}
                                    className="w-full py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium"
                                >
                                    Accept Task
                                </button>
                            )}

                            {task.status === 'Accepted' && (
                                <button
                                    onClick={() => handleUpdateStatus(task.id, 'Picked Up', task.requestType)}
                                    className="w-full py-2 bg-orange-600 text-white rounded-lg text-sm font-medium"
                                >
                                    Confirm Pickup
                                </button>
                            )}

                            {task.status === 'Picked Up' && task.requestType === 'Replacement' && (
                                <button
                                    onClick={() => handleUpdateStatus(task.id, 'Delivered', task.requestType)}
                                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                                >
                                    Deliver New Item (Replacement)
                                </button>
                            )}

                            {task.status === 'Picked Up' && task.requestType === 'Return' && (
                                <button
                                    onClick={() => handleUpdateStatus(task.id, 'Delivered', task.requestType)}
                                    className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                                >
                                    Confirm Delivery to Store
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {filteredTasks.length === 0 && (
                    <div className="py-20 text-center">
                        <div className="bg-neutral-200 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-neutral-500">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <p className="text-neutral-500 font-medium">No active {activeTab.toLowerCase()} tasks</p>
                    </div>
                )}
            </div>
        )}
      </div>
      <DeliveryBottomNav />
    </div>
  );
}

