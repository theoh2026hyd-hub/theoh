import { updateSession } from "@/app/lib/supabase/middleware";
import { NextResponse } from "next/server";

export async function middleware(request) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
