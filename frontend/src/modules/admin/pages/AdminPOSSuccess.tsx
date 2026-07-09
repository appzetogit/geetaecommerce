import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyPOSPayment } from "../../../services/api/admin/adminOrderService";
import { useToast } from "../../../context/ToastContext";

export default function AdminPOSSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying payment...");

  useEffect(() => {
    const orderId = searchParams.get("order_id");
    const merchantTransactionId = searchParams.get("merchantTransactionId");

    if (!orderId) {
      setStatus("error");
      setMessage("Missing order reference.");
      return;
    }

    (async () => {
      try {
        const response = await verifyPOSPayment({
          orderId,
          merchantTransactionId: merchantTransactionId || undefined,
          paymentId: merchantTransactionId || undefined,
        });
        if (response.success) {
          setStatus("success");
          setMessage("Payment successful. Order completed.");
          showToast("Payment verified successfully", "success");
          localStorage.removeItem("admin_pos_bills");
          localStorage.removeItem("admin_pos_active_bill");
        } else {
          setStatus("error");
          setMessage(response.message || "Payment verification failed.");
        }
      } catch {
        setStatus("error");
        setMessage("Error verifying payment.");
      }
    })();
  }, [searchParams, showToast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-xl font-bold mb-3">POS Payment</h1>
        <p
          className={
            status === "success"
              ? "text-green-600"
              : status === "error"
                ? "text-red-600"
                : "text-gray-600"
          }
        >
          {message}
        </p>
        <button
          type="button"
          onClick={() => navigate("/admin/pos/orders")}
          className="mt-6 w-full py-3 rounded-xl bg-[var(--primary-color)] text-white font-semibold"
        >
          Back to POS
        </button>
      </div>
    </div>
  );
}
