import type { AiAgentKind } from '../repositories/agents.types';
import { AiAgentsRepository } from '../repositories/agents.repository';
import { agentProfile, boundedAgentTools } from './agent-catalog';
import { routeToAgent } from './agent-router';
import type { BranchScope } from '@/lib/db/scope';

export class AiAgentsService {
  constructor(private readonly repo: AiAgentsRepository) {}
  static forScope(scope: BranchScope) {
    return new AiAgentsService(new AiAgentsRepository(scope));
  }
  async list() {
    return Promise.all((await this.repo.list()).map((row) => this.toDto(row)));
  }
  async get(id: string) {
    return this.toDto(await this.repo.get(id));
  }
  async update(id: string, input: Parameters<AiAgentsRepository['update']>[1]) {
    return this.toDto(await this.repo.update(id, input));
  }
  async test(id: string, message: string) {
    const selected = await this.repo.get(id);
    const enabled = new Set((await this.repo.findEnabled()).map((agent) => agent.kind));
    const routedKind = routeToAgent(message, enabled);
    return {
      selected: selected.kind,
      routedKind,
      wouldHandle: selected.enabled && routedKind === selected.kind,
      reply:
        selected.enabled && routedKind === selected.kind
          ? `[Local demo] ${selected.displayName} accepted this request for a guarded response.`
          : '[Local demo] This request would be routed to another enabled specialist or a human.',
    };
  }
  async resolve(
    message: string,
  ): Promise<{ id: string; kind: AiAgentKind; tools: readonly string[] } | null> {
    const enabled = await this.repo.findEnabled();
    const kind = routeToAgent(message, new Set(enabled.map((agent) => agent.kind)));
    const agent = kind ? enabled.find((item) => item.kind === kind) : null;
    return agent
      ? { id: agent.id, kind: agent.kind, tools: boundedAgentTools(agent.kind) }
      : null;
  }
  private toDto(row: Awaited<ReturnType<AiAgentsRepository['get']>>) {
    const profile = agentProfile(row.kind);
    return { ...row, purpose: profile.purpose, tools: profile.tools };
  }
}
