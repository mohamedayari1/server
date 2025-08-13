// lib/ai/gemini.js
export async function sendGeminiRequest({ text }: { text: string }) {
  console.log("MOCK: Sending text to Gemini...");
  // Simulate a successful response
  return {
    success: true,
    text: `This is a mock response from Gemini based on your prompt: "${text.substring(
      0,
      50
    )}..."`,
  };
}
