import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const MOFA_URL = "https://www.0404.go.kr/bbs/contsPst/MST0000000000113/13/detail";
const PASSPORT_INDEX_URL = "https://www.passportindex.org/passport/south-korea/";
const VERIFIED_AT = new Date("2026-08-24T00:00:00+09:00");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(scriptDir, "../data/generated");

const response = await fetch(MOFA_URL, { headers: { "user-agent": "Mozilla/5.0" } });
if (!response.ok) throw new Error(`외교부 원본 조회 실패: ${response.status}`);
const html = await response.text();

function cleanHtml(value = "") {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function capture(block, className) {
  const match = block.match(new RegExp(`<p class="${className}">(.*?)<\\/p>`, "is"));
  return match ? cleanHtml(match[1]) : "";
}

const regionSpecs = [
  ["tab01", "tab02", "아시아/태평양"],
  ["tab02", "tab03", "미주"],
  ["tab03", "tab04", "유럽"],
  ["tab04", "tab01_01", "아프리카/중동"],
];

const countries = [];
for (const [startId, endId, region] of regionSpecs) {
  const startNeedle = `id="${startId}"`;
  const endNeedle = `id="${endId}"`;
  const start = html.indexOf(startNeedle);
  const end = html.indexOf(endNeedle, start + startNeedle.length);
  if (start < 0 || end < 0) throw new Error(`지역 블록 파싱 실패: ${region}`);
  const segment = html.slice(start, end);
  const blocks = [...segment.matchAll(/<div class="info">(.*?)<\/div><\/li>/gis)];
  for (const match of blocks) {
    const block = match[1];
    const country = capture(block, "value-01");
    const ordinary = capture(block, "value-04");
    if (!country || countries.some((item) => item.country === country)) continue;
    countries.push({
      region,
      country,
      ordinary,
      basis: capture(block, "value-05"),
      note: capture(block, "value-06"),
    });
  }
}

if (!countries.some((item) => item.country === "북한")) {
  countries.push({
    region: "아시아/태평양",
    country: "북한",
    ordinary: "특별 방문 절차",
    basis: "남북교류 관련 별도 승인 대상",
    note: "일반적인 해외 관광 비자와 다른 절차이므로 별도 서비스 범위로 분리",
  });
}

const routeOverrides = {
  "가나": ["전자비자(eVisa)", "", "2026 전자비자 운영 보조자료 기준"],
  "가봉": ["전자비자(eVisa)", "최대 90일", ""],
  "감비아": ["대사관·영사관 사전비자", "", ""],
  "기니": ["전자비자(eVisa)", "최대 90일", ""],
  "기니비사우": ["도착비자", "최대 90일", ""],
  "나미비아": ["전자비자/도착비자", "최대 90일", ""],
  "나우루": ["대사관·영사관 사전비자", "", ""],
  "나이지리아": ["전자비자(eVisa)", "최대 90일", ""],
  "남수단": ["전자비자(eVisa)", "최대 90일", ""],
  "네팔": ["전자비자/도착비자", "", "도착비자 체류기간 선택형"],
  "니제르": ["대사관·영사관 사전비자", "", ""],
  "동티모르": ["도착비자", "최대 30일", ""],
  "레바논": ["도착비자", "최대 30일", "조건부 입국 가능성 확인 필요"],
  "르완다": ["전자비자/도착비자", "최대 30일", ""],
  "리비아": ["전자비자(eVisa)", "", "대한민국 여권 사용 제한 여부 우선 확인"],
  "마다가스카르": ["전자비자/도착비자", "최대 90일", ""],
  "말라위": ["전자비자/도착비자", "최대 30일", ""],
  "말리": ["대사관·영사관 사전비자", "", "대한민국 여권 사용 제한 여부 우선 확인"],
  "모리타니아": ["전자비자(eVisa)", "최대 90일", ""],
  "몰디브": ["도착비자", "최대 30일", ""],
  "미얀마": ["전자비자/도착비자", "최대 30일", "일부 지역 여권 사용 제한 확인"],
  "바레인": ["전자비자/도착비자", "최대 30일", ""],
  "방글라데시": ["도착비자", "최대 30일", "도착비자 거절 가능성 및 현금 수수료 확인"],
  "베냉": ["전자비자(eVisa)", "", ""],
  "볼리비아": ["무사증", "최대 90일", "2025-12-03부터 대한민국 일반여권 무사증 확대"],
  "부룬디": ["전자비자/도착비자", "최대 30일", ""],
  "부르키나파소": ["전자비자(eVisa)", "", ""],
  "부탄": ["전자비자(eVisa)", "", "관광세·여행 운영 조건 별도 확인"],
  "사우디아라비아": ["전자비자/도착비자", "최대 90일", ""],
  "소말리아": ["전자비자(eVisa)", "", "대한민국 여권 사용 제한 여부 우선 확인"],
  "수단": ["대사관·영사관 사전비자", "", "대한민국 여권 사용 제한 여부 우선 확인"],
  "스리랑카": ["전자여행허가(ETA)", "최대 30일", ""],
  "시리아": ["전자비자(eVisa)", "", "대한민국 여권 사용 제한 여부 우선 확인"],
  "시에라리온": ["전자비자/도착비자", "최대 30일", ""],
  "아제르바이잔": ["무사증", "최대 30일", "2026 보조자료상 무사증; 공식 재확인 필요"],
  "아프가니스탄": ["전자비자(eVisa)", "", "대한민국 여권 사용 제한 여부 우선 확인"],
  "알제리": ["대사관·영사관 사전비자", "", ""],
  "에리트레아": ["대사관·영사관 사전비자", "", ""],
  "에티오피아": ["전자비자/도착비자", "최대 90일", ""],
  "예멘": ["대사관·영사관 사전비자", "", "대한민국 여권 사용 제한 여부 우선 확인"],
  "요르단": ["전자비자/도착비자", "최대 30일", ""],
  "우간다": ["전자비자(eVisa)", "", ""],
  "이라크": ["전자비자(eVisa)", "", "대한민국 여권 사용 제한 여부 우선 확인"],
  "이라크 (쿠르드지역)": ["전자비자(eVisa)", "", "대한민국 여권 사용 제한 여부 우선 확인"],
  "이란": ["전자비자(eVisa)", "", ""],
  "이스라엘": ["전자여행허가(ETA)", "최대 90일", "ETA-IL 필요"],
  "이집트": ["전자비자/도착비자", "최대 30일", "시나이 지역 예외 조건 별도 확인"],
  "인도": ["전자비자/도착비자", "최대 30일", "도착비자 대상 조건 공식 확인 필요"],
  "인도네시아": ["전자비자/도착비자", "최대 30일", ""],
  "적도기니": ["전자비자(eVisa)", "", ""],
  "중앙아프리카공화국": ["대사관·영사관 사전비자", "", ""],
  "지부티": ["전자비자/도착비자", "최대 90일", ""],
  "짐바브웨": ["전자비자/도착비자", "최대 90일", ""],
  "차드": ["전자비자(eVisa)", "", ""],
  "카메룬": ["전자비자(eVisa)", "", ""],
  "카보베르데": ["도착비자", "", "EASE 사전등록 가능 여부 확인"],
  "캄보디아": ["전자비자/도착비자", "최대 30일", "일부 지역 여권 사용 제한 확인"],
  "케냐": ["전자여행허가(ETA)", "최대 90일", ""],
  "코모로": ["도착비자", "최대 45일", ""],
  "코트디부아르": ["전자비자(eVisa)", "최대 90일", "사전등록 후 공항 발급 절차 확인"],
  "콩고공화국": ["대사관·영사관 사전비자", "", ""],
  "콩고민주공화국": ["전자비자(eVisa)", "단기 허가", ""],
  "쿠바": ["전자비자(eVisa)", "최대 90일", ""],
  "탄자니아": ["전자비자/도착비자", "", ""],
  "토고": ["전자비자(eVisa)", "", ""],
  "투르크메니스탄": ["대사관·영사관 사전비자", "", ""],
  "파키스탄": ["전자비자(eVisa)", "", ""],
  "파푸아뉴기니": ["전자비자(eVisa)", "최대 60일", "eVisitor 경로"],
  "호주 (오스트레일리아)": ["전자여행허가(ETA)", "최대 90일", "ETA 601"],
  "뉴질랜드": ["전자여행허가(ETA)", "최대 3개월", "NZeTA 필요"],
  "미국": ["전자여행허가(ETA)", "최대 90일", "ESTA 필요"],
  "캐나다": ["전자여행허가(ETA)", "최대 6개월", "항공 입국 시 eTA 필요"],
  "영국": ["전자여행허가(ETA)", "최대 6개월", "UK ETA 필요"],
  "세인트키츠네비스": ["전자여행허가(ETA)", "최대 90일", ""],
  "모잠비크": ["무사증+입국등록", "단기 방문", "2026 무사증 대상 확대; 전자등록 여부 재확인"],
  "말레이시아": ["무사증+입국등록", "최대 90일", "도착 전 입국카드 등록"],
  "싱가포르": ["무사증+입국등록", "최대 90일", "도착 전 입국카드 등록"],
  "태국": ["무사증+입국등록", "", "도착 전 디지털 입국카드 등록"],
  "도미니카공화국": ["무사증+입국등록", "최대 90일", "E-Ticket 등록"],
  "세이셸": ["무사증+입국등록", "", "여행자 등록 필요"],
  "수리남": ["무사증+입국등록", "최대 90일", "관광카드/입국 등록 확인"],
  "오만": ["전자비자/도착비자", "최대 30일", ""],
  "카타르": ["전자비자/도착비자", "최대 30일", ""],
  "쿠웨이트": ["전자비자/도착비자", "최대 90일", ""],
  "북한": ["특별허가/여행제한", "", "남북교류 관련 별도 승인 대상"],
};

const officialVerified = {
  "미국": "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visa-waiver-program.html",
  "영국": "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-eta-national-list",
  "뉴질랜드": "https://www.immigration.govt.nz/visas/new-zealand-electronic-travel-authority-nzeta/",
  "이스라엘": "https://embassies.gov.il/seoul/en/services/foreign-citizens/application-eta-il-approval",
  "중국": "https://www.mofa.go.kr/cn-ko/brd/m_1237/view.do?seq=1348046",
  "볼리비아": "https://www.mofa.go.kr/www/brd/m_4080/view.do?page=1&pitem=102026&seq=376720",
  "몽골": "https://0404.go.kr/ntnSafetyInfo/68/detail",
};

const travelRestrictionCountries = new Map([
  ["아프가니스탄", "여권 사용 제한 대상"],
  ["이라크", "여권 사용 제한 대상"],
  ["이라크 (쿠르드지역)", "여권 사용 제한 대상"],
  ["소말리아", "여권 사용 제한 대상"],
  ["예멘", "여권 사용 제한 대상"],
  ["리비아", "여권 사용 제한 대상"],
  ["우크라이나", "여권 사용 제한 대상"],
  ["수단", "여권 사용 제한 대상"],
  ["아이티공화국", "여권 사용 제한 대상"],
  ["말리", "여권 사용 제한 대상"],
  ["미얀마", "일부 지역 제한"],
  ["캄보디아", "일부 지역 제한"],
  ["니제르", "일부 지역 제한"],
  ["베네수엘라", "일부 지역 제한"],
]);

const travelRestrictionSource = "https://0404.go.kr/files/download/FILE_000000000100940/1";

function defaultRoute(item) {
  if (/도착비자/i.test(item.ordinary)) return "도착비자";
  if (/ETA|전자여행허가/i.test(item.ordinary)) return "전자여행허가(ETA)";
  if (item.ordinary === "X" || item.ordinary === "-") return "공식 재확인 필요";
  return "무사증";
}

function visaNeed(route) {
  if (route === "무사증") return "비자 불필요";
  if (route === "무사증+입국등록") return "비자 불필요·등록 필요";
  if (route === "전자여행허가(ETA)") return "비자는 아니나 사전허가 필요";
  if (route === "도착비자") return "도착 후 비자/허가";
  if (route === "전자비자/도착비자") return "전자 또는 도착비자 필요";
  if (route === "특별허가/여행제한") return "특별허가 필요";
  if (route === "공식 재확인 필요") return "판단 보류";
  return "사전 비자 필요";
}

function preDeparture(route) {
  if (route === "무사증" || route === "도착비자") return "아니오";
  if (route === "전자비자/도착비자") return "선택 가능";
  if (route === "공식 재확인 필요") return "확인 필요";
  return "예";
}

function serviceCoverage(route) {
  if (route === "무사증") return "입국 조건 안내";
  if (route === "도착비자" || route === "전자비자/도착비자") return "준비물·현장 절차 안내";
  if (route === "특별허가/여행제한") return "서비스 제외·공식 안내";
  if (route === "공식 재확인 필요") return "조사 대기";
  return "신청서 작성 보조";
}

function priority(route, status) {
  if (status !== "공식 확인 완료" && ["전자여행허가(ETA)", "전자비자(eVisa)", "대사관·영사관 사전비자", "특별허가/여행제한"].includes(route)) return "P0";
  if (status !== "공식 확인 완료" && route !== "무사증") return "P1";
  return "P2";
}

const rows = countries
  .map((item) => {
    const override = routeOverrides[item.country];
    const route = override?.[0] ?? defaultRoute(item);
    const stay = override?.[1] || (item.ordinary !== "X" ? item.ordinary : "");
    const productNote = [override?.[2], item.note].filter(Boolean).join(" · ");
    const officialUrl = officialVerified[item.country] || "";
    const verificationStatus = officialUrl ? "공식 확인 완료" : (override ? "보조자료 분류·공식 확인 필요" : "외교부 기준·갱신 확인 필요");
    const safety = travelRestrictionCountries.get(item.country) || "일반 확인";
    return {
      ...item,
      route,
      stay,
      productNote,
      officialUrl,
      verificationStatus,
      safety,
      visaNeed: visaNeed(route),
      preDeparture: preDeparture(route),
      serviceCoverage: serviceCoverage(route),
      priority: priority(route, verificationStatus),
    };
  })
  .sort((a, b) => a.region.localeCompare(b.region, "ko") || a.country.localeCompare(b.country, "ko"));

const workbook = Workbook.create();
workbook.comments.setSelf({ displayName: "User" });

const summary = workbook.worksheets.add("요약");
const dataSheet = workbook.worksheets.add("국가 데이터");
const queueSheet = workbook.worksheets.add("검증 큐");
const rulesSheet = workbook.worksheets.add("분류 기준");
const sourcesSheet = workbook.worksheets.add("출처 로그");

const colors = {
  navy: "#14213D",
  blue: "#2563EB",
  sky: "#EAF2FF",
  ink: "#191F28",
  muted: "#6B7684",
  line: "#D9E0EA",
  green: "#16883F",
  greenBg: "#EAF7EF",
  amber: "#B45309",
  amberBg: "#FFF4E5",
  red: "#D92D20",
  redBg: "#FEECEC",
  grayBg: "#F7F8FA",
  white: "#FFFFFF",
};

function styleTitle(sheet, range, title, subtitleRange, subtitle) {
  sheet.mergeCells(range);
  sheet.getRange(range).values = [[title]];
  sheet.getRange(range).format = {
    fill: colors.navy,
    font: { bold: true, color: colors.white, size: 20 },
    verticalAlignment: "center",
    horizontalAlignment: "left",
  };
  sheet.mergeCells(subtitleRange);
  sheet.getRange(subtitleRange).values = [[subtitle]];
  sheet.getRange(subtitleRange).format = {
    fill: colors.sky,
    font: { color: colors.ink, size: 10 },
    wrapText: true,
    verticalAlignment: "center",
  };
}

for (const sheet of [summary, dataSheet, queueSheet, rulesSheet, sourcesSheet]) {
  sheet.showGridLines = false;
}

// 요약
styleTitle(
  summary,
  "A1:H2",
  "대한민국 일반여권 관광 입국 규정 데이터베이스",
  "A3:H3",
  "외교부 전체 목록을 기준으로 2026 보조자료를 대조한 제품용 조사 워크북입니다. '게시 가능' 행만 사용자 화면에 사용할 수 있습니다.",
);
summary.getRange("A1:H2").format.rowHeight = 32;
summary.getRange("A3:H3").format.rowHeight = 34;

const dataStartRow = 5;
const dataEndRow = dataStartRow + rows.length - 1;
const routeColRange = `'국가 데이터'!$F$${dataStartRow}:$F$${dataEndRow}`;
const statusColRange = `'국가 데이터'!$K$${dataStartRow}:$K$${dataEndRow}`;
const publishColRange = `'국가 데이터'!$L$${dataStartRow}:$L$${dataEndRow}`;

summary.getRange("A5:H5").values = [["전체 국가/지역", "", "사전 행동 필요", "", "공식 확인 완료", "", "게시 가능", ""]];
summary.getRange("A6:H7").values = [[null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null]];
summary.mergeCells("A5:B5"); summary.mergeCells("A6:B7");
summary.mergeCells("C5:D5"); summary.mergeCells("C6:D7");
summary.mergeCells("E5:F5"); summary.mergeCells("E6:F7");
summary.mergeCells("G5:H5"); summary.mergeCells("G6:H7");
summary.getRange("A6").formulas = [[`=COUNTA('국가 데이터'!$B$${dataStartRow}:$B$${dataEndRow})`]];
summary.getRange("C6").formulas = [[`=COUNTIF(${routeColRange},"<>무사증")`]];
summary.getRange("E6").formulas = [[`=COUNTIF(${statusColRange},"공식 확인 완료")`]];
summary.getRange("G6").formulas = [[`=COUNTIF(${publishColRange},"게시 가능")`]];
for (const range of ["A5:B7", "C5:D7", "E5:F7", "G5:H7"]) {
  summary.getRange(range).format = { fill: colors.white, borders: { preset: "outside", style: "thin", color: colors.line } };
}
summary.getRange("A5:H5").format = { fill: colors.grayBg, font: { bold: true, color: colors.muted }, horizontalAlignment: "center" };
summary.getRange("A6:H7").format = { font: { bold: true, color: colors.ink, size: 22 }, horizontalAlignment: "center", verticalAlignment: "center" };

const routeCategories = ["무사증", "무사증+입국등록", "전자여행허가(ETA)", "전자비자(eVisa)", "도착비자", "전자비자/도착비자", "대사관·영사관 사전비자", "특별허가/여행제한", "공식 재확인 필요"];
summary.getRange("A10:B10").values = [["신청 경로", "국가 수"]];
summary.getRange(`A11:A${10 + routeCategories.length}`).values = routeCategories.map((value) => [value]);
summary.getRange(`B11:B${10 + routeCategories.length}`).formulas = routeCategories.map((value) => [`=COUNTIF(${routeColRange},A${11 + routeCategories.indexOf(value)})`]);
summary.getRange(`A10:B${10 + routeCategories.length}`).format.borders = { preset: "inside", style: "thin", color: colors.line };
summary.getRange("A10:B10").format = { fill: colors.blue, font: { bold: true, color: colors.white } };
summary.getRange(`B11:B${10 + routeCategories.length}`).format.numberFormat = "0";

const routeChart = summary.charts.add("bar", summary.getRange(`A10:B${10 + routeCategories.length}`));
routeChart.title = "신청 경로별 국가 수";
routeChart.hasLegend = false;
routeChart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 9 } };
routeChart.yAxis = { numberFormatCode: "0" };
routeChart.setPosition("D10", "H27");

summary.mergeCells("A22:H22");
summary.getRange("A22:H22").values = [["운영 원칙"]];
summary.getRange("A22:H22").format = { fill: colors.navy, font: { bold: true, color: colors.white } };
summary.mergeCells("A23:H27");
summary.getRange("A23:H27").values = [[
  "1) '비자 필요'는 무비자/ETA/eVisa/도착비자/사전비자를 분리해 표시합니다.\n2) 외교부 표의 X는 사전비자만 뜻하지 않으므로 그대로 사용자에게 노출하지 않습니다.\n3) 최종 공식 출처와 검증일이 있는 행만 게시합니다.\n4) 출발 전 30일과 7일에 규정 변경을 재확인하도록 안내합니다.\n5) 비자 또는 허가는 입국을 보장하지 않으며 최종 판단은 목적지 입국 당국이 합니다."
]];
summary.getRange("A23:H27").format = { fill: colors.sky, font: { color: colors.ink }, wrapText: true, verticalAlignment: "top" };
summary.getRange("A:H").format.columnWidth = 15;
summary.getRange("A:A").format.columnWidth = 26;
summary.freezePanes.freezeRows(3);

// 국가 데이터
styleTitle(
  dataSheet,
  "A1:R2",
  "국가별 입국 규정 마스터",
  "A3:R3",
  "파란색 입력 열은 조사자가 갱신합니다. 게시 상태와 신선도는 수식으로 계산됩니다. 2025.3 외교부 기준표는 발견용 기준이며, 최종 안내 전 목적지 정부 공식 출처 확인이 필수입니다.",
);
const headers = ["지역", "국가/지역", "외교부 일반여권 기준", "외교부 근거·비고", "사용자 표시", "신청 경로", "출발 전 필수", "최대 체류·조건", "여행안전 확인", "서비스 제공 범위", "검증 상태", "게시 상태", "검증 우선순위", "최종 공식 출처", "보조 출처", "최종 검증일", "데이터 신선도", "제품 메모"];
dataSheet.getRange("A4:R4").values = [headers];
const dataValues = rows.map((row) => [
  row.region,
  row.country,
  row.ordinary,
  [row.basis, row.note].filter(Boolean).join(" · "),
  row.visaNeed,
  row.route,
  row.preDeparture,
  row.stay,
  row.safety,
  row.serviceCoverage,
  row.verificationStatus,
  null,
  row.priority,
  row.officialUrl,
  row.verificationStatus === "공식 확인 완료" ? "" : PASSPORT_INDEX_URL,
  row.verificationStatus === "공식 확인 완료" ? VERIFIED_AT : null,
  null,
  row.productNote,
]);
dataSheet.getRange(`A${dataStartRow}:R${dataEndRow}`).values = dataValues;
dataSheet.getRange(`L${dataStartRow}:L${dataEndRow}`).formulas = rows.map((_, index) => [`=IF(K${dataStartRow + index}="공식 확인 완료","게시 가능","게시 금지")`]);
dataSheet.getRange(`Q${dataStartRow}:Q${dataEndRow}`).formulas = rows.map((_, index) => [`=IF(P${dataStartRow + index}="","미검증",IF(TODAY()-P${dataStartRow + index}<=90,"최신",IF(TODAY()-P${dataStartRow + index}<=180,"갱신 예정","갱신 필요")))`]);
dataSheet.getRange(`P${dataStartRow}:P${dataEndRow}`).format.numberFormat = "yyyy-mm-dd";
dataSheet.getRange("A4:R4").format = { fill: colors.navy, font: { bold: true, color: colors.white }, wrapText: true, horizontalAlignment: "center", verticalAlignment: "center" };
dataSheet.getRange(`A${dataStartRow}:R${dataEndRow}`).format = { font: { color: colors.ink, size: 9 }, verticalAlignment: "top" };
dataSheet.getRange(`D${dataStartRow}:D${dataEndRow}`).format.wrapText = true;
dataSheet.getRange(`H${dataStartRow}:J${dataEndRow}`).format.wrapText = true;
dataSheet.getRange(`N${dataStartRow}:O${dataEndRow}`).format.wrapText = true;
dataSheet.getRange(`R${dataStartRow}:R${dataEndRow}`).format.wrapText = true;
dataSheet.getRange(`F${dataStartRow}:F${dataEndRow}`).format.fill = colors.sky;
dataSheet.getRange(`K${dataStartRow}:K${dataEndRow}`).format.fill = "#FFFBEA";
dataSheet.getRange(`N${dataStartRow}:P${dataEndRow}`).format.fill = "#F2F7FF";
dataSheet.getRange(`L${dataStartRow}:L${dataEndRow}`).conditionalFormats.add("containsText", { text: "게시 가능", format: { fill: colors.greenBg, font: { color: colors.green, bold: true } } });
dataSheet.getRange(`L${dataStartRow}:L${dataEndRow}`).conditionalFormats.add("containsText", { text: "게시 금지", format: { fill: colors.redBg, font: { color: colors.red } } });
dataSheet.getRange(`M${dataStartRow}:M${dataEndRow}`).conditionalFormats.add("containsText", { text: "P0", format: { fill: colors.redBg, font: { color: colors.red, bold: true } } });
dataSheet.getRange(`M${dataStartRow}:M${dataEndRow}`).conditionalFormats.add("containsText", { text: "P1", format: { fill: colors.amberBg, font: { color: colors.amber, bold: true } } });
dataSheet.getRange(`F${dataStartRow}:F${dataEndRow}`).dataValidation = { rule: { type: "list", values: routeCategories } };
dataSheet.getRange(`K${dataStartRow}:K${dataEndRow}`).dataValidation = { rule: { type: "list", values: ["공식 확인 완료", "보조자료 분류·공식 확인 필요", "외교부 기준·갱신 확인 필요"] } };
dataSheet.getRange(`M${dataStartRow}:M${dataEndRow}`).dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2"] } };
dataSheet.freezePanes.freezeRows(4);
dataSheet.freezePanes.freezeColumns(2);
const dataTable = dataSheet.tables.add(`A4:R${dataEndRow}`, true, "CountryDataTable");
dataTable.style = "TableStyleMedium2";
dataTable.showFilterButton = true;
const widths = [14, 20, 18, 34, 24, 23, 13, 18, 20, 23, 24, 13, 12, 42, 36, 14, 14, 36];
widths.forEach((width, index) => { dataSheet.getRangeByIndexes(0, index, dataEndRow, 1).format.columnWidth = width; });
dataSheet.getRange("4:4").format.rowHeight = 34;

// 검증 큐 — 국가 데이터의 행을 수식으로 참조
styleTitle(
  queueSheet,
  "A1:H2",
  "공식 출처 검증 큐",
  "A3:H3",
  "P0 → P1 → P2 순서로 검증합니다. 이 시트는 국가 데이터의 작업 목록을 보여주는 뷰이며 직접 수정하지 않습니다.",
);
const queueHeaders = ["우선순위", "국가/지역", "현재 신청 경로", "출발 전 필수", "검증 상태", "공식 출처", "제품 메모", "마스터 행"];
queueSheet.getRange("A4:H4").values = [queueHeaders];
const queueIndexes = rows
  .map((row, index) => ({ row, sourceRow: dataStartRow + index }))
  .filter(({ row }) => row.priority !== "P2" || row.verificationStatus !== "공식 확인 완료")
  .sort((a, b) => a.row.priority.localeCompare(b.row.priority) || a.row.country.localeCompare(b.row.country, "ko"));
const queueStart = 5;
const queueEnd = queueStart + queueIndexes.length - 1;
queueSheet.getRange(`A${queueStart}:G${queueEnd}`).formulas = queueIndexes.map(({ sourceRow }) => [
  `=IF('국가 데이터'!M${sourceRow}="","",'국가 데이터'!M${sourceRow})`,
  `=IF('국가 데이터'!B${sourceRow}="","",'국가 데이터'!B${sourceRow})`,
  `=IF('국가 데이터'!F${sourceRow}="","",'국가 데이터'!F${sourceRow})`,
  `=IF('국가 데이터'!G${sourceRow}="","",'국가 데이터'!G${sourceRow})`,
  `=IF('국가 데이터'!K${sourceRow}="","",'국가 데이터'!K${sourceRow})`,
  `=IF('국가 데이터'!N${sourceRow}="","",'국가 데이터'!N${sourceRow})`,
  `=IF('국가 데이터'!R${sourceRow}="","",'국가 데이터'!R${sourceRow})`,
]);
queueSheet.getRange(`H${queueStart}:H${queueEnd}`).values = queueIndexes.map(({ sourceRow }) => [`국가 데이터 ${sourceRow}행`]);
queueSheet.getRange("A4:H4").format = { fill: colors.navy, font: { bold: true, color: colors.white }, wrapText: true };
queueSheet.getRange(`A${queueStart}:H${queueEnd}`).format = { font: { size: 9 }, verticalAlignment: "top" };
queueSheet.getRange(`F${queueStart}:G${queueEnd}`).format.wrapText = true;
queueSheet.getRange(`A${queueStart}:A${queueEnd}`).conditionalFormats.add("containsText", { text: "P0", format: { fill: colors.redBg, font: { color: colors.red, bold: true } } });
queueSheet.getRange(`A${queueStart}:A${queueEnd}`).conditionalFormats.add("containsText", { text: "P1", format: { fill: colors.amberBg, font: { color: colors.amber, bold: true } } });
queueSheet.freezePanes.freezeRows(4);
const queueTable = queueSheet.tables.add(`A4:H${queueEnd}`, true, "VerificationQueueTable");
queueTable.style = "TableStyleMedium2";
[12, 20, 24, 14, 26, 42, 42, 15].forEach((width, index) => { queueSheet.getRangeByIndexes(0, index, queueEnd, 1).format.columnWidth = width; });

// 분류 기준
styleTitle(
  rulesSheet,
  "A1:F2",
  "입국 규정 분류 기준",
  "A3:F3",
  "서비스 화면은 '비자 필요/불필요' 두 가지로 단순화하지 않고 실제 행동이 다른 경로를 구분합니다.",
);
rulesSheet.getRange("A5:F5").values = [["신청 경로", "비자 여부", "출발 전 행동", "서비스가 제공할 것", "사용자에게 보여줄 핵심 문구", "출시 조건"]];
const ruleRows = [
  ["무사증", "비자 불필요", "별도 허가 없음", "여권·체류·귀국편 조건", "비자는 필요 없지만 입국 조건을 확인하세요.", "목적지 정부 공식 출처 확인"],
  ["무사증+입국등록", "비자 불필요", "입국카드·등록", "등록 폼 작성 보조", "비자는 없지만 출발 전 등록이 필요합니다.", "공식 등록 사이트와 기한 확인"],
  ["전자여행허가(ETA)", "비자가 아님", "온라인 사전허가", "자격 확인·작성·복사", "비자 대신 전자여행허가가 필요합니다.", "국적·목적·체류기간 공식 확인"],
  ["전자비자(eVisa)", "비자 필요", "온라인 사전신청", "신청서·서류·결제 안내", "출발 전에 전자비자를 받아야 합니다.", "공식 eVisa 도메인 확인"],
  ["도착비자", "비자 필요", "도착 후 발급", "준비물·수수료·공항 조건", "도착 후 비자를 받지만 출발 전 준비가 필요합니다.", "국적·입국항·결제수단 확인"],
  ["전자비자/도착비자", "비자 필요", "둘 중 선택", "경로 비교와 추천 기준", "전자 신청 또는 도착 발급 중 선택할 수 있습니다.", "양 경로의 자격과 비용 확인"],
  ["대사관·영사관 사전비자", "비자 필요", "공관 신청", "서류 체크리스트·예약 안내", "출발 전에 공관 비자를 받아야 합니다.", "관할 공관과 처리기간 확인"],
  ["특별허가/여행제한", "일반 비자와 다름", "공식 허가 우선", "서비스 중단·공식 안내", "일반 신청보다 여행 제한 확인이 우선입니다.", "외교부 여권 사용 제한 확인"],
  ["공식 재확인 필요", "판단 보류", "안내 금지", "조사 큐 등록", "현재 정보만으로 안내할 수 없습니다.", "목적지 정부 공식 확인 완료"],
];
rulesSheet.getRange("A6:F14").values = ruleRows;
rulesSheet.getRange("A5:F5").format = { fill: colors.navy, font: { bold: true, color: colors.white }, wrapText: true };
rulesSheet.getRange("A6:F14").format = { wrapText: true, verticalAlignment: "top", borders: { preset: "inside", style: "thin", color: colors.line } };
rulesSheet.getRange("A17:F17").merge();
rulesSheet.getRange("A17:F17").values = [["국가 한 곳의 필수 정보 묶음"]];
rulesSheet.getRange("A17:F17").format = { fill: colors.blue, font: { bold: true, color: colors.white } };
rulesSheet.getRange("A18:F26").values = [
  ["1", "대상 국적·여권", "대한민국 일반 전자여권", "", "", ""],
  ["2", "방문 목적", "관광·단기 방문", "", "", ""],
  ["3", "신청 경로", "무사증/ETA/eVisa/도착비자/사전비자", "", "", ""],
  ["4", "체류 조건", "최대 체류일·누적 계산·입국 횟수", "", "", ""],
  ["5", "여권 조건", "잔여 유효기간·빈 페이지·전자여권", "", "", ""],
  ["6", "신청 정보", "공식 URL·수수료·처리기간·필요 서류", "", "", ""],
  ["7", "입국 조건", "귀국편·숙소·재정·보험·예방접종", "", "", ""],
  ["8", "예외", "경유·미성년자·이중국적·과거 거절", "", "", ""],
  ["9", "신뢰 정보", "공식 출처·검증일·다음 확인일", "", "", ""],
];
rulesSheet.getRange("A18:F26").format = { wrapText: true, borders: { preset: "inside", style: "thin", color: colors.line } };
rulesSheet.getRange("A:F").format.columnWidth = 24;
rulesSheet.getRange("A:A").format.columnWidth = 25;
rulesSheet.getRange("E:F").format.columnWidth = 32;
rulesSheet.freezePanes.freezeRows(5);

// 출처 로그
styleTitle(
  sourcesSheet,
  "A1:G2",
  "출처 및 검증 로그",
  "A3:G3",
  "1차 출처는 한국 외교부와 목적지 정부입니다. Passport Index는 누락 탐색용 보조자료이며 최종 게시 근거로 사용할 수 없습니다.",
);
sourcesSheet.getRange("A5:G5").values = [["출처", "등급", "적용 범위", "URL", "기준·게시일", "확인일", "사용 규칙"]];
const sourceRows = [
  ["외교부 해외안전여행 무사증 표", "1차·공식", "전체 국가 기준 목록", MOFA_URL, "페이지 표기 2025-03", VERIFIED_AT, "발견용 기준. 목적지 공식 자료와 재검증"],
  ["Passport Index South Korea 2026", "2차·보조", "현재 신청 경로 탐색", PASSPORT_INDEX_URL, "2026", VERIFIED_AT, "분류 후보 생성만 허용. 단독 게시 금지"],
  ["미국 국무부 VWP", "1차·공식", "미국 ESTA", officialVerified["미국"], "현재", VERIFIED_AT, "게시 가능"],
  ["영국 ETA 국적 목록", "1차·공식", "영국 ETA", officialVerified["영국"], "현재", VERIFIED_AT, "게시 가능"],
  ["뉴질랜드 이민청 NZeTA", "1차·공식", "뉴질랜드 NZeTA", officialVerified["뉴질랜드"], "현재", VERIFIED_AT, "게시 가능"],
  ["주한 이스라엘대사관 ETA-IL", "1차·공식", "이스라엘 ETA-IL", officialVerified["이스라엘"], "현재", VERIFIED_AT, "게시 가능"],
  ["주중 대한민국대사관 중국 무사증", "1차·공식", "중국 한시 무사증", officialVerified["중국"], "2026-12-31까지", VERIFIED_AT, "만료 전 재확인"],
  ["외교부 볼리비아 무사증 보도자료", "1차·공식", "볼리비아 무사증", officialVerified["볼리비아"], "2025-12-03 시행", VERIFIED_AT, "체류기간 목적지 공식 재확인"],
  ["외교부 몽골 입국 정보", "1차·공식", "몽골 한시 무사증", officialVerified["몽골"], "2026-12-31까지", VERIFIED_AT, "만료 전 재확인"],
  ["외교부 여권 사용 제한 고시", "1차·공식", "여행금지·일부 제한", travelRestrictionSource, "외교부고시 2026-6호", VERIFIED_AT, "비자 안내보다 먼저 노출"],
];
sourcesSheet.getRange("A6:G15").values = sourceRows;
sourcesSheet.getRange("F6:F15").format.numberFormat = "yyyy-mm-dd";
sourcesSheet.getRange("A5:G5").format = { fill: colors.navy, font: { bold: true, color: colors.white }, wrapText: true };
sourcesSheet.getRange("A6:G15").format = { wrapText: true, verticalAlignment: "top", borders: { preset: "inside", style: "thin", color: colors.line } };
sourcesSheet.getRange("B6:B15").conditionalFormats.add("containsText", { text: "1차", format: { fill: colors.greenBg, font: { color: colors.green, bold: true } } });
sourcesSheet.getRange("B6:B15").conditionalFormats.add("containsText", { text: "2차", format: { fill: colors.amberBg, font: { color: colors.amber } } });
[28, 16, 28, 58, 20, 14, 38].forEach((width, index) => { sourcesSheet.getRangeByIndexes(0, index, 15, 1).format.columnWidth = width; });
sourcesSheet.freezePanes.freezeRows(5);

// 행 높이와 인쇄 가독성
for (const sheet of [dataSheet, queueSheet, rulesSheet, sourcesSheet]) {
  sheet.getRange("1:2").format.rowHeight = 30;
  sheet.getRange("3:3").format.rowHeight = 32;
}

// 검증
const inspectSummary = await workbook.inspect({ kind: "table", range: "요약!A1:H27", include: "values,formulas", tableMaxRows: 30, tableMaxCols: 10 });
console.log(inspectSummary.ndjson);
const inspectData = await workbook.inspect({ kind: "table", range: "국가 데이터!A1:R14", include: "values,formulas", tableMaxRows: 14, tableMaxCols: 18 });
console.log(inspectData.ndjson);
const formulaErrors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(formulaErrors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
for (const [sheetName, range] of [
  ["요약", "A1:H27"],
  ["국가 데이터", "A1:R18"],
  ["검증 큐", "A1:H22"],
  ["분류 기준", "A1:F26"],
  ["출처 로그", "A1:G15"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.2, format: "png" });
  await fs.writeFile(path.join(outputDir, `${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, "VISA_COUNTRY_DATABASE.xlsx"));
console.log(`OUTPUT=${path.join(outputDir, "VISA_COUNTRY_DATABASE.xlsx")}`);
console.log(`COUNTRIES=${rows.length}`);
