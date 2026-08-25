import type {
  PublicRestaurantDetailSuccess,
  PublicRestaurantListSuccess,
  PublicRestaurantsError,
} from "../../contracts/public-restaurants";

import type { PublicRestaurantRepository } from "./public-restaurant-repository";

type PublicRestaurantsApiDependencies = {
  repository: PublicRestaurantRepository;
  now?: () => Date;
};

type DetailRouteContext = {
  params: Promise<{ id: string }>;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function successResponse(body: unknown) {
  return Response.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

function errorResponse(
  status: number,
  error: PublicRestaurantsError["error"],
) {
  return Response.json(
    { ok: false, error } satisfies PublicRestaurantsError,
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function unavailableResponse() {
  return errorResponse(503, {
    code: "PUBLIC_DATA_UNAVAILABLE",
    message: "식당 데이터를 잠시 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
    retryable: true,
  });
}

function notFoundResponse() {
  return errorResponse(404, {
    code: "RESTAURANT_NOT_FOUND",
    message: "요청한 식당을 찾을 수 없습니다.",
    retryable: false,
  });
}

export function createPublicRestaurantListGetHandler(
  dependencies: PublicRestaurantsApiDependencies,
) {
  return async function GET() {
    try {
      const restaurants = await dependencies.repository.list();
      const generatedAt = (dependencies.now ?? (() => new Date()))().toISOString();

      return successResponse({
        ok: true,
        data: { restaurants },
        meta: {
          source: "supabase",
          generatedAt,
          restaurantCount: restaurants.length,
        },
      } satisfies PublicRestaurantListSuccess);
    } catch {
      return unavailableResponse();
    }
  };
}

export function createPublicRestaurantDetailGetHandler(
  dependencies: PublicRestaurantsApiDependencies,
) {
  return async function GET(_request: Request, context: DetailRouteContext) {
    const { id } = await context.params;
    if (!uuidPattern.test(id)) return notFoundResponse();

    try {
      const restaurant = await dependencies.repository.getById(id);
      if (!restaurant) return notFoundResponse();
      const generatedAt = (dependencies.now ?? (() => new Date()))().toISOString();

      return successResponse({
        ok: true,
        data: { restaurant },
        meta: {
          source: "supabase",
          generatedAt,
          restaurantCount: 1,
        },
      } satisfies PublicRestaurantDetailSuccess);
    } catch {
      return unavailableResponse();
    }
  };
}

export type { PublicRestaurantsApiDependencies };
