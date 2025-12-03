import { NextResponse } from 'next/server';
import { addExampleToLabel } from '@/src/labelsManager.js';
import { recomputeEmbeddings } from '@/src/embeddingService.js';

export async function POST(request, { params }) {
  try {
    const { labelName } = params;
    const body = await request.json();
    const { example } = body;

    if (!example) {
      return NextResponse.json(
        { error: 'Example is required' },
        { status: 400 }
      );
    }

    const updatedLabel = addExampleToLabel(labelName, example);

    // Trigger recomputation (don't wait for it to complete)
    recomputeEmbeddings().catch((err) => {
      console.error('Error recomputing embeddings in background:', err);
    });

    return NextResponse.json({
      message: 'Example added successfully. Embeddings are being recomputed in the background.',
      label: updatedLabel,
    });
  } catch (error) {
    console.error('Error adding example:', error);
    return NextResponse.json(
      { error: 'Failed to add example', details: error.message },
      { status: 400 }
    );
  }
}

