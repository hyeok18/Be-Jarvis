import { MobileAppShell } from "@/components/app/mobile-app-shell";
import { getFixtureMapExplorerData } from "@/components/map/map-explorer-fixture";
import { PublicDataUnavailable } from "@/components/public-data/public-data-unavailable";
import { toMapExplorerData } from "@/components/public-data/public-restaurant-ui-adapter";
import { createConfiguredPublicRestaurantDependencies } from "@/server/restaurants/configured-public-restaurants";


export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ cycle?: string; snapshot?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { cycle, snapshot } = await searchParams;
  const snapshotMode = snapshot === "1";
  const cycleMode = snapshotMode && cycle === "1";
  const detailHrefSuffix = cycleMode ? "?snapshot=1&cycle=1" : snapshotMode ? "?snapshot=1" : "";
  let data;

  if (snapshotMode) {
    data = getFixtureMapExplorerData();
  } else {
    try {
      const restaurants = await createConfiguredPublicRestaurantDependencies()
        .repository.list();
      data = toMapExplorerData(restaurants);
    } catch {
      return <PublicDataUnavailable retryHref="/" snapshotHref="/?snapshot=1" />;
    }
  }

  return (
    <MobileAppShell
      {...data}
      detailHrefSuffix={detailHrefSuffix}
      snapshotMode={snapshotMode}
      cycleMode={cycleMode}
    />
  );
}
