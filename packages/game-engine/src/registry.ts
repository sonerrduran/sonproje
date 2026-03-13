import { EngineType } from '@platform/types';

// Engine registry - maps engine type to component
// This will be populated as we migrate engines
export const EngineRegistry: Record<string, React.ComponentType<any>> = {};

/**
 * Get engine component by type
 */
export function getEngine(type: EngineType) {
  const engine = EngineRegistry[type];
  if (!engine) {
    throw new Error(`Engine not found: ${type}`);
  }
  return engine;
}

/**
 * Register an engine
 */
export function registerEngine(type: EngineType, component: React.ComponentType<any>) {
  EngineRegistry[type] = component;
}
