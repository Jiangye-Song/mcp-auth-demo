import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory log of OAuth callbacks
let lastCallbackTime: Date | null = null;
let lastCallbackData: any = null;

export async function GET(request: NextRequest) {
    return NextResponse.json({
        message: 'OAuth callback status',
        lastCallbackTime: lastCallbackTime?.toISOString() || 'never',
        timeSinceLastCallback: lastCallbackTime ? Date.now() - lastCallbackTime.getTime() : null,
        lastCallbackData: lastCallbackData
    });
}

// This will be called by our OAuth callback to log when it happens
export async function POST(request: NextRequest) {
    const body = await request.json();
    lastCallbackTime = new Date();
    lastCallbackData = {
        timestamp: lastCallbackTime.toISOString(),
        ...body
    };

    return NextResponse.json({ message: 'Callback logged' });
}