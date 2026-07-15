function secret(name: string) {
  return process.env[name] ?? "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { password?: string };
  const password = secret("DEMO_PASSWORD");
  const sessionToken = secret("DEMO_SESSION_TOKEN");
  if (!password || !sessionToken || body.password !== password) return new Response("Credenciais inválidas.", { status: 401 });
  return new Response(null, { status: 204, headers: { "Set-Cookie": `aee_demo_session=${encodeURIComponent(sessionToken)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`, "Cache-Control": "no-store" } });
}
