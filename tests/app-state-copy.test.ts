import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ErrorPage from "../src/app/error";
import GlobalError from "../src/app/global-error";
import Loading from "../src/app/loading";
import NotFound from "../src/app/not-found";

const forbiddenLegacyTerms = ["랭킹", "평균평점", "종합점수", "리뷰 신뢰도"];

describe("shared app states", () => {
  it("uses the current map product language in loading and error states", () => {
    const loadingMarkup = renderToStaticMarkup(createElement(Loading));
    const notFoundMarkup = renderToStaticMarkup(createElement(NotFound));
    const errorMarkup = renderToStaticMarkup(
      createElement(ErrorPage, {
        error: new Error("synthetic route error"),
        reset: () => undefined,
      }),
    );
    const globalErrorMarkup = renderToStaticMarkup(
      createElement(GlobalError, {
        error: new Error("synthetic global error"),
        reset: () => undefined,
      }),
    );
    const markup = [
      loadingMarkup,
      notFoundMarkup,
      errorMarkup,
      globalErrorMarkup,
    ].join("\n");

    expect(markup).toContain("맛집 지도를 준비하고 있습니다.");
    expect(markup).toContain("맛집 지도 홈으로 돌아가기");
    expect(markup).toContain("화면을 불러오지 못했습니다.");
    expect(markup).toContain("서비스를 표시하지 못했습니다.");
    expect(errorMarkup).toContain("다시 시도");
    expect(globalErrorMarkup).toContain("다시 시도");

    for (const term of forbiddenLegacyTerms) {
      expect(markup).not.toContain(term);
    }
  });
});
