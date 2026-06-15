/**
 * EventFlow — Recipes Alias API Route
 * GET/POST/PUT/DELETE /api/stock/recipes → proxied to /api/recipes
 *
 * This keeps the URL consistent with the stock module while
 * reusing the core recipes API.
 */

import { NextRequest, NextResponse } from 'next/server';

function proxyRequest(request: NextRequest) {
  const url = new URL(request.url);
  const targetUrl = `${url.origin}/api/recipes${url.search}`;

  return NextResponse.redirect(targetUrl, {
    status: 307, // Temporary redirect — preserves method
    headers: {
      // Forward the cookie header so auth carries over
      ...(request.headers.get('cookie') ? { cookie: request.headers.get('cookie')! } : {}),
    },
  });
}

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}
