import { SimpleRetriever } from './simple-retriever';

export interface ContextContent {
  type: 'wiki' | 'response' | 'message';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ContextRetriever {
  /**
   * Index content for an image (for vector DB implementations)
   * For simple retriever, this is a no-op since content is already in DB
   */
  indexContent(imageId: string, content: ContextContent[]): Promise<void>;

  /**
   * Retrieve relevant context for a query
   * Returns concatenated context string ready for LLM
   */
  retrieve(imageId: string, query: string, limit?: number): Promise<string>;
}

// Export the retriever to use
// To upgrade to vector DB, just change this to: new VectorRetriever()
export const retriever: ContextRetriever = new SimpleRetriever();

// Re-export implementations for direct use if needed
export { SimpleRetriever } from './simple-retriever';
// export { VectorRetriever } from './vector-retriever'; // Uncomment when implemented
