import { PayOSAdapter } from "./payos.adapter";

type LocalPaymentOrder = {
  orderCode: number;
  paymentLinkId?: string;
  amountVnd: number;
  status: string;
};

const verifyPaidOrderProviderState = async ({
  order,
  adapter
}: {
  order: LocalPaymentOrder;
  adapter: PayOSAdapter;
}) => {
  if (order.status !== "PAID" || !order.paymentLinkId) {
    const error = new Error("BILLING_PROVIDER_VERIFICATION_INELIGIBLE") as Error & { code?: string };
    error.code = "BILLING_PROVIDER_VERIFICATION_INELIGIBLE";
    throw error;
  }

  const payment = await adapter.getPaymentStatus(order.paymentLinkId, order.orderCode);
  const orderCodeMatch = payment.providerOrderCode === order.orderCode;
  const paymentLinkIdMatch = payment.paymentLinkId === order.paymentLinkId;
  const amountMatch = payment.amount === order.amountVnd;
  const currencyMatch = payment.currency === "VND";
  const providerPaid = payment.status === "PAID";

  return {
    localStatus: order.status,
    providerStatus: payment.status,
    orderCodeMatch,
    paymentLinkIdMatch,
    amountMatch,
    currencyMatch,
    providerPaid,
    consistent: orderCodeMatch && paymentLinkIdMatch && amountMatch && currencyMatch && providerPaid
  };
};

export { verifyPaidOrderProviderState };
