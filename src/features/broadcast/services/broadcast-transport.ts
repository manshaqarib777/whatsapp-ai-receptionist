export type BroadcastDelivery = {
  organizationId: string;
  campaignId: string;
  recipientId: string;
  phoneNumber: string;
  template: { name: string; language: string; body: unknown };
};

export interface BroadcastTransport {
  send(delivery: BroadcastDelivery): Promise<void>;
}

/** M19 supplies Meta delivery. Until then, delivery must fail visibly. */
export const unavailableBroadcastTransport: BroadcastTransport = {
  async send(): Promise<void> {
    throw new Error('WhatsApp broadcast transport is not configured.');
  },
};
