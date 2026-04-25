/**
 * /api/agents/[capability]/route.ts
 *
 * Dynamic agent endpoint handler. Every capability gets routed here.
 * Uses Llama 3.3 70B for synthetic task execution (mocked data with
 * realistic structure). Each capability is dispatched based on the
 * `capability` path param.
 *
 * Request shape conforms to AgentRequest from @synapse/shared.
 * Response conforms to AgentResponse.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  AgentRequestSchema,
  AgentResponseSchema,
  CAPABILITY_DESCRIPTIONS,
  isCapability,
} from "@synapse/shared";
import { callLlama } from "@/lib/llm";

export const dynamic = "force-dynamic";

const CAPABILITY_PROMPTS: Record<string, string> = {
  flights: `You are a flight search agent. Given a query, respond with JSON containing:
{
  "summary": "1-2 sentence overview of the cheapest viable flight option",
  "data": {
    "options": [
      {
        "airline": "American Airlines",
        "departure": "2025-04-28 08:15 AM",
        "arrival": "2025-04-28 12:30 PM",
        "stops": 0,
        "price_usd": 245,
        "duration_hours": 4.25
      }
    ],
    "currency": "USD"
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  hotels: `You are a hotel finder agent. Given a query, respond with JSON containing:
{
  "summary": "1-2 sentence overview highlighting the best match for the query",
  "data": {
    "options": [
      {
        "name": "Grand Hotel",
        "location": "Downtown",
        "rating": 4.7,
        "price_per_night_usd": 180,
        "amenities": ["WiFi", "Pool", "Gym"],
        "availability": "2025-04-28 to 2025-05-01"
      }
    ]
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  weather: `You are a weather forecast agent. Given a location query, respond with JSON containing:
{
  "summary": "Current weather condition + 1 sentence 7-day outlook",
  "data": {
    "location": "San Francisco, CA",
    "current": {
      "temperature_f": 62,
      "condition": "Partly Cloudy",
      "humidity_percent": 65,
      "wind_mph": 12
    },
    "forecast_7d": [
      {
        "day": "Monday",
        "high_f": 68,
        "low_f": 55,
        "condition": "Sunny",
        "precipitation_percent": 5
      }
    ]
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  web_search: `You are a web search agent. Given a query, respond with JSON containing:
{
  "summary": "1-2 sentence direct answer suitable for spoken narration",
  "data": {
    "query": "original search query",
    "top_results": [
      {
        "title": "Result Title",
        "url": "https://example.com",
        "snippet": "Brief excerpt"
      }
    ]
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  geocoding: `You are a geocoding agent. Given a place name or coordinates, respond with JSON containing:
{
  "summary": "Location coordinates and basic geographic info",
  "data": {
    "place_name": "Eiffel Tower, Paris",
    "latitude": 48.8584,
    "longitude": 2.2945,
    "country": "France",
    "timezone": "Europe/Paris"
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  currency: `You are a currency conversion agent. Given conversion request, respond with JSON containing:
{
  "summary": "1 sentence with conversion result and rate",
  "data": {
    "from": "USD",
    "to": "EUR",
    "amount": 100,
    "converted_amount": 92.50,
    "rate": 0.925,
    "timestamp": "2025-04-25T10:00:00Z"
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  translation: `You are a translation agent. Given text and target language, respond with JSON containing:
{
  "summary": "Translated text",
  "data": {
    "original": "Hello, how are you?",
    "original_language": "English",
    "translated": "Hola, ¿cómo estás?",
    "target_language": "Spanish",
    "confidence": 0.98
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  news: `You are a news aggregator agent. Given a topic, respond with JSON containing:
{
  "summary": "Headline summary with 2-3 key points",
  "data": {
    "topic": "Technology",
    "headlines": [
      {
        "title": "Breaking: New AI Model Released",
        "source": "TechNews Daily",
        "published": "2025-04-25T09:30:00Z",
        "summary_bullet": "Major breakthrough in model efficiency"
      }
    ]
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  sentiment: `You are a sentiment analysis agent. Given text, respond with JSON containing:
{
  "summary": "Sentiment analysis result in 1 sentence",
  "data": {
    "text": "I absolutely love this product!",
    "sentiment": "positive",
    "confidence": 0.95,
    "emotions": ["joy", "satisfaction"]
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  image_gen: `You are an image generation agent. Given a prompt, respond with JSON containing:
{
  "summary": "Generated image for: [prompt summary]",
  "data": {
    "prompt": "A serene landscape with mountains and lake",
    "url": "https://example.com/image.jpg",
    "resolution": "1024x1024",
    "model": "llama-vision-mock"
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  fact_check: `You are a fact-checking agent. Given a claim, respond with JSON containing:
{
  "summary": "Verdict on claim truthfulness with source attribution",
  "data": {
    "claim": "Paris is the capital of France",
    "verdict": "true",
    "confidence": 1.0,
    "sources": ["CIA World Factbook", "UN Member States"]
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,

  calendar: `You are a calendar/scheduling agent. Given a scheduling query, respond with JSON containing:
{
  "summary": "Available time slots or scheduling suggestion",
  "data": {
    "query": "Find 1-hour slot next Monday",
    "suggestions": [
      {
        "start": "2025-04-28T10:00:00Z",
        "end": "2025-04-28T11:00:00Z",
        "confidence": 0.9
      }
    ]
  }
}
Respond with ONLY valid JSON, no markdown or extras.`,
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ capability: string }> },
) {
  try {
    const { capability } = await context.params;

    // Validate capability
    if (!isCapability(capability)) {
      return NextResponse.json(
        { ok: false, error: `Unknown capability: ${capability}` },
        { status: 400 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const req = AgentRequestSchema.parse(body);

    // Verify task_id matches capability in URL
    if (req.capability !== capability) {
      return NextResponse.json(
        { ok: false, error: "Capability in URL does not match request body" },
        { status: 400 },
      );
    }

    const prompt = CAPABILITY_PROMPTS[capability];
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: `No handler for capability: ${capability}` },
        { status: 500 },
      );
    }

    // Call Llama to generate synthetic response
    const startTime = Date.now();
    const { content, model } = await callLlama(
      [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `Task: ${req.query}\nContext: ${JSON.stringify(req.context ?? {})}`,
        },
      ],
      { jsonMode: true, maxTokens: 1024 },
    );

    const latency_ms = Date.now() - startTime;

    // Parse Llama's JSON response
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(content);
    } catch {
      parsedData = {
        summary: content.substring(0, 200),
        data: { raw: content },
      };
    }

    // Construct response
    const response = AgentResponseSchema.parse({
      task_id: req.task_id,
      ok: true,
      summary:
        typeof parsedData === "object" && parsedData && "summary" in parsedData
          ? (parsedData as Record<string, unknown>).summary
          : content.substring(0, 200),
      data:
        typeof parsedData === "object" && parsedData && "data" in parsedData
          ? (parsedData as Record<string, unknown>).data
          : parsedData,
      latency_ms,
      model_used: model,
    });

    return NextResponse.json(response);
  } catch (err) {
    console.error("[agent endpoint]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
