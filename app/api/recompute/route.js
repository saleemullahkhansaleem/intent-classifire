import { NextResponse } from 'next/server';
import { recomputeEmbeddings } from '@/src/embeddingService.js';

// Increase timeout for this route (Vercel has 10s limit on Hobby, 60s on Pro)
export const maxDuration = 60;

export async function POST() {
  try {
    console.log('Starting embedding recomputation request...');
    const result = await recomputeEmbeddings();
    console.log('Recomputation completed successfully:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error recomputing embeddings:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Failed to recompute embeddings',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

