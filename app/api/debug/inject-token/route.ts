import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint for injecting tokens during development
 * This allows manual testing of token verification
 */
export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
    }

    try {
        const { token } = await req.json();

        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 400 });
        }

        // Store in global for testing
        (globalThis as any).mcpDebugToken = token;

        console.log('🧪 Debug token injected for testing');
        console.log('Token preview:', token.substring(0, 30) + '...');

        return NextResponse.json({
            success: true,
            message: 'Token injected for testing',
            tokenPreview: token.substring(0, 30) + '...',
            length: token.length
        });
    } catch (error) {
        return NextResponse.json({
            error: 'Invalid request',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 400 });
    }
}

export async function GET(req: NextRequest) {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
    }

    const currentToken = (globalThis as any).mcpDebugToken;

    return NextResponse.json({
        hasToken: !!currentToken,
        tokenPreview: currentToken ? currentToken.substring(0, 30) + '...' : null,
        length: currentToken?.length || 0
    });
}

export async function DELETE(req: NextRequest) {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 });
    }

    delete (globalThis as any).mcpDebugToken;

    return NextResponse.json({
        success: true,
        message: 'Debug token cleared'
    });
}