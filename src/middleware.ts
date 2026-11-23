import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { canAccessPath } from "@/lib/roles";

const PUBLIC_PATHS = ["/login", "/api/mobile", "/api/client"];

/** Set false to bring the site back online. */
const SITE_DISABLED = true;

const DISABLED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>This site can't be reached</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #fff; color: #202124; }
    body { font-family: "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Arial, sans-serif; }
    main { max-width: 640px; padding: 96px 32px 48px 112px; }
    .icon { display: block; width: 72px; height: 72px; margin: 0 0 20px; }
    h1 { font-size: 24px; font-weight: 500; line-height: 32px; margin: 0 0 16px; }
    p, li { font-size: 15px; line-height: 22px; }
    p { margin: 0 0 14px; }
    .host { font-weight: 700; }
    ul { margin: 6px 0 0; padding-left: 22px; }
    li { margin: 4px 0; }
    .code { margin: 28px 0 0; color: #5f6368; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    button {
      margin-top: 24px;
      border: 0;
      border-radius: 4px;
      background: #1a73e8;
      color: #fff;
      font: inherit;
      font-size: 14px;
      line-height: 20px;
      padding: 8px 16px;
      cursor: pointer;
    }
    button:hover { background: #1967d2; }
    button:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
    @media (max-width: 720px) {
      main { padding: 48px 24px; }
    }
  </style>
</head>
<body>
  <main>
    <svg class="icon" viewBox="0 0 72 72" aria-hidden="true">
      <path fill="#5f6368" d="M18 8h24l14 14v38a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z"/>
      <path fill="#fff" d="M42 8v12a2 2 0 0 0 2 2h12"/>
      <circle cx="36" cy="40" r="10" fill="none" stroke="#fff" stroke-width="2.4"/>
      <path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" d="M36 35.5v6M36 44.2h.1"/>
    </svg>
    <h1>This site can't be reached</h1>
    <p><span class="host" id="host"></span> refused to connect.</p>
    <p>Try:</p>
    <ul>
      <li>Checking the connection</li>
      <li>Checking the proxy and the firewall</li>
    </ul>
    <p class="code">ERR_CONNECTION_REFUSED</p>
    <button type="button" onclick="location.reload()">Reload</button>
  </main>
  <script>
    document.getElementById("host").textContent = location.hostname || "This site";
  </script>
</body>
</html>`;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (SITE_DISABLED) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "this site can't be reached" },
        { status: 503, headers: { "Retry-After": "86400" } },
      );
    }
    return new NextResponse(DISABLED_HTML, {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "Retry-After": "86400",
        "Cache-Control": "no-store",
      },
    });
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(session.role, pathname)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
