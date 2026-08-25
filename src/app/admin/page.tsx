import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { creatorAllowlist } from "@/server/youtube/creator-allowlist";

export const metadata: Metadata = {
  title: "크리에이터 근거 관리 | Be Jarvis",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  const allowlist = creatorAllowlist.map((creator) => ({
    handle: creator.handle,
    title: creator.expectedTitle,
    channelUrl: creator.channelUrl,
  }));

  return <AdminDashboard allowlist={allowlist} />;
}
