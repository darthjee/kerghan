import { Inject, Injectable } from '@nestjs/common';
import { INTEGRATION_TYPE_STRATEGIES, IntegrationFlows, IntegrationTypeStrategy } from './integration-type-strategy.js';

/** One entry of `POST /integrations/types.json`. */
export interface EnabledIntegrationType {
  type: string;
  flows: IntegrationFlows;
}

/**
 * Looks up integration type strategies by `type`. The only place the
 * generic code resolves type-specific behaviour.
 */
@Injectable()
export class IntegrationTypeRegistry {
  private readonly strategies: Map<string, IntegrationTypeStrategy>;

  /**
   * @param {IntegrationTypeStrategy[]} strategies - Every registered strategy, in registry order.
   */
  constructor(@Inject(INTEGRATION_TYPE_STRATEGIES) strategies: IntegrationTypeStrategy[]) {
    this.strategies = new Map(strategies.map((strategy) => [strategy.type, strategy]));
  }

  /**
   * Finds the strategy for a type.
   * @param {string} type - The integration type.
   * @returns {IntegrationTypeStrategy | undefined} The strategy, or `undefined` when unregistered.
   */
  find(type: string): IntegrationTypeStrategy | undefined {
    return this.strategies.get(type);
  }

  /**
   * Resolves the strategy for a type, throwing on an unknown one.
   * @param {string} type - The integration type.
   * @returns {IntegrationTypeStrategy} The strategy.
   */
  get(type: string): IntegrationTypeStrategy {
    const strategy = this.find(type);

    if (strategy === undefined) {
      throw new Error(`unknown integration type: ${type}`);
    }

    return strategy;
  }

  /**
   * Lists the types this server can create, in registry order.
   * @returns {EnabledIntegrationType[]} Each enabled type with its flows.
   */
  enabledTypes(): EnabledIntegrationType[] {
    return [...this.strategies.values()]
      .filter((strategy) => strategy.isEnabled?.() ?? true)
      .map((strategy) => ({ type: strategy.type, flows: { ...strategy.flows } }));
  }
}
