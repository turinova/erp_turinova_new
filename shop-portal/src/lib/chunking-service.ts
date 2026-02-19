// Chunking and Embedding Service
// Handles content chunking and embedding generation for RAG

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export interface ContentChunk {
  chunk_text: string
  chunk_type: 'specification' | 'feature' | 'benefit' | 'use_case' | 'technical' | 'marketing' | 'other'
  page_number?: number
  section_title?: string
  order_index: number
  relevance_score: number
}

/**
 * Chunk content into smaller pieces for RAG
 */
export function chunkContent(
  text: string,
  options: {
    chunkSize?: number // words per chunk
    overlap?: number // words overlap between chunks
    respectParagraphs?: boolean
  } = {}
): ContentChunk[] {
  const {
    chunkSize = 500,
    overlap = 100,
    respectParagraphs = true
  } = options

  const chunks: ContentChunk[] = []
  const words = text.split(/\s+/)
  
  let currentIndex = 0
  let chunkIndex = 0

  while (currentIndex < words.length) {
    let chunkWords: string[] = []
    let wordCount = 0

    // Build chunk respecting paragraph boundaries when possible
    while (wordCount < chunkSize && currentIndex < words.length) {
      const word = words[currentIndex]
      chunkWords.push(word)
      wordCount++
      currentIndex++

      // If we hit a paragraph break and have enough words, break here
      if (respectParagraphs && word.includes('\n\n') && wordCount >= chunkSize * 0.7) {
        break
      }
    }

    const chunkText = chunkWords.join(' ').trim()
    
    if (chunkText.length > 0) {
      // Classify chunk type (simple heuristic, can be improved with AI)
      const chunkType = classifyChunkType(chunkText)

      chunks.push({
        chunk_text: chunkText,
        chunk_type: chunkType,
        order_index: chunkIndex,
        relevance_score: 1.0
      })

      chunkIndex++

      // Move back for overlap
      if (currentIndex < words.length) {
        currentIndex = Math.max(0, currentIndex - overlap)
      }
    } else {
      currentIndex++
    }
  }

  return chunks
}

/**
 * Classify chunk type based on content
 */
function classifyChunkType(text: string): ContentChunk['chunk_type'] {
  const lowerText = text.toLowerCase()

  // Technical specifications
  if (/\b(mm|cm|kg|g|inch|ft|specification|dimension|size|weight|material)\b/i.test(lowerText)) {
    return 'specification'
  }

  // Features
  if (/\b(feature|includes|equipped|has|contains|offers)\b/i.test(lowerText)) {
    return 'feature'
  }

  // Benefits
  if (/\b(benefit|advantage|improves|enhances|increases|reduces|saves)\b/i.test(lowerText)) {
    return 'benefit'
  }

  // Use cases
  if (/\b(use|application|suitable|ideal|perfect for|designed for|works with)\b/i.test(lowerText)) {
    return 'use_case'
  }

  // Technical
  if (/\b(technical|installation|mounting|assembly|wiring|connection)\b/i.test(lowerText)) {
    return 'technical'
  }

  // Marketing
  if (/\b(premium|quality|exclusive|limited|special|new|best|top)\b/i.test(lowerText)) {
    return 'marketing'
  }

  return 'other'
}

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000) // Limit to 8000 characters (API limit)
    })

    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate embeddings for multiple chunks in batch
 */
export async function generateEmbeddingsBatch(
  chunks: ContentChunk[],
  batchSize: number = 100
): Promise<Map<number, number[]>> {
  const embeddings = new Map<number, number[]>()
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const texts = batch.map(chunk => chunk.chunk_text.slice(0, 8000))
    
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts
      })

      response.data.forEach((embedding, index) => {
        embeddings.set(i + index, embedding.embedding)
      })

      // Rate limiting: wait between batches
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay
      }
    } catch (error) {
      console.error(`Error generating embeddings for batch ${i}-${i + batchSize}:`, error)
      // Continue with other batches
    }
  }

  return embeddings
}
