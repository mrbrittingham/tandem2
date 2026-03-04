import { NextResponse, type NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set(["/login", "/api/health"]);

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/)
  );
}

function withResponseCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname) || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const { response, user } = await refreshSupabaseSession(request);
  const isApiRoute = pathname.startsWith("/api");

  if (!user) {
    if (isApiRoute) {
      return withResponseCookies(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        response,
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return withResponseCookies(NextResponse.redirect(loginUrl), response);
  }

  if (pathname === "/login") {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = "/overview";
    targetUrl.search = "";
    return withResponseCookies(NextResponse.redirect(targetUrl), response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
