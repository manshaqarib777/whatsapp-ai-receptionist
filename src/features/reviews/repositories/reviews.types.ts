/**
 * Reviews row types — Milestone 16.
 */

export type ReviewPlatformRow = {
  id: string;
  name: string;
  provider: 'google' | 'facebook';
  isConnected: boolean;
  createdAt: Date;
};

export type ReviewRequestRow = {
  id: string;
  contactId: string;
  contactDisplayName: string;
  appointmentId: string;
  appointmentStartsAt: Date | null;
  platformId: string;
  platformName: string;
  platformProvider: string;
  status: 'created' | 'sent' | 'responded' | 'expired' | 'cancelled';
  sentAt: Date | null;
  respondedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
};

export type ReviewRow = {
  id: string;
  contactId: string;
  contactDisplayName: string;
  platformId: string;
  platformName: string;
  platformProvider: string;
  requestId: string | null;
  rating: number;
  text: string | null;
  externalReviewId: string | null;
  receivedAt: Date;
  createdAt: Date;
};
