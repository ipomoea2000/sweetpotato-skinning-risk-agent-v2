import { NextRequest, NextResponse } from "next/server";

async function parseResponse(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export async function POST(request: NextRequest) {
  const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.APP_SHARED_SECRET;

  if (!endpoint || !secret) {
    return NextResponse.json(
      { error: "The shared research database is not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, secret }),
      cache: "no-store"
    });
    const data = await parseResponse(response);

    if (!response.ok || data.ok === false) {
      return NextResponse.json(
        { error: data.error || "Google database request failed.", detail: data },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database request failed." },
      { status: 502 }
    );
  }
}

export async function GET() {
  const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.APP_SHARED_SECRET;

  if (!endpoint || !secret) {
    return NextResponse.json(
      { error: "The shared research database is not configured." },
      { status: 503 }
    );
  }

  try {
    const url = new URL(endpoint);
    url.searchParams.set("action", "dashboard");
    url.searchParams.set("secret", secret);
    const response = await fetch(url, { cache: "no-store" });
    const data = await parseResponse(response);
    return NextResponse.json(data, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dashboard request failed." },
      { status: 502 }
    );
  }
}
