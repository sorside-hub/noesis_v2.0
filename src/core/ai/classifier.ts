export interface ClassificationResult {
  needRAG: boolean;
  intent: string;
  reasoningStyle?: string;
  memoryDepth?: 'shallow' | 'normal' | 'deep' | 'very_deep' | 'broad';
  category: string | null;
  confidence: number;
  reason: string;
}

export class GroqClassifierService {
  /**
   * Classifies user message intent to determine if Vault context (RAG) is needed.
   * Uses Groq AI model endpoint via server API.
   */
  async classifyIntent(message: string): Promise<ClassificationResult> {
    if (!message || !message.trim()) {
      return {
        needRAG: false,
        intent: 'general',
        category: null,
        confidence: 1,
        reason: 'Empty message',
      };
    }

    try {
      const response = await fetch('/api/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`Classifier API returned status ${response.status}`);
      }

      const data = await response.json();

      return {
        needRAG: Boolean(data.needRAG),
        intent: typeof data.intent === 'string' ? data.intent : 'general',
        reasoningStyle: typeof data.reasoningStyle === 'string' ? data.reasoningStyle : undefined,
        memoryDepth: typeof data.memoryDepth === 'string' ? data.memoryDepth : undefined,
        category: typeof data.category === 'string' && data.category ? data.category : null,
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.8,
        reason: typeof data.reason === 'string' ? data.reason : '',
      };
    } catch (error) {
      console.warn('GroqClassifier error:', error);
      throw error;
    }
  }
}

export const groqClassifier = new GroqClassifierService();
