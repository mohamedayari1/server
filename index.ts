// index.js

// Import Express and other necessary modules.
const express = require("express");
const { performance } = require("perf_hooks");
const z = require("zod");

// Import your placeholder files.
// We are using relative paths here to make it simple.
const { ChatSDKError } = require("./lib/errors");
const { sendGeminiRequest } = require("./lib/ai/gemini");
const { vectorSearchService } = require("./lib/vectorSearch");

const app = express();
const port = 3001;

// FUNDAMENTAL CONCEPT: Middleware
// This middleware is crucial. It tells Express to parse incoming
// request bodies with JSON payloads. Without this, `req.body`
// would be undefined.
app.use(express.json());

// Schema for the RAG request body using zod
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

// A simple type definition for the request body
// This is not used at runtime in JavaScript but helps with understanding
// the structure.
// type RagRequestBody = z.infer<typeof ragRequestBodySchema>;

// RAG prompt template for Vedic astrology expert
const createRagPrompt = (query, contextChunks) => {
  const contextText =
    contextChunks.length > 0
      ? contextChunks
          .map((chunk, index) => `Context ${index + 1}:\n${chunk}`)
          .join("\n\n")
      : "No relevant context found.";

  return `You are an expert Vedic astrologer and spiritual guide with deep knowledge of ancient Indian wisdom, astrology, and philosophy. You have studied the Vedas, Upanishads, and classical astrological texts extensively. Use the following context from authentic Vedic sources to answer the user's question with authority and wisdom.

Context:
${contextText}

User Question: ${query}

Please provide a comprehensive and authoritative answer based on the Vedic context provided. If the context doesn't contain enough information to answer the question accurately, acknowledge this and provide insights based on your deep knowledge of Vedic astrology and philosophy. Always maintain the spiritual and philosophical depth that characterizes authentic Vedic wisdom.`;
};

// This is your POST route
app.post("/api/rag", async (req, res) => {
  const totalStart = performance.now();

  try {
    // FUNDAMENTAL CONCEPT: Request Parsing and Validation
    // We use Zod to validate the incoming request body. This is a best practice
    // to ensure the data we receive is in the expected format before processing it.
    const requestBody = ragRequestBodySchema.parse(req.body);
    console.log(
      `📝 [Parse] Request parsed in ${(performance.now() - totalStart).toFixed(
        2
      )}ms`
    );

    const { message, numResults, selectedChatModel } = requestBody;
    const effectiveNumResults = typeof numResults === "number" ? numResults : 5;
    console.log(`🤖 [Model] Selected chat model: ${selectedChatModel}`);

    // Extract the text from the message parts
    const userText = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ");
    console.log(`💬 [Extract] User text extracted...`);

    if (!userText) {
      console.log("❌ [Extract] No text content found");
      return res.status(400).json({ error: "No text content found" });
    }

    // Step 1: Perform vector search to get relevant chunks
    const searchStart = performance.now();
    let searchResults;
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
      console.log(
        `🔍 [Vector Search] Found ${results.length} results in ${(
          performance.now() - searchStart
        ).toFixed(2)}ms`
      );
    } catch (searchError) {
      console.log(`❌ [Vector Search] Error:`, searchError);
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

    // Step 2: Extract context from search results
    const contextChunks = searchResults.success
      ? searchResults.results.map((result) => result.text)
      : [];
    console.log(
      `📚 [Context] Extracted ${contextChunks.length} context chunks...`
    );

    // Step 3: Create RAG prompt with context
    const ragPrompt = createRagPrompt(userText, contextChunks);
    console.log(`📝 [Prompt] RAG prompt created...`);

    // Step 4: Send to Gemini with the RAG prompt
    const geminiStart = performance.now();
    const geminiResponse = await sendGeminiRequest({
      text: ragPrompt,
      temperature: 0.7,
      maxTokens: 2048,
    });
    console.log(
      `🔮 [Gemini] Gemini response received in ${(
        performance.now() - geminiStart
      ).toFixed(2)}ms`
    );

    if (!geminiResponse.success) {
      console.log("❌ [Gemini] Gemini API failed");
      return res
        .status(500)
        .json({
          error:
            geminiResponse.error || "Failed to get response from Gemini API",
        });
    }

    // Step 5: Create response with metadata about the search
    const assistantMessage = {
      id: `rag-${Date.now()}`,
      role: "assistant",
      parts: [{ type: "text", text: geminiResponse.text }],
    };

    const responseData = {
      messages: [assistantMessage],
      id: requestBody.id,
      metadata: {
        searchPerformed: searchResults.success,
        contextChunksFound: contextChunks.length,
        totalSearchResults: searchResults.totalResults,
        searchQuery: userText,
        searchError: searchResults.error,
      },
    };
    console.log(
      `✅ [Total] RAG pipeline completed in ${(
        performance.now() - totalStart
      ).toFixed(2)}ms`
    );

    return res.json(responseData);
  } catch (error) {
    console.log(`❌ [Total] RAG route error:`, error);
    if (error instanceof z.ZodError) {
      // Return a 400 Bad Request for validation errors
      return res
        .status(400)
        .json({ error: "Invalid request body", details: error.errors });
    }
    return res
      .status(500)
      .json({ error: "An error occurred while processing the RAG request" });
  }
});

// FUNDAMENTAL CONCEPT: Listening for Connections
// This line starts the server and makes it listen for incoming requests
// on the specified port.
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
