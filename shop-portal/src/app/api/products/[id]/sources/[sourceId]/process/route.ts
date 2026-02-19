import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { extractPDFContent, scrapeURLContent } from '@/lib/content-extraction'
import { chunkContent, generateEmbedding, generateEmbeddingsBatch } from '@/lib/chunking-service'

/**
 * POST /api/products/[id]/sources/[sourceId]/process
 * Process a source material (extract content, chunk, generate embeddings)
 * This runs in the background after upload
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id: productId, sourceId } = await params
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get source material
    const { data: sourceMaterial, error: sourceError } = await supabase
      .from('product_source_materials')
      .select('*')
      .eq('id', sourceId)
      .eq('product_id', productId)
      .single()

    if (sourceError || !sourceMaterial) {
      return NextResponse.json({ error: 'Source material not found' }, { status: 404 })
    }

    // Update status to processing
    await supabase
      .from('product_source_materials')
      .update({ processing_status: 'processing' })
      .eq('id', sourceId)

    try {
      let extractedText = ''
      let metadata: any = {}

      // Extract content based on type
      if (sourceMaterial.source_type === 'pdf' && sourceMaterial.file_url) {
        // Download PDF from storage
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Extract file path from URL
        // URL format: https://[project].supabase.co/storage/v1/object/public/product-sources/sources/[path]
        // or: https://[project].supabase.co/storage/v1/object/sign/product-sources/sources/[path]?token=...
        let filePath: string | null = null
        
        if (sourceMaterial.file_url.includes('/product-sources/')) {
          // Extract path after /product-sources/
          const urlParts = sourceMaterial.file_url.split('/product-sources/')
          if (urlParts.length > 1) {
            // Remove query parameters if present
            const pathWithQuery = urlParts[1]
            const pathOnly = pathWithQuery.split('?')[0]
            filePath = pathOnly.startsWith('sources/') ? pathOnly : `sources/${pathOnly}`
          }
        } else if (sourceMaterial.file_url.includes('product-sources')) {
          // Alternative URL format
          const match = sourceMaterial.file_url.match(/product-sources[\/](.+?)(?:\?|$)/)
          if (match && match[1]) {
            const pathOnly = match[1].split('?')[0]
            filePath = pathOnly.startsWith('sources/') ? pathOnly : `sources/${pathOnly}`
          }
        }

        console.log('[PDF PROCESS] File URL:', sourceMaterial.file_url)
        console.log('[PDF PROCESS] Extracted path:', filePath)

        if (!filePath) {
          throw new Error(`Could not extract file path from URL: ${sourceMaterial.file_url}`)
        }

        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from('product-sources')
          .download(filePath)

        if (downloadError) {
          console.error('[PDF PROCESS] Download error:', downloadError)
          throw new Error(`Failed to download PDF file: ${downloadError.message}`)
        }

        if (!fileData) {
          throw new Error('PDF file data is empty')
        }

        const fileBuffer = Buffer.from(await fileData.arrayBuffer())
        const extracted = await extractPDFContent(fileBuffer)
        extractedText = extracted.text
        metadata = extracted.metadata

      } else if (sourceMaterial.source_type === 'url' && sourceMaterial.external_url) {
        const extracted = await scrapeURLContent(sourceMaterial.external_url)
        extractedText = extracted.text
        metadata = extracted.metadata

      } else if (sourceMaterial.source_type === 'text' && sourceMaterial.text_content) {
        extractedText = sourceMaterial.text_content
        metadata = { wordCount: extractedText.split(/\s+/).length }
      }

      if (!extractedText) {
        throw new Error('No content extracted')
      }

      // Update source material with extracted text
      await supabase
        .from('product_source_materials')
        .update({
          extracted_text: extractedText,
          processing_status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', sourceId)

      // Chunk the content
      const chunks = chunkContent(extractedText, {
        chunkSize: 500,
        overlap: 100,
        respectParagraphs: true
      })

      // Generate embeddings for chunks
      const embeddings = await generateEmbeddingsBatch(chunks, 100)

      // Save chunks to database
      const chunksToInsert = chunks.map((chunk, index) => ({
        source_material_id: sourceId,
        product_id: productId,
        chunk_text: chunk.chunk_text,
        chunk_type: chunk.chunk_type,
        order_index: chunk.order_index,
        relevance_score: chunk.relevance_score,
        embedding: embeddings.get(index) || null,
        page_number: metadata.pages ? Math.floor(index / 10) + 1 : null
      }))

      // Insert chunks in batches
      for (let i = 0; i < chunksToInsert.length; i += 50) {
        const batch = chunksToInsert.slice(i, i + 50)
        const { error: chunkError } = await supabase
          .from('product_content_chunks')
          .insert(batch)

        if (chunkError) {
          console.error('Error inserting chunks:', chunkError)
        }
      }

      return NextResponse.json({
        success: true,
        chunksCreated: chunksToInsert.length,
        wordCount: extractedText.split(/\s+/).length
      })

    } catch (processingError) {
      // Update status to error
      await supabase
        .from('product_source_materials')
        .update({
          processing_status: 'error',
          processing_error: processingError instanceof Error ? processingError.message : 'Unknown error'
        })
        .eq('id', sourceId)

      return NextResponse.json({
        success: false,
        error: processingError instanceof Error ? processingError.message : 'Processing failed'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in POST /api/products/[id]/sources/[sourceId]/process:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
