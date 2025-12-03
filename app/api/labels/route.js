import { NextResponse } from 'next/server';
import { getAllLabels, addExampleToLabel } from '@/src/labelsManager.js';
import { recomputeEmbeddings } from '@/src/embeddingService.js';

export async function GET() {
  try {
    const labels = getAllLabels();
    return NextResponse.json(labels);
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch labels', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { labelName, example } = body;

    if (!labelName || !example) {
      return NextResponse.json(
        { error: 'labelName and example are required' },
        { status: 400 }
      );
    }

    const updatedLabel = addExampleToLabel(labelName, example);

    // Trigger recomputation
    try {
      await recomputeEmbeddings();
      return NextResponse.json({
        message: 'Example added and embeddings recomputed',
        label: updatedLabel,
      });
    } catch (recomputeErr) {
      console.error('Error recomputing embeddings:', recomputeErr);
      return NextResponse.json(
        {
          error: 'Example added but embedding recomputation failed',
          details: recomputeErr.message,
          label: updatedLabel,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error adding example:', error);

    // Check if it's a read-only filesystem error
    if (error.message && error.message.includes('read-only')) {
      return NextResponse.json(
        {
          error: 'File writes not supported in serverless environment',
          details: error.message,
          suggestion: 'Please update data/labels.json in your repository and redeploy, or use a database/storage solution.'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add example', details: error.message },
      { status: 400 }
    );
  }
}

