import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getOrderById, updateOrderStatus, updateOrderItems, Order, OrderItem as IOrderItem } from '../../../services/api/admin/adminOrderService';
import { getProducts, Product } from '../../../services/api/admin/adminProductService';

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

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
          // Initialize editable items
          const items = Array.isArray(response.data.items) ? response.data.items : [];
          setEditableItems(items.filter((item: any) => !item.isFreeGift).map((item: any) => ({
            _id: item._id,
            productId: typeof item.product === 'object' ? item.product?._id : item.product,
            productName: item.productName || item.product?.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            variation: item.variation,
            // Find variationId if possible
            variationId: item.variationId // We might need to handle this
          })));
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

  // Add search logic
  useEffect(() => {
    const timer = setTimeout(() => {
        if (searchQuery.trim().length >= 2) {
            handleSearch();
        } else {
            setSearchResults([]);
        }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = async () => {
    setSearching(true);
    try {
        const response = await getProducts({ search: searchQuery, limit: 10, status: 'Active' });
        if (response.success) {
            setSearchResults(response.data);
        }
    } catch (err) {
        console.error("Search error:", err);
    } finally {
        setSearching(false);
    }
  };

  const handleAddItem = (product: Product, variation?: any) => {
    const newItem = {
        productId: product._id,
        productName: product.productName,
        sku: variation?.sku || product.sku,
        quantity: 1,
        unitPrice: variation?.price || product.price,
        variation: variation ? `${variation.name}: ${variation.value}` : '',
        variationId: variation?._id
    };
    setEditableItems([...editableItems, newItem]);
    setShowProductSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveItem = (index: number) => {
    setEditableItems(editableItems.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const updated = [...editableItems];
    updated[index].quantity = newQty;
    setEditableItems(updated);
  };

  const handleSaveItems = async () => {
    if (!order) return;
    setUpdating(true);
    try {
        const response = await updateOrderItems(order._id, editableItems.map(item => ({
            productId: item.productId,
            variationId: item.variationId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            sku: item.sku
        })));
        if (response.success && response.data) {
            setOrder(response.data);
            setIsEditingItems(false);
            alert('Order items updated successfully');
        } else {
            alert(response.message || 'Failed to update order items');
        }
    } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to update order items');
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Order Items</h2>
              {!isEditingItems ? (
                <button
                  onClick={() => setIsEditingItems(true)}
                  disabled={updating || order.status === 'Delivered' || order.status === 'Cancelled'}
                  className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Items
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowProductSearch(true)}
                    className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                     </svg>
                     Add Item
                  </button>
                  <button
                    onClick={handleSaveItems}
                    disabled={updating}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                        setIsEditingItems(false);
                        // Reset editable items from current order
                        const items = Array.isArray(order?.items) ? order.items : [];
                        setEditableItems(items.filter((item: any) => !item.isFreeGift).map((item: any) => ({
                            _id: item._id,
                            productId: typeof item.product === 'object' ? item.product?._id : item.product,
                            productName: item.productName || item.product?.productName,
                            sku: item.sku,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            variation: item.variation,
                            variationId: item.variationId
                        })));
                    }}
                    className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Product</th>
                    <th className="text-right py-2 px-2">Price</th>
                    <th className="text-right py-2 px-2">Qty</th>
                    <th className="text-right py-2 px-2">Total</th>
                    {isEditingItems && <th className="text-center py-2 px-2">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {(isEditingItems ? editableItems : items.filter((item: any) => !item.isFreeGift)).map((item: any, index: number) => {
                    const product = typeof item.product === 'object' ? item.product : null;
                    const seller = typeof item.seller === 'object' ? item.seller : null;
                    const unitPrice = item.unitPrice || 0;
                    const quantity = item.quantity || 0;
                    const total = unitPrice * quantity;

                    return (
                      <tr key={item._id || index} className="border-b">
                        <td className="py-3 px-2">
                          <div>
                            <div className="font-medium">{item.productName || product?.productName || 'N/A'}</div>
                            {item.variation && <div className="text-xs text-teal-600 font-medium">{item.variation}</div>}
                            {seller && (
                              <div className="text-sm text-neutral-500">
                                Seller: {seller.storeName || seller.sellerName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-3 px-2">₹{unitPrice.toFixed(2)}</td>
                        <td className="text-right py-3 px-2">
                          {isEditingItems ? (
                            <input
                              type="number"
                              min="1"
                              value={quantity}
                              onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                              className="w-16 px-1 py-1 border rounded text-right"
                            />
                          ) : (
                            quantity
                          )}
                        </td>
                        <td className="text-right py-3 px-2 font-medium">
                          ₹{total.toFixed(2)}
                        </td>
                        {isEditingItems && (
                          <td className="text-center py-3 px-2">
                            <button
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Product Search Modal/Dropdown */}
            {showProductSearch && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b flex justify-between items-center bg-teal-50">
                    <h3 className="font-bold text-teal-900">Add Product to Order</h3>
                    <button onClick={() => setShowProductSearch(false)} className="text-neutral-500 hover:text-neutral-700">
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                       </svg>
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="relative mb-4">
                       <input
                         autoFocus
                         type="text"
                         placeholder="Search product by name or SKU..."
                         className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                         value={searchQuery}
                         onChange={(e) => setSearchQuery(e.target.value)}
                       />
                       <svg className="absolute left-3 top-2.5 text-neutral-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                       </svg>
                    </div>

                    <div className="overflow-y-auto flex-1">
                       {searching ? (
                          <div className="p-8 text-center text-neutral-500">Searching...</div>
                       ) : searchResults.length > 0 ? (
                          <div className="space-y-2">
                             {searchResults.map((product) => (
                                <div key={product._id} className="border rounded-lg p-3 hover:bg-neutral-50 transition-colors">
                                   <div className="flex justify-between items-start">
                                      <div className="flex gap-4">
                                         <img src={product.mainImage} alt="" className="w-12 h-12 object-contain bg-white rounded border" />
                                         <div>
                                            <p className="font-semibold text-neutral-900">{product.productName}</p>
                                            <p className="text-xs text-neutral-500">SKU: {product.sku}</p>
                                            <p className="text-sm font-medium text-teal-600">₹{product.price}</p>
                                         </div>
                                      </div>
                                      {!product.variations || product.variations.length === 0 ? (
                                         <button
                                           onClick={() => handleAddItem(product)}
                                           className="bg-teal-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-teal-700"
                                         >
                                            Select
                                         </button>
                                      ) : null}
                                   </div>
                                   {product.variations && product.variations.length > 0 && (
                                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                         {product.variations.map((v: any) => (
                                            <button
                                              key={v._id}
                                              onClick={() => handleAddItem(product, v)}
                                              className="text-[10px] p-2 border rounded bg-white hover:border-teal-500 hover:text-teal-600 text-left"
                                            >
                                               <p className="font-bold">{v.name}: {v.value}</p>
                                               <p>₹{v.price}</p>
                                            </button>
                                         ))}
                                      </div>
                                   )}
                                </div>
                             ))}
                          </div>
                       ) : searchQuery.length >= 2 ? (
                          <div className="p-8 text-center text-neutral-500">No products found</div>
                       ) : (
                          <div className="p-8 text-center text-neutral-400">Type at least 2 characters to search...</div>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            )}

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

