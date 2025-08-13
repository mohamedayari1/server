// lib/errors.js
export class ChatSDKError extends Error {
  type: string;
  constructor(type: string, message: string) {
    super(message);
    this.type = type;
  }
  toResponse() {
    return new Response(JSON.stringify({ error: this.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
