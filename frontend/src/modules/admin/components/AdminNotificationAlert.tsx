import React, { useState, useEffect, useRef } from 'react';
import api from '../../../services/api/config';

export interface AdminNotificationData {
  type: string;
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customer: {
    name: string;
    email?: string;
    phone: string;
    address: {
      address?: string;
      city?: string;
      pincode?: string;
      landmark?: string;
    };
  };
  items: {
    productName: string;
    quantity: number;
    price: number;
    total: number;
    variation?: string;
  }[];
  totalAmount: number;
  timestamp: Date;
}

interface AdminNotificationAlertProps {
  notification: AdminNotificationData | null;
  onClose: () => void;
  onActionComplete: () => void;
}

const AdminNotificationAlert: React.FC<AdminNotificationAlertProps> = ({ notification, onClose, onActionComplete }) => {
  const [volume, setVolume] = useState(0.8);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (notification) {
      if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.play().catch(err => console.error('Error playing sound:', err));
      }
    }
  }, [notification]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  if (!notification) return null;

  const handleStatusUpdate = async (newStatus: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const response = await api.put(`/admin/orders/${notification.orderId}/status`, {
        status: newStatus,
      });
      if (response.data.success) {
        onActionComplete();
        onClose();
      } else {
        alert("Failed to update status");
      }
    } catch (err: any) {
      console.error("Error updating status:", err);
      alert(err.response?.data?.message || "Failed to update status");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
      <audio
        ref={audioRef}
        src="/assets/sound/delivery-alert.mp3"
        loop
      />

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between bg-[var(--primary-dark)] text-white`}>
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-2 rounded-full">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {notification.type === 'NEW_ORDER' ? 'New Order Alert!' : 'Order Status Updated'}
              </h2>
              <p className="text-sm opacity-90">#{notification.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-10 p-1 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Volume Control */}
          <div className="mb-6 bg-neutral-50 p-3 rounded-lg flex items-center gap-4">
            <span className="text-neutral-500">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 accent-[var(--primary-dark)]"
            />
          </div>

          {/* Customer Info */}
          <section className="mb-6">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">Customer Information</h3>
            <div className="bg-neutral-50 rounded-lg p-4">
              <p className="font-bold text-neutral-800 text-lg">{notification.customer.name}</p>
              <p className="text-neutral-600 flex items-center gap-2 mt-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                {notification.customer.phone}
              </p>
              <div className="text-neutral-600 flex items-start gap-2 mt-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 flex-shrink-0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>
                  {notification.customer.address?.address || ''} {notification.customer.address?.city ? `, ${notification.customer.address.city}` : ''} {notification.customer.address?.pincode ? `, ${notification.customer.address.pincode}` : ''}
                  {notification.customer.address?.landmark && <span className="block text-sm text-neutral-400 mt-0.5">Landmark: {notification.customer.address.landmark}</span>}
                </span>
              </div>
            </div>
          </section>

          {/* Order Details */}
          <section>
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">Order Details</h3>
            <div className="space-y-3">
              {notification.items?.map((item, index) => (
                <div key={index} className="flex justify-between items-start py-2 border-b border-neutral-100 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-neutral-800">{item.productName}</p>
                    <p className="text-sm text-neutral-500">
                      Qty: {item.quantity} × ₹{(item.price || 0).toFixed(2)}
                      {item.variation && <span className="ml-2 px-1.5 py-0.5 bg-neutral-100 rounded text-[10px]">{item.variation}</span>}
                    </p>
                  </div>
                  <p className="font-bold text-neutral-800">₹{(item.total || 0).toFixed(2)}</p>
                </div>
              ))}

              <div className="flex justify-between items-center pt-4 mt-2 border-t-2 border-neutral-100">
                <span className="text-lg font-bold text-neutral-800">Total</span>
                <span className="text-2xl font-black text-[var(--primary-dark)]">₹{(notification.totalAmount || 0).toFixed(2)}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-neutral-50 border-t border-neutral-200 flex gap-4">
          <button
            onClick={() => handleStatusUpdate('Rejected')}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl font-bold text-red-600 bg-red-50 border border-red-200 shadow-sm transition-transform active:scale-95 hover:bg-red-100 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Reject Order'}
          </button>
          <button
            onClick={() => handleStatusUpdate('Processed')}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl font-bold text-white bg-green-600 shadow-lg transition-transform active:scale-95 hover:bg-green-700 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Accept Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminNotificationAlert;
