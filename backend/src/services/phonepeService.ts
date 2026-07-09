import crypto from "crypto";
import axios from "axios";

export type PhonePeEnv = "UAT" | "PRODUCTION";

export interface PhonePePayRequest {
  merchantTransactionId: string;
  merchantUserId: string;
  amountPaise: number;
  redirectUrl: string;
  callbackUrl?: string;
  mobileNumber?: string;
}

export interface PhonePeInitiateResult {
  merchantTransactionId: string;
  redirectUrl: string;
  raw?: unknown;
}

export interface PhonePeStatusResult {
  success: boolean;
  state: string;
  transactionId?: string;
  raw?: unknown;
}

function getPhonePeConfig() {
  const merchantId = process.env.PHONEPE_MERCHANT_ID || "";
  const saltKey = process.env.PHONEPE_SALT_KEY || "";
  const saltIndex = process.env.PHONEPE_SALT_INDEX || "1";
  const env = (process.env.PHONEPE_ENV || "UAT").toUpperCase() as PhonePeEnv;

  if (!merchantId || !saltKey) {
    throw new Error("PhonePe credentials not configured (PHONEPE_MERCHANT_ID, PHONEPE_SALT_KEY)");
  }

  const baseUrl =
    env === "PRODUCTION"
      ? "https://api.phonepe.com/apis/hermes"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox";

  return { merchantId, saltKey, saltIndex, baseUrl };
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function buildVerifyHeader(payload: string, endpoint: string, saltKey: string, saltIndex: string): string {
  return `${sha256Hex(payload + endpoint + saltKey)}###${saltIndex}`;
}

/**
 * Initiate PhonePe Standard Checkout (PAY_PAGE redirect flow).
 */
export async function initiatePhonePePayment(
  request: PhonePePayRequest
): Promise<PhonePeInitiateResult> {
  const { merchantId, saltKey, saltIndex, baseUrl } = getPhonePeConfig();
  const endpoint = "/pg/v1/pay";

  const payload = {
    merchantId,
    merchantTransactionId: request.merchantTransactionId,
    merchantUserId: request.merchantUserId,
    amount: request.amountPaise,
    redirectUrl: request.redirectUrl,
    redirectMode: "REDIRECT",
    callbackUrl: request.callbackUrl || request.redirectUrl,
    mobileNumber: request.mobileNumber || "9999999999",
    paymentInstrument: { type: "PAY_PAGE" },
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const xVerify = buildVerifyHeader(base64Payload, endpoint, saltKey, saltIndex);

  const response = await axios.post(
    `${baseUrl}${endpoint}`,
    { request: base64Payload },
    {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify,
        "X-MERCHANT-ID": merchantId,
      },
    }
  );

  const data = response.data?.data;
  const redirectUrl = data?.instrumentResponse?.redirectInfo?.url;

  if (!redirectUrl) {
    throw new Error(
      response.data?.message || "PhonePe did not return a redirect URL"
    );
  }

  return {
    merchantTransactionId: request.merchantTransactionId,
    redirectUrl,
    raw: response.data,
  };
}

/**
 * Check payment status via PhonePe Status API.
 */
export async function getPhonePePaymentStatus(
  merchantTransactionId: string
): Promise<PhonePeStatusResult> {
  const { merchantId, saltKey, saltIndex, baseUrl } = getPhonePeConfig();
  const endpoint = `/pg/v1/status/${merchantId}/${merchantTransactionId}`;
  const xVerify = buildVerifyHeader("", endpoint, saltKey, saltIndex);

  const response = await axios.get(`${baseUrl}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": xVerify,
      "X-MERCHANT-ID": merchantId,
    },
  });

  const state = String(response.data?.data?.state || response.data?.code || "").toUpperCase();
  const success = state === "COMPLETED" || state === "PAYMENT_SUCCESS";

  return {
    success,
    state,
    transactionId: response.data?.data?.transactionId,
    raw: response.data,
  };
}

export function isPhonePeConfigured(): boolean {
  return Boolean(process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY);
}

export function buildPhonePeMerchantTransactionId(prefix: string, id: string): string {
  const raw = `${prefix}_${id}_${Date.now()}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 38);
}
