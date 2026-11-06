import { handleAdminAuthGet, handleAdminAuthPost } from "@/app/lib/adminAuthApi";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleAdminAuthGet();
}

export async function POST(request) {
  return handleAdminAuthPost(request);
}
