/**
 * Utility for LLM model pricing information.
 * Based on the pricing structure from the original DBmarlin component.
 */

// Fallback pricing data for various models
export const FALLBACK_PRICING: Record<string, any> = {
  // OpenAI Models
  "gpt-4-turbo": {
    input_cost_per_1k_tokens: 0.01,
    output_cost_per_1k_tokens: 0.03,
    max_input_tokens: 128000,
  },
  "gpt-4o": {
    input_cost_per_1k_tokens: 0.005,
    output_cost_per_1k_tokens: 0.015,
    max_input_tokens: 128000,
  },
  "gpt-3.5-turbo": {
    input_cost_per_1k_tokens: 0.0005,
    output_cost_per_1k_tokens: 0.0015,
    max_input_tokens: 16385,
  },
  "gpt-4.1": {
    input_cost_per_1k_tokens: 0.01,
    output_cost_per_1k_tokens: 0.03,
    max_input_tokens: 128000,
  },
  "gpt-4.1-mini": {
    input_cost_per_1k_tokens: 0.0004,
    output_cost_per_1k_tokens: 0.0016,
    max_input_tokens: 1048576,
  },
  "gpt-4.1-nano": {
    input_cost_per_1k_tokens: 0.0002,
    output_cost_per_1k_tokens: 0.0008,
    max_input_tokens: 1048576,
  },

  // OpenRouter Models
  "openai/gpt-4-turbo": {
    input_cost_per_1k_tokens: 0.01,
    output_cost_per_1k_tokens: 0.03,
    max_input_tokens: 128000,
  },
  "openai/gpt-4o": {
    input_cost_per_1k_tokens: 0.005,
    output_cost_per_1k_tokens: 0.015,
    max_input_tokens: 128000,
  },
  "openai/gpt-3.5-turbo": {
    input_cost_per_1k_tokens: 0.0005,
    output_cost_per_1k_tokens: 0.0015,
    max_input_tokens: 16385,
  },
  "openai/gpt-4.1": {
    input_cost_per_1k_tokens: 0.01,
    output_cost_per_1k_tokens: 0.03,
    max_input_tokens: 128000,
  },
  "openai/gpt-4.1-mini": {
    input_cost_per_1k_tokens: 0.0004,
    output_cost_per_1k_tokens: 0.0016,
    max_input_tokens: 1048576,
  },
  "openai/gpt-4.1-nano": {
    input_cost_per_1k_tokens: 0.0002,
    output_cost_per_1k_tokens: 0.0008,
    max_input_tokens: 1048576,
  },

  // Google Models
  "gemini-pro-1.5": {
    input_cost_per_1k_tokens: 0.0025,
    output_cost_per_1k_tokens: 0.0075,
    max_input_tokens: 128000,
  },
  "google/gemini-pro-1.5": {
    input_cost_per_1k_tokens: 0.0025,
    output_cost_per_1k_tokens: 0.0075,
    max_input_tokens: 128000,
  },
  "gemini-flash-1.5": {
    input_cost_per_1k_tokens: 0.00035,
    output_cost_per_1k_tokens: 0.00105,
    max_input_tokens: 128000,
  },
  "google/gemini-flash-1.5": {
    input_cost_per_1k_tokens: 0.00035,
    output_cost_per_1k_tokens: 0.00105,
    max_input_tokens: 128000,
  },

  // Anthropic Models
  "claude-3.5-sonnet": {
    input_cost_per_1k_tokens: 0.0015,
    output_cost_per_1k_tokens: 0.0075,
    max_input_tokens: 200000,
  },
  "anthropic/claude-3.5-sonnet": {
    input_cost_per_1k_tokens: 0.0015,
    output_cost_per_1k_tokens: 0.0075,
    max_input_tokens: 200000,
  },
  "claude-3-opus": {
    input_cost_per_1k_tokens: 0.015,
    output_cost_per_1k_tokens: 0.075,
    max_input_tokens: 200000,
  },
  "anthropic/claude-3-opus": {
    input_cost_per_1k_tokens: 0.015,
    output_cost_per_1k_tokens: 0.075,
    max_input_tokens: 200000,
  },
  "claude-3-haiku": {
    input_cost_per_1k_tokens: 0.00025,
    output_cost_per_1k_tokens: 0.00125,
    max_input_tokens: 200000,
  },
  "anthropic/claude-3-haiku": {
    input_cost_per_1k_tokens: 0.00025,
    output_cost_per_1k_tokens: 0.00125,
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
