import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function cleanEnv(value: string | undefined): string {
  if (typeof value !== "string") return "";
  let v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { pathname } = request.nextUrl;

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy");

  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/api/version") ||
    /\.[a-zA-Z0-9]+$/.test(pathname);

  if (isPublicAsset) {
    return supabaseResponse;
  }

  const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // Sem env no Vercel o middleware antigo só “passava adiante” → "/" em branco.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (pathname === "/" || (!isAuthRoute && pathname !== "/login")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "missing_env");
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const url = request.nextUrl.clone();
    url.search = "";
    if (redirectTo?.startsWith("/") && !redirectTo.startsWith("//")) {
      url.pathname = redirectTo;
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
