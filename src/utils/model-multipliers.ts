interface PromotionalMultiplier {
    multiplier: number;
    expiresAt: number;
    regularMultiplier: number;
}

// Snapshot of https://docs.factory.com/models.md, 2026-10-06; new prices require a manual refresh.
const MODEL_MULTIPLIERS: ReadonlyMap<string, number | PromotionalMultiplier> = new Map<string, number | PromotionalMultiplier>([
    ['claude-fable-5.1', 4],
    ['claude-fable-5', 4],
    ['claude-opus-5-5', 1.6],
    ['claude-opus-5-5-fast', 3.2],
    ['claude-opus-5', 2],
    ['claude-opus-5-fast', 4],
    ['claude-opus-4-8', 2],
    ['claude-opus-4-8-fast', 4],
    ['claude-opus-4-7', 2],
    ['claude-opus-4-6', 2],
    ['claude-opus-4-5-20251101', 2],
    ['claude-sonnet-5-5', 0.8],
    ['claude-sonnet-5', 0.8],
    ['claude-sonnet-4-6', 1.2],
    ['claude-sonnet-4-5-20250929', 1.2],
    ['claude-haiku-4-5-20251001', 0.4],
    ['gpt-6.1-sol', 0.8],
    ['gpt-6-astra', 4],
    ['gpt-6-sol', 0.8],
    ['gpt-6-luna', 0.04],
    ['gpt-5.6-sol', { multiplier: 1.6, expiresAt: Date.UTC(2026, 10, 23), regularMultiplier: 2 }],
    ['gpt-5.6-sol-fast', { multiplier: 3.2, expiresAt: Date.UTC(2026, 10, 23), regularMultiplier: 4 }],
    ['gpt-5.6-terra', 0.8],
    ['gpt-5.6-luna', 0.08],
    ['gpt-5.5', 2],
    ['gpt-5.5-fast', 5],
    ['gpt-5.5-pro', 12],
    ['gpt-5.4', 1],
    ['gpt-5.4-fast', 2],
    ['gpt-5.4-mini', 0.3],
    ['gpt-5.4-mini-fast', 0.6],
    ['gpt-5.3-codex', 0.7],
    ['gpt-5.3-codex-fast', 1.4],
    ['gpt-5.2', 0.7],
    ['gemini-3.1-pro-preview', 0.8],
    ['gemini-3.8-flash', { multiplier: 0.3, expiresAt: Date.UTC(2027, 0, 2), regularMultiplier: 0.6 }],
    ['gemini-3.7-flash', { multiplier: 0.3, expiresAt: Date.UTC(2027, 0, 2), regularMultiplier: 0.6 }],
    ['gemini-3.6-flash', 0.6],
    ['gemini-3.5-flash', 0.6],
    ['gemini-3-flash-preview', 0.2],
    ['grok-4.7', 0.8],
    ['grok-4.6', 0.8],
    ['grok-4.5', 0.8],
    ['inkling', 0.4],
    ['mistral-medium-3.5', 0.6],
    ['glm-5.3-flash', 0.06],
    ['glm-5.3', 0.56],
    ['glm-5.2', 0.56],
    ['glm-5.2-fast', 0.84],
    ['kimi-k3', 1.2],
    ['qwen3.8-max', 0.8],
    ['nemotron-3-ultra', 0.24],
    ['deepseek-v4.1-flash', 0.12],
    ['deepseek-v4-flash-0731', 0.176],
    ['deepseek-v4-pro', 0.528],
    ['minimax-m3', 0.12],
    ['minimax-m2.7', 0.12],
    ['kimi-k2.5', 0.25],
    ['glm-5.1', 0.55]
]);

export function getModelMultiplier(modelId: string, now: Date = new Date()): number | null {
    const normalizedId = modelId.trim().toLowerCase().replace(/\[[^\]]+\]$/, '');
    const price = MODEL_MULTIPLIERS.get(normalizedId);
    if (price === undefined) {
        return null;
    }
    if (typeof price === 'number') {
        return price;
    }
    return now.getTime() < price.expiresAt ? price.multiplier : price.regularMultiplier;
}

export function getMultiplierTrafficLight(multiplier: number): 'green' | 'orange' | 'red' {
    return multiplier < 1 ? 'green' : multiplier < 2 ? 'orange' : 'red';
}
