export const DATA_TYPES = [
  { id: "history", label: "방문 기록", note: "방문한 페이지 목록" },
  { id: "downloads", label: "다운로드 기록", note: "파일은 남기고 목록만" },
  { id: "cookies", label: "쿠키와 사이트 로그인", note: "사이트 설정 및 로그인 상태" },
  { id: "cache", label: "캐시", note: "임시 이미지와 파일" },
  { id: "formData", label: "양식 자동완성", note: "입력한 이름, 주소 등" },
  { id: "passwords", label: "저장된 비밀번호", note: "브라우저 정책상 확장프로그램으로는 삭제할 수 없어요", available: false },
  { id: "localStorage", label: "사이트 저장공간", note: "오프라인 데이터와 설정" },
  { id: "indexedDB", label: "IndexedDB", note: "사이트가 저장한 큰 데이터" },
  { id: "serviceWorkers", label: "서비스 워커", note: "백그라운드 사이트 기능" },
  { id: "cacheStorage", label: "Cache Storage", note: "웹앱의 오프라인 캐시" },
  { id: "fileSystems", label: "파일 시스템", note: "사이트가 허용받은 파일 공간" },
  { id: "webSQL", label: "Web SQL", note: "브라우저에서 더 이상 지원하지 않는 저장소", available: false },
  { id: "appcache", label: "앱 캐시", note: "브라우저에서 더 이상 지원하지 않는 저장소", available: false },
  { id: "pluginData", label: "플러그인 데이터", note: "Flash 종료로 더 이상 지원하지 않아요", available: false }
];

export const DEFAULTS = {
  selectedTypes: ["history", "downloads", "cookies", "cache", "formData", "localStorage", "indexedDB", "serviceWorkers", "cacheStorage"],
  timeRange: "all",
  savedSites: [],
  shortcutsEnabled: true,
  autoCleanOnClose: false,
  autoCleanOnInterval: false,
  autoCleanIntervalMinutes: 60,
  theme: "system"
};

export const getSettings = async () => {
  const saved = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...saved };
};

export const dataObject = (selectedTypes) => Object.fromEntries(selectedTypes.filter((type) => DATA_TYPES.find((item) => item.id === type)?.available !== false).map((type) => [type, true]));

export const sinceFor = (timeRange) => {
  const now = Date.now();
  const ranges = { hour: 60 * 60 * 1000, day: 24 * 60 * 60 * 1000, week: 7 * 24 * 60 * 60 * 1000, month: 30 * 24 * 60 * 60 * 1000 };
  return timeRange === "all" ? 0 : now - ranges[timeRange];
};
