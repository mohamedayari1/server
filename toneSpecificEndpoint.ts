import type { Request, Response } from "express";
import { performance } from "perf_hooks";
import { z } from "zod";
import { sendGeminiStreamRequest } from "./lib/ai/gemini";
import { createRagPrompt } from "./lib/prompts/simpleAnswer";
import type { SearchResponse } from "./lib/types";
import { generateUUID } from "./lib/utils";
import { vectorSearchService } from "./lib/vectorSearch";

// Schema for tone-specific requests
const toneRequestSchema = z.object({
  message: z.string(),
  tone: z.enum(["professional", "casual"]),
  numResults: z.number().optional().default(5),
});

type ToneRequest = z.infer<typeof toneRequestSchema>;

export const toneSpecificEndpoint = async (req: Request, res: Response) => {
  const startTime = performance.now();
  let requestBody: ToneRequest;

  try {
    // Parse and validate request body
    requestBody = toneRequestSchema.parse(req.body);
  } catch (error) {
    console.error("Invalid request body:", error);
    return res.status(400).json({
      error:
        "Invalid request format. Required: message (string), tone ('professional' | 'casual')",
    });
  }

  try {
    const { message, tone, numResults } = requestBody;
    const effectiveNumResults = typeof numResults === "number" ? numResults : 5;

    console.log(`🎭 Starting ${tone} tone response for: "${message}"`);

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // Perform vector search to get relevant context
    let searchResults: SearchResponse;
    try {
      await vectorSearchService.connect();
      const results = await vectorSearchService.search(
        message,
        effectiveNumResults
      );
      searchResults = {
        success: true,
        results,
        query: message,
        totalResults: results.length,
      };
      console.log(
        `🔍 Found ${results.length} relevant context chunks for ${tone} tone`
      );
    } catch (searchError) {
      console.error(`Vector search failed for ${tone} tone:`, searchError);
      searchResults = {
        success: false,
        results: [],
        query: message,
        totalResults: 0,
        error:
          searchError instanceof Error
            ? searchError.message
            : "Vector search failed",
      };
    }

    // Create RAG prompt with context and tone instruction
    const contextChunks = searchResults.success
      ? searchResults.results.map((result) => result.text)
      : [];

    const baseRagPrompt = createRagPrompt(message, contextChunks);

    // Add tone-specific instructions
    const tonePrompt =
      tone === "professional"
        ? `${baseRagPrompt}\n\nIMPORTANT: Respond in a professional, formal tone suitable for business communication. Use proper business language, avoid contractions (don't → do not), maintain a respectful and authoritative voice, and structure your response clearly with proper formatting.`
        : `${baseRagPrompt}\n\nIMPORTANT: Respond in a casual, friendly tone as if talking to a friend. Use conversational language, contractions (don't, can't, won't), maintain a warm and approachable voice, and feel free to use emojis and informal expressions.`;

    console.log(`🤖 Sending ${tone} tone request to Gemini API...`);

    let fullResponse = "";
    let chunkCount = 0;

    // Stream the Gemini response with tone-specific instructions
    for await (const chunk of sendGeminiStreamRequest({
      text: tonePrompt,
      temperature: 0.7,
      maxTokens: 2048,
    })) {
      fullResponse += chunk;
      chunkCount++;

      // Send each chunk as a Server-Sent Event with tone metadata
      const event = `data: ${JSON.stringify({
        id: generateUUID(),
        role: "assistant",
        parts: [{ type: "text", text: fullResponse }],
        tone: tone,
        isComplete: false,
        chunkCount: chunkCount,
        metadata: {
          searchPerformed: searchResults.success,
          contextChunksFound: contextChunks.length,
          totalSearchResults: searchResults.totalResults,
          searchQuery: message,
          searchError: searchResults.error,
        },
      })}\n\n`;

      res.write(event);
    }

    // Send final completion event for this tone
    const finalEvent = `data: ${JSON.stringify({
      id: generateUUID(),
      role: "assistant",
      parts: [{ type: "text", text: fullResponse }],
      tone: tone,
      isComplete: true,
      chunkCount: chunkCount,
      metadata: {
        searchPerformed: searchResults.success,
        contextChunksFound: contextChunks.length,
        totalSearchResults: searchResults.totalResults,
        searchQuery: message,
        searchError: searchResults.error,
      },
    })}\n\n`;

    res.write(finalEvent);
    res.write("data: [DONE]\n\n");
    res.end();

    const endTime = performance.now();
    console.log(
      `✅ ${tone} tone response completed in ${(endTime - startTime).toFixed(
        2
      )}ms`
    );
  } catch (error) {
    const endTime = performance.now();
    console.error(
      `❌ ${tone} tone endpoint error after ${(endTime - startTime).toFixed(
        2
      )}ms:`,
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        error: `An error occurred while processing the ${tone} tone request`,
      });
    } else {
      // Headers already sent, send error via SSE
      const errorEvent = `data: ${JSON.stringify({
        id: generateUUID(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `Sorry, I encountered an error while generating the ${tone} response. Please try again.`,
          },
        ],
        tone: tone,
        isComplete: true,
        error: true,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })}\n\n`;

      res.write(errorEvent);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
};
