import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedPaths = [
  "/dashboard",
  "/admin",
  "/teacher",
  "/attendance",
  "/history",
  "/archive",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isAuthReset = pathname.startsWith("/auth/reset");
  const isPending = pathname.startsWith("/pending");
  const isLoggingOut = pathname.startsWith("/auth/logout");

  if (!isProtected && !isAuthReset) {
    return NextResponse.next();
  }

  let response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active,is_approved,role")
    .eq("id", user.id)
    .maybeSingle<{ is_active: boolean; is_approved: boolean; role: string }>();

  if (!profile) {
    return response;
  }

  if (!profile.is_active && !isPending && !isLoggingOut) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/pending";
    return NextResponse.redirect(url);
  }

  if (!profile.is_approved && !isPending && !isLoggingOut) {
    const url = request.nextUrl.clone();
    url.pathname = "/pending";
    return NextResponse.redirect(url);
  }

  if (profile.role !== "admin" && pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/teacher/:path*",
    "/attendance/:path*",
    "/history/:path*",
    "/archive/:path*",
    "/auth/reset/:path*",
  ],
};

