import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { canAccessPath } from "@/lib/roles";

const PUBLIC_PATHS = ["/login", "/api/mobile", "/api/client"];

/** Set false to bring the site back online. */
const SITE_DISABLED = true;

const DISABLED_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>this site can't be reached</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #fff; color: #202124; }
    main { max-width: 28rem; padding: 2rem; }
    h1 { font-size: 1.5rem; font-weight: 500; margin: 0; }
  </style>
</head>
<body>
  <main>
    <h1>this site can't be reached</h1>
  </main>
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
