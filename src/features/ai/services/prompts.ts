import type { AiRepository } from '@/features/ai/repositories/ai.repository';

/**
 * Prompt resolution — Milestone 8 (AD-6).
 *
 * The engine resolves the active body for a template key and renders it with the
 * runtime context. Prompts are versioned modules in the database
 * (prompt_templates / prompt_template_versions); a template edit creates a draft
 * version that only takes effect once activated.
 */

export type PromptContext = {
  businessName?: string;
  customerName?: string;
  conversationContext: string;
  toolsDescription: string;
};

/** Renders a template body with the engine's runtime context. */
export function renderPrompt(body: string, context: PromptContext): string {
  return body
    .replaceAll('{{business_name}}', context.businessName ?? 'the clinic')
    .replaceAll('{{customer_name}}', context.customerName ?? 'the customer')
    .replaceAll('{{conversation_context}}', context.conversationContext)
    .replaceAll('{{tools}}', context.toolsDescription);
}

export class PromptService {
  private readonly repo: AiRepository;

  constructor(repo: AiRepository) {
    this.repo = repo;
  }

  /** Resolves the active body for a key, or null when no active version exists. */
  async resolveActive(key: string): Promise<string | null> {
    return this.repo.resolveActiveBody(key);
  }
}
