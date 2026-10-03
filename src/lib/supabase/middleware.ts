import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDevBypass, DEV_SESSION_COOKIE, DEV_ADMIN_ID } from "./dev";

const AUTH_ROUTES = ["/login", "/register", "/reset-password"];

function devSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  let supabaseResponse = NextResponse.next({ request });

  const hasSession = Boolean(request.cookies.get(DEV_SESSION_COOKIE)?.value);

  // Auto-login: on any non-auth route, silently sign in as the dev admin so
  // the dashboard is reachable without the login form.
  if (!hasSession && !isAuthRoute) {
    request.cookies.set(DEV_SESSION_COOKIE, DEV_ADMIN_ID);
    supabaseResponse = NextResponse.next({ request });
    supabaseResponse.cookies.set(DEV_SESSION_COOKIE, DEV_ADMIN_ID, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  if (!hasSession && isAuthRoute) {
    return supabaseResponse;
  }

  if (hasSession && isAuthRoute && pathname !== "/reset-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export async function updateSession(request: NextRequest) {
  if (isDevBypass()) {
    // Local dev bypass: no Supabase involved, just check the dev cookie.
    return devSession(request);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // Password recovery / magic links carry a one-time code. Exchange it here
  // so the session cookie is set before the /reset-password page renders.
  const code = request.nextUrl.searchParams.get("code");
  if (!user && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/reset-password";
      url.searchParams.delete("code");
      url.searchParams.set("error", "invalid_link");
      return NextResponse.redirect(url);
    }
  }

  if (!user && !isAuthRoute) {
    // no user, respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute && pathname !== "/reset-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}