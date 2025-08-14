import { Collection, MongoClient } from 'mongodb';
import { AzureOpenAI } from 'openai';
import type { VectorSearchResult } from './types';

class VectorSearchService {
  private static instance: VectorSearchService;
  private client: MongoClient | null = null;
  private collection: Collection | null = null;
  private embeddingClient: AzureOpenAI | null = null;

  private constructor() {}

  static getInstance(): VectorSearchService {
    if (!VectorSearchService.instance) {
      VectorSearchService.instance = new VectorSearchService();
    }
    return VectorSearchService.instance;
  }

  async connect(): Promise<void> {
    if (this.client) return;

    this.client = new MongoClient(process.env.COSMOS_MONGO_CONNECTION_STRING!);
    await this.client.connect();
    
    const database = this.client.db(process.env.COSMOS_MONGO_DATABASE_NAME);
    this.collection = database.collection(process.env.COSMOS_MONGO_COLLECTION_NAME);
    
    this.embeddingClient = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
    });
  }

  async search(query: string, numResults: number = 5): Promise<VectorSearchResult[]> {
    if (!this.collection || !this.embeddingClient) {
      throw new Error('Service not initialized');
    }

    // Generate embeddings
    const response = await this.embeddingClient.embeddings.create({
      input: [query],
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
    });
    const queryEmbedding = response.data[0].embedding;

    // Execute search
    const pipeline = [
      {
        $search: {
          cosmosSearch: {
            vector: queryEmbedding,
            path: "embedding",
            k: numResults,
          },
          returnStoredSource: true
        }
      },
      {
        // $project: {
        //   similarityScore: { $meta: 'searchScore' },
        //   document: '$$ROOT'
        // }
        $project: {
          _id: 1,
          similarityScore: { $meta: 'searchScore' },
          text: '$text',
          semester: '$semester',
          lesson: '$lesson',
          source_file: '$source_file'
          // Do NOT include 'embedding'
        }
      }
    ];

    const results = await this.collection.aggregate(pipeline).toArray() as VectorSearchResult[];
    return results;
  }
}

export const vectorSearchService = VectorSearchService.getInstance();