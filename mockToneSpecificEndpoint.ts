import type { Request, Response } from "express";
import { performance } from "perf_hooks";
import { z } from "zod";
import type { SearchResponse } from "./lib/types";
import { generateUUID } from "./lib/utils";
import { vectorSearchService } from "./lib/vectorSearch";

// Schema for tone-specific requests (same as real endpoint)
const toneRequestSchema = z.object({
  message: z.string(),
  tone: z.enum(["professional", "casual"]),
  numResults: z.number().optional().default(5),
});

type ToneRequest = z.infer<typeof toneRequestSchema>;

// Mock responses for different tones
const getMockResponse = (
  message: string,
  tone: "professional" | "casual",
  contextChunks: string[]
) => {
  const hasContext = contextChunks.length > 0;

  if (tone === "professional") {
    return `## Professional Response

Thank you for your inquiry regarding "${message}".

### Analysis

I have carefully reviewed your request and ${
      hasContext
        ? "analyzed the available documentation"
        : "considered the relevant factors"
    }. Based on my assessment, I can provide you with the following comprehensive response.

### Key Recommendations

1. **Primary Approach**: The most effective strategy would be to implement a systematic methodology that addresses your core requirements.

2. **Best Practices**: Industry standards recommend following established protocols to ensure optimal results and maintain compliance with relevant guidelines.

3. **Implementation Strategy**: I suggest proceeding with a phased approach that allows for proper testing and validation at each stage.

### Technical Considerations

- **Scalability**: Ensure that the solution can accommodate future growth and changing requirements
- **Security**: Implement appropriate security measures to protect sensitive data and maintain system integrity
- **Performance**: Optimize for efficiency while maintaining reliability and user experience

${
  hasContext
    ? "### Reference Documentation\n\nThis response is based on the available documentation and best practices from the knowledge base."
    : ""
}

### Next Steps

I recommend that you:
- Review the proposed approach with your team
- Conduct a feasibility assessment
- Develop a detailed implementation plan

Should you require additional clarification or have further questions, please do not hesitate to reach out.

**Best regards**`;
  } else {
    return `# Hey there! ��

Thanks for asking about "${message}" - that's a great question!

## Here's what I'm thinking ��

So I've been pondering this, and ${
      hasContext ? "I've looked through some docs and" : ""
    } here's my take on it:

### The Cool Stuff ✨

- **First off** - you're totally asking the right questions! This is exactly the kind of thing that can make a huge difference.
- **My approach** - I'd probably tackle this step by step, you know? No need to overcomplicate things!
- **Pro tip** - don't forget to test things out as you go. It's way easier to catch issues early! 😉

### Let's Break It Down ��

1. **Start simple** - Get the basics working first (trust me on this one!)
2. **Then level up** - Once you've got the foundation, you can add all the fancy features
3. **Keep it flexible** - Things change, so make sure your solution can adapt

### Fun Facts 🚀

- This kind of challenge is actually pretty common
- There are tons of ways to approach it (which is both awesome and overwhelming, I know!)
- The best solution is usually the one that fits YOUR specific needs

${
  hasContext
    ? "### BTW 📚\n\nI found some relevant info in the docs that might help you out!"
    : ""
}

Hope this helps! Let me know if you wanna brainstorm more ideas or if anything doesn't make sense. I'm always down to chat about this stuff! ��

**Catch you later!** 🎉`;
  }
};

// Improved streaming simulation with better timing and realistic delays
const simulateStreaming = async function* (fullResponse: string) {
  // Split by sentences for more natural streaming
  const sentences = fullResponse.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let currentChunk = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (sentence) {
      currentChunk += (currentChunk ? '. ' : '') + sentence + '.';
      
      // Send chunk after each sentence
      yield currentChunk;
      
      // Add realistic delay between sentences (150-400ms) to simulate AI streaming
      await new Promise(resolve => setTimeout(resolve, Math.random() * 250 + 150));
    }
  }
};

export const mockToneSpecificEndpoint = async (req: Request, res: Response) => {
  const startTime = performance.now();
  let requestBody: ToneRequest;

  try {
    // Parse and validate request body (same as real endpoint)
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

    console.log(
      `🎭 Starting ${tone} tone response for: "${message}" (MOCK MODE)`
    );

    // Set headers for Server-Sent Events (same as real endpoint)
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // Skip vector search for mock endpoint to avoid MongoDB issues during development
    console.log(`🔍 Skipping vector search for mock endpoint (development mode)`);
    const searchResults: SearchResponse = {
      success: false,
      results: [],
      query: message,
      totalResults: 0,
      error: "Vector search disabled for mock endpoint",
    };

    const contextChunks: string[] = [];

    console.log(`�� Generating mock ${tone} tone response...`);

    // Generate mock response based on tone
    const mockResponse = getMockResponse(message, tone, contextChunks);
    
    let fullResponse = "";
    let chunkCount = 0;

    console.log(`�� Starting to stream ${tone} tone response...`);

    // Stream the mock response with improved timing
    for await (const chunk of simulateStreaming(mockResponse)) {
      fullResponse = chunk;
      chunkCount++;

      console.log(`📡 ${tone} tone: Sending chunk ${chunkCount} (${chunk.length} chars)`);

      // Send each chunk as a Server-Sent Event with tone metadata (same format as original)
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
          isMock: true, // Added to indicate this is a mock response
        },
      })}\n\n`;

      res.write(event);
      
      // Small delay between chunks to ensure proper streaming and prevent overwhelming the client
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Send final completion event for this tone (same format as original)
    console.log(`✅ ${tone} tone: Sending completion event`);
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
        isMock: true, // Added to indicate this is a mock response
      },
    })}\n\n`;

    res.write(finalEvent);
    res.write("data: [DONE]\n\n");
    res.end();

    const endTime = performance.now();
    console.log(
      `✅ ${tone} tone mock response completed in ${(
        endTime - startTime
      ).toFixed(2)}ms`
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
      // Headers already sent, send error via SSE (same format as original)
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