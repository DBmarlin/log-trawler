/**
 * Utility for LLM model pricing information.
 * Based on the pricing structure from the original DBmarlin component.
 */

// Fallback pricing data for various models
export const FALLBACK_PRICING: Record<string, any> = {
  // OpenAI Models
  "gpt-5.4": {
    input_cost_per_1k_tokens: 0.0025,
    output_cost_per_1k_tokens: 0.015,
    max_input_tokens: 1048576,
  },
  "gpt-5.4-mini": {
    input_cost_per_1k_tokens: 0.00075,
    output_cost_per_1k_tokens: 0.0045,
    max_input_tokens: 400000,
  },
  "gpt-5.4-nano": {
    input_cost_per_1k_tokens: 0.0002,
    output_cost_per_1k_tokens: 0.00125,
    max_input_tokens: 400000,
  },
  "gpt-5.4-pro": {
    input_cost_per_1k_tokens: 0.03,
    output_cost_per_1k_tokens: 0.18,
    max_input_tokens: 1048576,
  },
  "gpt-5.3-codex": {
    input_cost_per_1k_tokens: 0.00175,
    output_cost_per_1k_tokens: 0.014,
    max_input_tokens: 400000,
  },
  "gpt-5": {
    input_cost_per_1k_tokens: 0.00125,
    output_cost_per_1k_tokens: 0.01,
    max_input_tokens: 400000,
  },
  "gpt-5-pro": {
    input_cost_per_1k_tokens: 0.015,
    output_cost_per_1k_tokens: 0.12,
    max_input_tokens: 400000,
  },
  "gpt-5-mini": {
    input_cost_per_1k_tokens: 0.00025,
    output_cost_per_1k_tokens: 0.002,
    max_input_tokens: 400000,
  },
  "gpt-5-nano": {
    input_cost_per_1k_tokens: 0.00005,
    output_cost_per_1k_tokens: 0.0004,
    max_input_tokens: 400000,
  },

  // OpenRouter Models
  "openai/gpt-5.4": {
    input_cost_per_1k_tokens: 0.0025,
    output_cost_per_1k_tokens: 0.015,
    max_input_tokens: 1048576,
  },
  "openai/gpt-5.4-mini": {
    input_cost_per_1k_tokens: 0.00075,
    output_cost_per_1k_tokens: 0.0045,
    max_input_tokens: 400000,
  },
  "openai/gpt-5.4-nano": {
    input_cost_per_1k_tokens: 0.0002,
    output_cost_per_1k_tokens: 0.00125,
    max_input_tokens: 400000,
  },
  "openai/gpt-5.4-pro": {
    input_cost_per_1k_tokens: 0.03,
    output_cost_per_1k_tokens: 0.18,
    max_input_tokens: 1048576,
  },
  "openai/gpt-5.3-chat": {
    input_cost_per_1k_tokens: 0.00175,
    output_cost_per_1k_tokens: 0.014,
    max_input_tokens: 128000,
  },
  "openai/gpt-5.3-codex": {
    input_cost_per_1k_tokens: 0.00175,
    output_cost_per_1k_tokens: 0.014,
    max_input_tokens: 400000,
  },
  "openai/gpt-5": {
    input_cost_per_1k_tokens: 0.00125,
    output_cost_per_1k_tokens: 0.01,
    max_input_tokens: 400000,
  },
  "openai/gpt-5-pro": {
    input_cost_per_1k_tokens: 0.015,
    output_cost_per_1k_tokens: 0.12,
    max_input_tokens: 400000,
  },
  "openai/gpt-5-mini": {
    input_cost_per_1k_tokens: 0.00025,
    output_cost_per_1k_tokens: 0.002,
    max_input_tokens: 400000,
  },
  "openai/gpt-5-nano": {
    input_cost_per_1k_tokens: 0.00005,
    output_cost_per_1k_tokens: 0.0004,
    max_input_tokens: 400000,
  },

  // Google Models
  "gemini-2.5-pro": {
    input_cost_per_1k_tokens: 0.00125,
    output_cost_per_1k_tokens: 0.01,
    max_input_tokens: 1048576,
  },
  "google/gemini-2.5-pro": {
    input_cost_per_1k_tokens: 0.00125,
    output_cost_per_1k_tokens: 0.01,
    max_input_tokens: 1048576,
  },

  // Anthropic Models
  "claude-sonnet-4": {
    input_cost_per_1k_tokens: 0.003,
    output_cost_per_1k_tokens: 0.015,
    max_input_tokens: 200000,
  },
  "anthropic/claude-sonnet-4": {
    input_cost_per_1k_tokens: 0.003,
    output_cost_per_1k_tokens: 0.015,
    max_input_tokens: 200000,
  },

  // Mistral Models
  "mistral-large": {
    input_cost_per_1k_tokens: 0.008,
    output_cost_per_1k_tokens: 0.024,
    max_input_tokens: 32000,
  },
  "mistralai/mistral-large": {
    input_cost_per_1k_tokens: 0.008,
    output_cost_per_1k_tokens: 0.024,
    max_input_tokens: 32000,
  },
  "mixtral-8x7b": {
    input_cost_per_1k_tokens: 0.0007,
    output_cost_per_1k_tokens: 0.002,
    max_input_tokens: 32000,
  },
  "mistralai/mixtral-8x7b": {
    input_cost_per_1k_tokens: 0.0007,
    output_cost_per_1k_tokens: 0.002,
    max_input_tokens: 32000,
  },

  // Meta Models
  "llama-3-70b-instruct": {
    input_cost_per_1k_tokens: 0.0007,
    output_cost_per_1k_tokens: 0.0012,
    max_input_tokens: 8192,
  },
  "meta-llama/llama-3-70b-instruct": {
    input_cost_per_1k_tokens: 0.0007,
    output_cost_per_1k_tokens: 0.0012,
    max_input_tokens: 8192,
  },
  "llama-3-8b-instruct": {
    input_cost_per_1k_tokens: 0.0007,
    output_cost_per_1k_tokens: 0.0012,
    max_input_tokens: 8192,
  },
  "meta-llama/llama-3-8b-instruct": {
    input_cost_per_1k_tokens: 0.0007,
    output_cost_per_1k_tokens: 0.0012,
    max_input_tokens: 8192,
  },

  // Free Models
  "deepseek-v3-base:free": {
    input_cost_per_1k_tokens: 0,
    output_cost_per_1k_tokens: 0,
    max_input_tokens: 8192,
  },
  "deepseek/deepseek-v3-base:free": {
    input_cost_per_1k_tokens: 0,
    output_cost_per_1k_tokens: 0,
    max_input_tokens: 8192,
  },
  "qwen2.5-vl-32b-instruct:free": {
    input_cost_per_1k_tokens: 0,
    output_cost_per_1k_tokens: 0,
    max_input_tokens: 32768,
  },
  "qwen/qwen2.5-vl-32b-instruct:free": {
    input_cost_per_1k_tokens: 0,
    output_cost_per_1k_tokens: 0,
    max_input_tokens: 32768,
  },
  "google/gemini-2.5-pro-exp-03-25:free": {
    input_cost_per_1k_tokens: 0,
    output_cost_per_1k_tokens: 0,
    max_input_tokens: 128000,
  },
};

/**
 * Get pricing information for a specific model
 * @param model The model name to get pricing for
 * @returns Pricing information for the model
 */
export function getModelPricing(model: string): {
  input_cost_per_1k_tokens: number;
  output_cost_per_1k_tokens: number;
  max_input_tokens?: number;
} {
  // Try to find the model directly
  if (FALLBACK_PRICING[model]) {
    return FALLBACK_PRICING[model];
  }

  // For OpenRouter models, try without the provider prefix
  const baseName = model.replace(/^[^/]+\//, "");
  if (FALLBACK_PRICING[baseName]) {
    return FALLBACK_PRICING[baseName];
  }

  // If still not found, return default pricing
  console.warn(`No pricing found for model: ${model}, using default pricing`);
  return {
    input_cost_per_1k_tokens: 0.001,
    output_cost_per_1k_tokens: 0.002,
    max_input_tokens: 4096,
  };
}
