import { createSupabaseAdminAuth } from "@/server/admin/admin-auth";
import {
  createAdminSessionDeleteHandler,
  createAdminSessionPostHandler,
} from "@/server/admin/admin-session";

export const dynamic = "force-dynamic";

const adminAuth = {
  signInWithPassword(email: string, password: string) {
    return createSupabaseAdminAuth(process.env).signInWithPassword(email, password);
  },
};

export const POST = createAdminSessionPostHandler(adminAuth);
export const DELETE = createAdminSessionDeleteHandler();
