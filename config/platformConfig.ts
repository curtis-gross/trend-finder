/**
 * Centralized Platform Configuration & Constants (TypeScript Frontend & Services Module)
 */

export const DEFAULT_FLASH_THINKING_LEVEL = 'LOW' as const;

interface PlatformModelsMap {
  readonly FLASH: string;
  readonly FLASH_LITE: string;
}

export const PLATFORM_MODELS: PlatformModelsMap = {
  FLASH: 'gemini-3.8-flash',
  FLASH_LITE: 'gemini-3.5-flash-lite'
} as const;

export function applyDefaultThinkingConfig<T extends Record<string, any> = Record<string, any>>(
  model?: string | null,
  config: T = {} as T
): T {
  const targetConfig: any = config && typeof config === 'object' ? config : {};
  if (
    model === PLATFORM_MODELS.FLASH ||
    (typeof model === 'string' && model.includes('3.8-flash'))
  ) {
    targetConfig.thinkingConfig = {
      ...(targetConfig.thinkingConfig || {}),
      thinkingLevel: targetConfig.thinkingConfig?.thinkingLevel || DEFAULT_FLASH_THINKING_LEVEL
    };
  }
  return targetConfig as T;
}
