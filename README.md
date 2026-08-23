# 국내 공장 인허가 대시보드

공장 신설·증설·이전·공정변경·업종변경의 사업조건을 입력하면 적용 가능성이 있는 절차를 기관별 스윔레인, 절차 목록, 부분 일정과 공식 법령 근거로 연결하는 의사결정 지원 웹앱입니다.

> 이 저장소의 데이터는 공식 자료를 구조화한 **AI-assisted draft**입니다. 행정기관의 최종 판단이나 법률자문을 대체하지 않으며 실제 신청 전 관할기관과 관계 전문가의 확인이 필요합니다.

## 현재 지원 범위

- 절차 카탈로그: 입지·건축, 환경, 화학, 산업안전, 소방, 전기, 가스, 에너지까지 전국 공통 법령층 90개 이상 인허가·신고·검사 절차
- 지원 지역: 서울·경기·인천을 제외한 전국 비수도권 13개 광역자치단체(2026년 행정구역 기준, 시·군·구 직접 입력)
- 업종 시나리오: 일반 제조업, 반도체·전자, 이차전지·화학공정
- 사용자 확인값 기반 조건부 표시: 개발행위·농지·산지, 환경영향평가·통합환경허가, 대기·수질·소음·폐기물, 화학물질·PSM·위험물·고압가스·소방·전기·에너지
- 검증 시나리오: 프리셋을 고른 뒤 어떤 입력을 바꿔도 선택 시나리오와 변경 조건 수를 유지·표시하고 공유 URL에 복원
- 판정 상태: `적용`, `비적용`, `적용 가능성`, `추가정보 필요`

선택 지역의 ELIS 현행 자치법규는 관련 조례 상세 원문으로 연결합니다. 다만 개별 산업단지 관리기본계획, 조례 별표·연도별 고시, 시설·물질·수량별 세부 임계값과 필지별 입지규제는 원문과 관할기관에서 다시 확인해야 합니다. 전체 목록은 [coverage-and-gaps.md](docs/coverage-and-gaps.md)에 있습니다.

## 외부 공유

- GitHub Pages 정적 미러: <https://rnjswnsgud94.github.io/localinvest-permit-process-roadmap/>
- 실시간 법령 API 검증 포함 운영 사이트: <https://factory-permit-dashboard.rnjswnsgud94.chatgpt.site>

GitHub Pages에서는 대시보드 판정, 입력값 복원, 공유 링크와 공식 법령 원문 링크를 사용할 수 있습니다. 서버 API가 없는 정적 호스팅에서는 검증 저장본이 있는 지역만 ELIS 상세 조례 링크를 표시하고, 그 밖의 지역은 상단 관할명에서 ELIS 현행 목록을 확인합니다. 전 지역 실시간 ELIS 조회와 `API 최신성 확인`은 운영 사이트에서 제공합니다.

## 사용법

1. 좌측 wizard에서 사업유형, 평가일, 지역·산단 여부를 입력합니다.
2. 건축행위와 기존·증가·사업 후 총면적을 구분해 입력합니다.
3. 배출시설·PSM 해당 여부는 시설·물질 기준을 별도로 검토한 결과로 입력합니다. 업종명만으로 자동 확정하지 않습니다.
4. 스윔레인 카드를 선택해 포함·제외 이유, 기관, 제출자료, 의제 관계와 공식 원문을 확인합니다.
5. 일정 탭의 값은 행정 처리기간과 선행관계만 반영한 **부분 일정**입니다. 공사·보완·공휴일·자원 제약은 포함하지 않습니다.

## 로컬 실행

필수 환경은 Node.js `>=22.13.0`입니다.

```bash
npm ci
npm run dev
```

기본 주소는 `http://localhost:5173`입니다. 검증 명령은 다음과 같습니다.

```bash
npm run lint
npm run typecheck
npm test
npm run build:pages
npm run build:next
npm run test:e2e
```

## 환경변수와 보안

`.env.example`을 `.env.local`로 복사하고 값은 로컬 또는 배포 플랫폼의 Secret으로만 설정합니다.

```dotenv
LAW_API_OC=
NEXT_PUBLIC_SITE_URL=
```

`LAW_API_OC`는 국가법령정보 공동활용 Open API용 사용자 식별값입니다. 브라우저 코드, URL, 로그, Git에 넣지 마십시오. 값이 없거나 API가 실패하면 검증된 최소 메타데이터 snapshot으로 안전하게 전환하며, 화면과 API 응답에 그 상태를 표시합니다.

`NEXT_PUBLIC_SITE_URL`에는 배포 후 canonical origin(예: `https://example.vercel.app`)만 넣습니다. 비밀값이 아닙니다.

## 데이터와 판정 구조

- `data/catalog/`: 절차, 선행관계, 판정규칙, 법령·조문, 기간과 coverage
- `data/scenarios/`: 회귀검증용 대표 사업조건
- `data/snapshots/law-api/`: 실시간 API 불가 시 사용하는 검증 snapshot
- `lib/domain/`: Zod 스키마와 사실값 모델
- `lib/engine/`: 선언형 규칙, 4값 판정, DAG·임계경로 계산
- `lib/law-api/`: 서버 전용 API adapter, 캐시·재시도·fallback, 변경영향 탐지
- `app/`: 반응형 dashboard와 API route

상세 구조는 [architecture.md](docs/architecture.md), 필드 정의는 [data-model.md](docs/data-model.md)를 참고하십시오.

## 법령 검증·동기화 절차

1. 국가법령정보센터에서 평가일 현재 시행본과 시행예정본을 분리 조회합니다.
2. 법령 ID·MST·시행일·공포번호·content hash를 문자열로 저장합니다.
3. 변경탐지는 영향 source → citation → rule 목록만 만들며 규칙을 자동 변경하지 않습니다.
4. 조문·예외·위임규정과 관할기관을 사람이 검토하고 테스트를 갱신합니다.
5. 전문가 또는 관계기관 확인 후에만 검증상태를 승격합니다.

현재 snapshot은 `LAW_API_OC` 없이 공식 공개페이지로 확인한 최소 메타데이터입니다. 운영 동기화 방법과 대상별 응답 차이는 [law-api.md](docs/law-api.md), 법률 검토 원칙은 [legal-methodology.md](docs/legal-methodology.md)에 있습니다.

## 배포

Vercel에서는 저장소를 연결하고 `LAW_API_OC`를 서버 환경변수로 설정합니다. `vercel.json`이 `npm run vercel-build`(`next build`)를 사용합니다. 배포 전 lint, typecheck, unit/integration/UI tests와 production build를 통과시켜야 합니다.

## 검증상태

- 카탈로그 버전: `2026.08.21-permits.2`
- 마지막 법령·정부24·ELIS 공개페이지 검토: `2026-08-21`
- 다음 재검토 기준일: `2026-09-11`
- 조례 별표·연도별 고시, 대기·수질 시설별 임계값, 개별 산단 계획과 공급기관 기준은 사람 검토가 남아 있습니다.

문서: [제품 명세](docs/product-spec.md) · [아키텍처](docs/architecture.md) · [데이터 모델](docs/data-model.md) · [법령 방법론](docs/legal-methodology.md) · [API](docs/law-api.md) · [Coverage](docs/coverage-and-gaps.md)
