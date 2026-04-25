/**
 * Locked capability vocabulary.
 *
 * The Claude planner can only emit task.capability ∈ this list, and the
 * marketplace can only register agents matching one of these. Keeping
 * the surface tight means the planner's outputs are always routable.
 *
 * Add new capabilities deliberately — every addition needs at least one
 * agent registered or the planner will fail to dispatch.
 */
export const CAPABILITIES = [
  "flights",
  "hotels",
  "weather",
  "web_search",
  "geocoding",
  "currency",
  "translation",
  "news",
  "sentiment",
  "image_gen",
  "fact_check",
  "calendar",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_DESCRIPTIONS: Record<Capability, string> = {
  flights: "Search and compare flight options across airlines",
  hotels: "Find hotels and accommodations with prices and ratings",
  weather: "Current weather + multi-day forecasts for any location",
  web_search: "General real-time web search and answer extraction",
  geocoding: "Convert place names to coordinates, reverse geocoding",
  currency: "Currency conversion and FX rates",
  translation: "Translate text between languages",
  news: "Latest news + AI summary on any topic",
  sentiment: "Sentiment + tone analysis of text or social posts",
  image_gen: "Generate images from a text prompt",
  fact_check: "Verify a factual claim against trusted sources",
  calendar: "Reason over schedules, find free slots, plan times",
};

export function isCapability(s: string): s is Capability {
  return (CAPABILITIES as readonly string[]).includes(s);
}
