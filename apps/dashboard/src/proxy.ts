import { NextResponse, type NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set(["/api/health"]);

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

  const { response, user, supabase } = await refreshSupabaseSession(request);
  const isApiRoute = pathname.startsWith("/api");

  if (!user) {
    if (pathname === "/login") {
      return response;
    }

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

  const membershipCheck = await supabase
    .from("business_memberships")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", user.id);

  const hasMembership = !membershipCheck.error && (membershipCheck.count ?? 0) > 0;

  if (!isApiRoute && !hasMembership && pathname !== "/onboarding") {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    onboardingUrl.search = "";
    return withResponseCookies(NextResponse.redirect(onboardingUrl), response);
  }

  if (pathname === "/login") {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = hasMembership ? "/overview" : "/onboarding";
    targetUrl.search = "";
    return withResponseCookies(NextResponse.redirect(targetUrl), response);
  }

  if (!isApiRoute && hasMembership && pathname === "/onboarding") {
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
