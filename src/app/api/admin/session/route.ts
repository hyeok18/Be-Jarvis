import { createSupabaseAdminAuth } from "@/server/admin/admin-auth";
import {
  createAdminSessionDeleteHandler,
  createAdminSessionPostHandler,
} from "@/server/admin/admin-session";

export const dynamic = "force-dynamic";

const adminAuth = createSupabaseAdminAuth(process.env);

export const POST = createAdminSessionPostHandler(adminAuth);
export const DELETE = createAdminSessionDeleteHandler();
