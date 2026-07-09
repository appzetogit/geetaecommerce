import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyCreditPayment } from "../../services/api/admin/creditService";
import { useToast } from "../../context/ToastContext";

type Portal = "admin" | "seller";

export default function POSCreditVerify({ portal }: { portal: Portal }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying credit payment...");

  useEffect(() => {
    const customerId = searchParams.get("customerId");
    const amount = searchParams.get("amount");
    const merchantTransactionId = searchParams.get("merchantTransactionId");

    if (!customerId || !amount || !merchantTransactionId) {
      setStatus("error");
      setMessage("Missing payment details.");
      return;
    }

    (async () => {
      try {
        const response = await verifyCreditPayment({
          customerId,
          amount: parseFloat(amount),
          paymentId: merchantTransactionId,
          gateway: "PhonePe",
        });
        if (response.success) {
          setStatus("success");
          setMessage("Credit payment recorded successfully.");
          showToast("Payment recorded", "success");
        } else {
          setStatus("error");
          setMessage(response.message || "Verification failed.");
        }
      } catch {
        setStatus("error");
        setMessage("Error verifying credit payment.");
      }
    })();
  }, [searchParams, showToast]);

  const backPath =
    portal === "admin" ? "/admin/pos/customers" : "/seller/pos/customers";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-xl font-bold mb-3">Credit Payment</h1>
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
          onClick={() => navigate(backPath)}
          className="mt-6 w-full py-3 rounded-xl bg-[var(--primary-color)] text-white font-semibold"
        >
          Back to Customers
        </button>
      </div>
    </div>
  );
}
