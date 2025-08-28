import type { Request, Response } from "express";
import { performance } from "perf_hooks";
import { z } from "zod";
import { sendGeminiStreamRequest } from "./lib/ai/gemini";
import { ChatSDKError } from "./lib/errors";
import { createRagPrompt } from "./lib/prompts/simpleAnswer";
import type { SearchResponse } from "./lib/types";
import { generateUUID } from "./lib/utils";
import { vectorSearchService } from "./lib/vectorSearch";

// Schema for the RAG request body
const ragRequestBodySchema = z.object({
  id: z.string(),
  message: z.object({
    role: z.string(),
    parts: z.array(
      z.object({
        type: z.string(),
        text: z.string(),
      })
    ),
    id: z.string(),
  }),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.string(),
  numResults: z.number().optional().default(5),
});

type RagRequestBody = z.infer<typeof ragRequestBodySchema>;

export const geminiEndpoint = async (req: Request, res: Response) => {
  let requestBody: RagRequestBody;
  const totalStart = performance.now();

  try {
    requestBody = ragRequestBodySchema.parse(req.body);
  } catch (_) {
    const error = new ChatSDKError("bad_request:api");
    return res.status(400).json({ error: error.message });
  }

  try {
    const { message, numResults, selectedChatModel } = requestBody;
    const effectiveNumResults = typeof numResults === "number" ? numResults : 5;

    // Extract user text
    const userText = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ");

    if (!userText) {
      return res.status(400).json({ error: "No text content found" });
    }

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // Perform vector search
    let searchResults: SearchResponse;
    try {
      await vectorSearchService.connect();
      const results = await vectorSearchService.search(
        userText,
        effectiveNumResults
      );
      searchResults = {
        success: true,
        results,
        query: userText,
        totalResults: results.length,
      };
    } catch (searchError) {
      searchResults = {
        success: false,
        results: [],
        query: userText,
        totalResults: 0,
        error:
          searchError instanceof Error
            ? searchError.message
            : "Vector search failed",
      };
    }

    // Create RAG prompt
    const contextChunks = searchResults.success
      ? searchResults.results.map((result) => result.text)
      : [];
    const ragPrompt = createRagPrompt(userText, contextChunks);

    try {
      let fullResponse = "";

      // Stream the Gemini response
      for await (const chunk of sendGeminiStreamRequest({
        text: ragPrompt,
        temperature: 0.7,
        maxTokens: 2048,
      })) {
        fullResponse += chunk;

        // Send each chunk as a Server-Sent Event
        const event = `data: ${JSON.stringify({
          id: generateUUID(),
          role: "assistant",
          parts: [{ type: "text", text: fullResponse }],
        })}\n\n`;

        res.write(event);
      }

      // Send final message with metadata
      const finalEvent = `data: ${JSON.stringify({
        id: generateUUID(),
        role: "assistant",
        parts: [{ type: "text", text: fullResponse }],
        metadata: {
          searchPerformed: searchResults.success,
          contextChunksFound: contextChunks.length,
          totalSearchResults: searchResults.totalResults,
          searchQuery: userText,
          searchError: searchResults.error,
        },
      })}\n\n`;

      res.write(finalEvent);
      res.write("data: [DONE]\n\n");
      res.end();

      const totalEnd = performance.now();
      console.log(
        `✅ [Total] RAG streaming pipeline completed in ${(
          totalEnd - totalStart
        ).toFixed(2)}ms`
      );
    } catch (error) {
      console.error("Streaming error:", error);
      const errorEvent = `data: ${JSON.stringify({
        id: generateUUID(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Sorry, I encountered an error. Please try again.",
          },
        ],
      })}\n\n`;

      res.write(errorEvent);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (error) {
    const totalEnd = performance.now();
    console.log(
      `❌ [Total] RAG route error after ${(totalEnd - totalStart).toFixed(
        2
      )}ms:`,
      error
    );

    if (!res.headersSent) {
      return res
        .status(500)
        .json({ error: "An error occurred while processing the RAG request" });
    } else {
      const errorEvent = `data: ${JSON.stringify({
        id: generateUUID(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Sorry, I encountered an error. Please try again.",
          },
        ],
      })}\n\n`;

      res.write(errorEvent);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
};
