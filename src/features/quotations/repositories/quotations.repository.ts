import { resolveScope } from '@/server/scope';
import type { Scope } from '@/lib/db/scope';

import { QuotesRepository } from './quotes.repository';
import { QuoteVersionsRepository } from './quote-versions.repository';
import { QuoteTemplatesRepository } from './templates.repository';
import { QuotationsExistenceRepository } from './existence.repository';

/**
 * Quotes data access facade — Milestone 11.
 *
 * The aggregate repositories (quotes, versions, templates, existence) each own
 * one slice of the quotations database and stay under the 300-line
 * architecture rule. This facade composes them behind the single
 * `QuotationsRepository` surface the service consumes.
 */

export class QuotationsRepository {
  readonly organizationId: string;
  readonly quotes: QuotesRepository;
  readonly versions: QuoteVersionsRepository;
  readonly templates: QuoteTemplatesRepository;
  readonly existence: QuotationsExistenceRepository;

  constructor(scope: Scope) {
    this.organizationId = scope.organizationId;
    this.quotes = new QuotesRepository(scope);
    this.versions = new QuoteVersionsRepository(scope);
    this.templates = new QuoteTemplatesRepository(scope);
    this.existence = new QuotationsExistenceRepository(scope);
  }

  /** Builds a repository from an organization id (org-level scope, all branches). */
  static forOrganization(organizationId: string): QuotationsRepository {
    return new QuotationsRepository(resolveScope(organizationId));
  }

  async resolveDefaultBranch(): Promise<string> {
    return this.quotes.resolveDefaultBranch();
  }

  // -------------------------------------------------------------------------
  // Quotes
  // -------------------------------------------------------------------------

  listQuotes(
    filter?: Parameters<QuotesRepository['listQuotes']>[0],
  ): ReturnType<QuotesRepository['listQuotes']> {
    return this.quotes.listQuotes(filter);
  }

  getQuote(id: string): ReturnType<QuotesRepository['getQuote']> {
    return this.quotes.getQuote(id);
  }

  nextQuoteNumber(): ReturnType<QuotesRepository['nextQuoteNumber']> {
    return this.quotes.nextQuoteNumber();
  }

  createQuote(
    input: Parameters<QuotesRepository['createQuote']>[0],
  ): ReturnType<QuotesRepository['createQuote']> {
    return this.quotes.createQuote(input);
  }

  updateQuote(
    id: string,
    data: Parameters<QuotesRepository['updateQuote']>[1],
  ): ReturnType<QuotesRepository['updateQuote']> {
    return this.quotes.updateQuote(id, data);
  }

  setQuoteStatus(
    id: string,
    status: Parameters<QuotesRepository['setQuoteStatus']>[1],
    extras?: Parameters<QuotesRepository['setQuoteStatus']>[2],
  ): ReturnType<QuotesRepository['setQuoteStatus']> {
    return this.quotes.setQuoteStatus(id, status, extras);
  }

  replaceLineItems(
    quoteId: string,
    lines: Parameters<QuotesRepository['replaceLineItems']>[1],
  ): ReturnType<QuotesRepository['replaceLineItems']> {
    return this.quotes.replaceLineItems(quoteId, lines);
  }

  listVersions(quoteId: string): ReturnType<QuoteVersionsRepository['listVersions']> {
    return this.versions.listVersions(quoteId);
  }

  createVersion(
    quoteId: string,
    versionNumber: number,
    snapshot: Parameters<QuoteVersionsRepository['createVersion']>[2],
  ): ReturnType<QuoteVersionsRepository['createVersion']> {
    return this.versions.createVersion(quoteId, versionNumber, snapshot);
  }

  nextVersionNumber(
    quoteId: string,
  ): ReturnType<QuoteVersionsRepository['nextVersionNumber']> {
    return this.versions.nextVersionNumber(quoteId);
  }

  // -------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------

  listTemplates(): ReturnType<QuoteTemplatesRepository['listTemplates']> {
    return this.templates.listTemplates();
  }

  createTemplate(
    input: Parameters<QuoteTemplatesRepository['createTemplate']>[0],
  ): ReturnType<QuoteTemplatesRepository['createTemplate']> {
    return this.templates.createTemplate(input);
  }

  // -------------------------------------------------------------------------
  // Existence checks
  // -------------------------------------------------------------------------

  contactExists(id: string): ReturnType<QuotationsExistenceRepository['contactExists']> {
    return this.existence.contactExists(id);
  }
}

// Re-export the shared types so consumers keep one import surface.
export type {
  QuoteLineItemRow,
  QuoteRow,
  QuoteStatus,
  QuoteTemplateRow,
  QuoteVersionRow,
} from './quotations.types';
