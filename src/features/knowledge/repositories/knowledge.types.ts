/**
 * Knowledge-base row types shared by the aggregate repositories — Milestone 7.
 *
 * Split out of knowledge.repository.ts so each aggregate repository stays under
 * the 300-line architecture rule while consumers keep one import surface.
 */

export type KnowledgeSourceKind =
  'upload' | 'pdf' | 'docx' | 'csv' | 'website' | 'faq' | 'notion' | 'google_docs';
export type KnowledgeVersionStatus =
  'draft' | 'pending_approval' | 'approved' | 'archived';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type KnowledgeSourceRow = {
  id: string;
  kind: KnowledgeSourceKind;
  name: string;
  documentCount: number;
  createdAt: Date;
};

export type KnowledgeDocumentRow = {
  id: string;
  sourceId: string;
  title: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: string | null;
  currentVersionId: string | null;
  currentStatus: KnowledgeVersionStatus | null;
  currentVersionNumber: number | null;
  createdAt: Date;
};

export type KnowledgeVersionRow = {
  id: string;
  documentId: string;
  versionNumber: number;
  status: KnowledgeVersionStatus;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  chunkCount: number | null;
  checksum: string | null;
  createdAt: Date;
};

export type KnowledgeDocumentDetail = {
  id: string;
  sourceId: string;
  sourceName: string;
  branchId: string;
  title: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: string | null;
  storageKey: string | null;
  currentVersionId: string | null;
  createdAt: Date;
  versions: KnowledgeVersionRow[];
};

export type KnowledgeJobRow = {
  id: string;
  sourceId: string;
  documentId: string | null;
  versionId: string | null;
  status: JobStatus;
  error: string | null;
  progress: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SourceWithDocuments = {
  id: string;
  kind: KnowledgeSourceKind;
  name: string;
  createdAt: Date;
  documents: KnowledgeDocumentRow[];
};

export type NewSourceInput = {
  kind: KnowledgeSourceKind;
  name: string;
  branchId: string;
};
