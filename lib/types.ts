import { z } from "zod";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type ChatTools = {};

// export type ChatMessage = UIMessage<
//   MessageMetadata,
//   CustomUIDataTypes,
//   ChatTools
// >;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}

export interface VectorSearchResult {
  _id: string;
  text: string;
  source_file?: string;
  semester?: string;
  lesson?: string;
  similarityScore: number;
}

export interface SearchRequest {
  query: string;
  numResults?: number;
}

export interface SearchResponse {
  success: boolean;
  results: VectorSearchResult[];
  query: string;
  totalResults: number;
  error?: string;
}
