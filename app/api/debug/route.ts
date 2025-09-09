import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to test if the OAuth flow is working correctly
 * This endpoint logs all requests to help debug the OAuth flow
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const authHeader = request.headers.get('Authorization');

    console.log('=== DEBUG AUTH REQUEST ===');
    console.log('URL:', request.url);
    console.log('Authorization header:', authHeader);
    console.log('All headers:', Object.fromEntries(request.headers.entries()));
    console.log('Query params:', Object.fromEntries(url.searchParams.entries()));
    console.log('=========================');

    return NextResponse.json({
        message: 'Debug auth endpoint',
        hasAuthHeader: !!authHeader,
        authHeader: authHeader,
        headers: Object.fromEntries(request.headers.entries()),
        params: Object.fromEntries(url.searchParams.entries())
    });
}

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    const body = await request.text();

    console.log('=== DEBUG AUTH POST ===');
    console.log('URL:', request.url);
    console.log('Authorization header:', authHeader);
    console.log('Body length:', body.length);
    console.log('All headers:', Object.fromEntries(request.headers.entries()));
    console.log('======================');

    return NextResponse.json({
        message: 'Debug auth POST endpoint',
        hasAuthHeader: !!authHeader,
        authHeader: authHeader,
        bodyLength: body.length,
        headers: Object.fromEntries(request.headers.entries())
    });
}