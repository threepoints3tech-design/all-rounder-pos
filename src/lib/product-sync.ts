const PRODUCT_SYNC_EVENT = "pos:products-changed";
const PRODUCT_SYNC_CHANNEL = "pos-products-sync";

type ProductSyncMessage = {
  type: typeof PRODUCT_SYNC_EVENT;
  tenantId: string | null;
};

function productSyncMessage(tenantId: string | null): ProductSyncMessage {
  return { type: PRODUCT_SYNC_EVENT, tenantId };
}

/**
 * Let other POS screens know that the catalogue (or its stock) changed.
 * BroadcastChannel covers separate tabs in the same browser; the caller also
 * receives a window event immediately. Other devices are kept current by the
 * small server refresh interval in the POS screens.
 */
export function announceProductChange(tenantId: string | null) {
  if (typeof window === "undefined") return;

  const message = productSyncMessage(tenantId);
  window.dispatchEvent(new CustomEvent(PRODUCT_SYNC_EVENT, { detail: message }));

  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(PRODUCT_SYNC_CHANNEL);
  channel.postMessage(message);
  channel.close();
}

export function listenForProductChanges(
  onChange: (tenantId: string | null) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  const receiveWindowEvent = (event: Event) => {
    const message = (event as CustomEvent<ProductSyncMessage>).detail;
    onChange(message?.tenantId ?? null);
  };
  window.addEventListener(PRODUCT_SYNC_EVENT, receiveWindowEvent);

  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(PRODUCT_SYNC_CHANNEL);
  const receiveChannelMessage = (event: MessageEvent<ProductSyncMessage>) => {
    if (event.data?.type === PRODUCT_SYNC_EVENT) onChange(event.data.tenantId);
  };
  channel?.addEventListener("message", receiveChannelMessage);

  return () => {
    window.removeEventListener(PRODUCT_SYNC_EVENT, receiveWindowEvent);
    channel?.removeEventListener("message", receiveChannelMessage);
    channel?.close();
  };
}
