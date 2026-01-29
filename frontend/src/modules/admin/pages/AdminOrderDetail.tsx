import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getOrderById, updateOrderStatus, Order } from '../../../services/api/admin/adminOrderService';

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [updating, setUpdating] = useState(false);

  // Fetch order detail from API
  useEffect(() => {
    const fetchOrderDetail = async () => {
      if (!id) return;

      setLoading(true);
      setError('');
      try {
        const response = await getOrderById(id);
        if (response.success && response.data) {
          setOrder(response.data);
        } else {
          setError(response.message || 'Failed to fetch order details');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetail();
  }, [id]);

  // Handle status update
  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;

    setUpdating(true);
    try {
      const response = await updateOrderStatus(order._id, { status: newStatus });
      if (response.success && response.data) {
        setOrder(response.data);
        alert('Order status updated successfully');
      } else {
        alert('Failed to update order status');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-neutral-500">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/admin/orders/all')}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Order Not Found</h2>
          <button
            onClick={() => navigate('/admin/orders/all')}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const customer = typeof order.customer === 'object' ? order.customer : null;
  const deliveryBoy = typeof order.deliveryBoy === 'object' ? order.deliveryBoy : null;
  const items = Array.isArray(order.items) ? order.items : [];

  const statusOptions = [
    'Received',
    'Pending',
    'Processed',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
    'Rejected',
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/orders/all')}
          className="text-teal-600 hover:text-teal-700 mb-4 flex items-center gap-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Orders
        </button>
        <h1 className="text-2xl font-bold text-neutral-900">Order Details</h1>
        <p className="text-neutral-600 mt-1">Order #{order.orderNumber}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Order Status</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Current Status
              </label>
              <select
                value={order.status}
                onChange={(e) => handleStatusUpdate(e.target.value)}
                disabled={updating}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-neutral-600">Order Date:</span>
                <span className="ml-2 font-medium">{formatDate(order.orderDate)}</span>
              </div>
              <div>
                <span className="text-neutral-600">Payment Status:</span>
                <span className="ml-2 font-medium capitalize">{order.paymentStatus}</span>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Order Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Product</th>
                    <th className="text-right py-2 px-2">Price</th>
                    <th className="text-right py-2 px-2">Qty</th>
                    <th className="text-right py-2 px-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.filter((item: any) => !item.isFreeGift).map((item: any, index: number) => {
                    const product = typeof item.product === 'object' ? item.product : null;
                    const seller = typeof item.seller === 'object' ? item.seller : null;
                    return (
                      <tr key={item._id || index} className="border-b">
                        <td className="py-3 px-2">
                          <div>
                            <div className="font-medium">{item.productName || product?.productName || 'N/A'}</div>
                            {seller && (
                              <div className="text-sm text-neutral-500">
                                Seller: {seller.storeName || seller.sellerName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-3 px-2">₹{item.unitPrice?.toFixed(2) || '0.00'}</td>
                        <td className="text-right py-3 px-2">{item.quantity || 0}</td>
                        <td className="text-right py-3 px-2 font-medium">
                          ₹{item.total?.toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Free Gift Section */}
            {items.some((item: any) => item.isFreeGift) && (
                <div className="mt-6 bg-green-50 border border-green-200 rounded-lg overflow-hidden">
                    <div className="bg-green-100 px-4 py-2 border-b border-green-200 flex items-center gap-2">
                        <span className="text-lg">🎁</span>
                        <h3 className="font-bold text-green-800">Free Gift Applied</h3>
                    </div>
                    <div className="p-4">
                        {items.filter((item: any) => item.isFreeGift).map((item: any, index: number) => (
                            <div key={index} className="flex justify-between items-start border-b border-green-100 last:border-0 pb-3 last:pb-0 mb-3 last:mb-0">
                                <div>
                                    <p className="font-bold text-green-900">{item.productName || item.product?.productName || 'Free Gift'}</p>
                                    <p className="text-sm text-green-700">Qty: {item.quantity}</p>
                                    {item.freeGiftReason && (
                                        <p className="text-xs text-green-600 mt-1 italic">Reason: {item.freeGiftReason}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-green-900">₹0</p>
                                    <span className="inline-block px-2 py-0.5 bg-green-200 text-green-800 text-[10px] rounded uppercase font-bold mt-1">Free</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>

          {/* Delivery Address */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Delivery Address</h2>
            <div className="text-neutral-700">
              <p className="font-medium">{order.customerName}</p>
              <p>{order.deliveryAddress.address}</p>
              <p>
                {order.deliveryAddress.city}, {order.deliveryAddress.state || ''} -{' '}
                {order.deliveryAddress.pincode}
              </p>
              {order.deliveryAddress.landmark && (
                <p className="text-sm text-neutral-500">Landmark: {order.deliveryAddress.landmark}</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-neutral-600">Name:</span>
                <span className="ml-2 font-medium">{order.customerName}</span>
              </div>
              <div>
                <span className="text-neutral-600">Email:</span>
                <span className="ml-2 font-medium">{order.customerEmail}</span>
              </div>
              <div>
                <span className="text-neutral-600">Phone:</span>
                <span className="ml-2 font-medium">{order.customerPhone}</span>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Subtotal:</span>
                <span className="font-medium">₹{order.subtotal?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Tax:</span>
                <span className="font-medium">₹{order.tax?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Shipping:</span>
                <span className="font-medium">₹{order.shipping?.toFixed(2) || '0.00'}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span className="font-medium">-₹{order.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                <span>Total:</span>
                <span>₹{order.total?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Delivery Information */}
          {deliveryBoy && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Delivery Information</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-neutral-600">Delivery Boy:</span>
                  <span className="ml-2 font-medium">{deliveryBoy.name}</span>
                </div>
                {deliveryBoy.mobile && (
                  <div>
                    <span className="text-neutral-600">Mobile:</span>
                    <span className="ml-2 font-medium">{deliveryBoy.mobile}</span>
                  </div>
                )}
                {order.deliveryBoyStatus && (
                  <div>
                    <span className="text-neutral-600">Status:</span>
                    <span className="ml-2 font-medium capitalize">{order.deliveryBoyStatus}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Information</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-neutral-600">Method:</span>
                <span className="ml-2 font-medium">{order.paymentMethod}</span>
              </div>
              <div>
                <span className="text-neutral-600">Status:</span>
                <span className="ml-2 font-medium capitalize">{order.paymentStatus}</span>
              </div>
              {order.paymentId && (
                <div>
                  <span className="text-neutral-600">Payment ID:</span>
                  <span className="ml-2 font-medium text-xs">{order.paymentId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

