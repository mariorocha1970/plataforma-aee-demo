function cookie(request: Request, name: string) {
  const entry = (request.headers.get("cookie") ?? "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

export async function GET(request: Request) {
  const expected = process.env.DEMO_SESSION_TOKEN ?? "";
  const allowed = Boolean(expected) && cookie(request, "aee_demo_session") === expected;
  return new Response(null, { status: allowed ? 204 : 401, headers: { "Cache-Control": "no-store" } });
}
