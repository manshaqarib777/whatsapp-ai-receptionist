import { resolveScope } from '@/server/scope';
import type { Scope } from '@/lib/db/scope';

import { KnowledgeSourcesRepository } from './sources.repository';
import { KnowledgeDocumentsRepository } from './documents.repository';
import { KnowledgeJobsRepository } from './jobs.repository';

/**
 * Knowledge-base data access facade — Milestone 7.
 *
 * The aggregate repositories (sources, documents+versions, jobs) each own one
 * slice of the knowledge database and stay under the 300-line architecture
 * rule. This facade composes them behind the single `KnowledgeRepository`
 * surface the service, worker, and tests consume.
 */

export class KnowledgeRepository {
  readonly organizationId: string;
  readonly sources: KnowledgeSourcesRepository;
  readonly documents: KnowledgeDocumentsRepository;
  readonly jobs: KnowledgeJobsRepository;

  constructor(scope: Scope) {
    this.organizationId = scope.organizationId;
    this.sources = new KnowledgeSourcesRepository(scope);
    this.documents = new KnowledgeDocumentsRepository(scope);
    this.jobs = new KnowledgeJobsRepository(scope);
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): KnowledgeRepository {
    return new KnowledgeRepository(resolveScope(organizationId));
  }

  static forScope(scope: Scope): KnowledgeRepository {
    return new KnowledgeRepository(scope);
  }

  async resolveDefaultBranch(): Promise<string> {
    return this.sources.resolveDefaultBranch();
  }

  // -------------------------------------------------------------------------
  // Sources
  // -------------------------------------------------------------------------

  listSources(): ReturnType<KnowledgeSourcesRepository['listSources']> {
    return this.sources.listSources();
  }

  getSource(id: string): ReturnType<KnowledgeSourcesRepository['getSource']> {
    return this.sources.getSource(id);
  }

  createSource(
    input: Parameters<KnowledgeSourcesRepository['createSource']>[0],
  ): ReturnType<KnowledgeSourcesRepository['createSource']> {
    return this.sources.createSource(input);
  }

  assertSourceExists(
    id: string,
  ): ReturnType<KnowledgeSourcesRepository['assertSourceExists']> {
    return this.sources.assertSourceExists(id);
  }

  // -------------------------------------------------------------------------
  // Documents + versions
  // -------------------------------------------------------------------------

  createDocument(
    input: Parameters<KnowledgeDocumentsRepository['createDocument']>[0],
  ): ReturnType<KnowledgeDocumentsRepository['createDocument']> {
    return this.documents.createDocument(input);
  }

  getDocument(id: string): ReturnType<KnowledgeDocumentsRepository['getDocument']> {
    return this.documents.getDocument(id);
  }

  createVersion(
    input: Parameters<KnowledgeDocumentsRepository['createVersion']>[0],
  ): ReturnType<KnowledgeDocumentsRepository['createVersion']> {
    return this.documents.createVersion(input);
  }

  updateVersionChunks(
    input: Parameters<KnowledgeDocumentsRepository['updateVersionChunks']>[0],
  ): ReturnType<KnowledgeDocumentsRepository['updateVersionChunks']> {
    return this.documents.updateVersionChunks(input);
  }

  transitionVersionStatus(
    input: Parameters<KnowledgeDocumentsRepository['transitionVersionStatus']>[0],
  ): ReturnType<KnowledgeDocumentsRepository['transitionVersionStatus']> {
    return this.documents.transitionVersionStatus(input);
  }

  setCurrentVersion(
    documentId: string,
    versionId: string,
  ): ReturnType<KnowledgeDocumentsRepository['setCurrentVersion']> {
    return this.documents.setCurrentVersion(documentId, versionId);
  }

  approveAndSetCurrent(
    versionId: string,
    approverId: string,
  ): ReturnType<KnowledgeDocumentsRepository['approveAndSetCurrent']> {
    return this.documents.approveAndSetCurrent(versionId, approverId);
  }

  getNextVersionNumber(
    documentId: string,
  ): ReturnType<KnowledgeDocumentsRepository['getNextVersionNumber']> {
    return this.documents.getNextVersionNumber(documentId);
  }

  getVersion(
    input: Parameters<KnowledgeDocumentsRepository['getVersion']>[0],
  ): ReturnType<KnowledgeDocumentsRepository['getVersion']> {
    return this.documents.getVersion(input);
  }

  // -------------------------------------------------------------------------
  // Jobs
  // -------------------------------------------------------------------------

  createJob(
    input: Parameters<KnowledgeJobsRepository['createJob']>[0],
  ): ReturnType<KnowledgeJobsRepository['createJob']> {
    return this.jobs.createJob(input);
  }

  listJobs(limit?: number): ReturnType<KnowledgeJobsRepository['listJobs']> {
    return this.jobs.listJobs(limit);
  }

  getJob(id: string): ReturnType<KnowledgeJobsRepository['getJob']> {
    return this.jobs.getJob(id);
  }

  updateJobStatus(
    id: string,
    input: Parameters<KnowledgeJobsRepository['updateJobStatus']>[1],
  ): ReturnType<KnowledgeJobsRepository['updateJobStatus']> {
    return this.jobs.updateJobStatus(id, input);
  }
}

// Re-export the shared types so consumers keep one import surface.
export type {
  JobStatus,
  KnowledgeDocumentDetail,
  KnowledgeDocumentRow,
  KnowledgeJobRow,
  KnowledgeSourceKind,
  KnowledgeSourceRow,
  KnowledgeVersionRow,
  KnowledgeVersionStatus,
  NewSourceInput,
  SourceWithDocuments,
} from './knowledge.types';
