const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

async function proxyRequest(
  request: Request,
  params: Promise<{ slug: string[] }>,
  method: string
) {
  const { slug } = await params;
  const path = slug.join("/");
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}/api/${path}${url.search}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Forward auth: cookie or Authorization header
  const authHeader = request.headers.get("Authorization");
  const cookie = request.headers.get("Cookie");
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  if (cookie) {
    headers["Cookie"] = cookie;
  }

  const init: RequestInit = { method, headers };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.text();
  }

  const res = await fetch(backendUrl, init);
  const body = await res.text();

  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Forward Set-Cookie from backend to browser
  const setCookie = res.headers.get("Set-Cookie");
  if (setCookie) {
    responseHeaders["Set-Cookie"] = setCookie;
  }

  return new Response(body, {
    status: res.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return proxyRequest(request, params, "GET");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return proxyRequest(request, params, "POST");
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return proxyRequest(request, params, "PUT");
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return proxyRequest(request, params, "DELETE");
}
