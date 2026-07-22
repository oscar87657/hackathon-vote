# STAGE — 해커톤 발표 평가

발표 공개, 운영자 평가, 참가자 동료 투표, 결과 집계를 한곳에서 처리하는 반응형 웹사이트입니다. Node.js 20 이상에서 실행됩니다.

## 실행

```bash
cd /Users/rain/hackathon-vote
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다.

## Supabase 연결

서버의 데이터와 발표자료를 Supabase에 저장하려면 다음 순서로 설정합니다.

1. Supabase Dashboard의 SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행합니다.
2. `.env.example`을 `.env`로 복사한 뒤 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 입력합니다.
3. `npm start`로 서버를 시작합니다.

```bash
cp .env.example .env
npm run check:supabase
npm start
```

`SUPABASE_SECRET_KEY`는 Supabase Dashboard의 **Settings → API Keys → Secret keys**에서 발급한 `sb_secret_...` 키를 사용합니다. 이 키는 서버 전용이며 브라우저 코드, Git, 로그에 노출하면 안 됩니다. 이전 프로젝트의 legacy `service_role` 키도 `SUPABASE_SERVICE_ROLE_KEY`로 사용할 수 있습니다.

첫 연결 시 Supabase에 상태가 없으면 기존 `data/database.json`과 `data/uploads`의 발표자료를 자동으로 옮깁니다. 로컬 파일은 백업으로 남겨 둡니다. Supabase 환경 변수가 없으면 기존처럼 로컬 JSON과 파일을 사용합니다.

Supabase 1단계 연결은 기존 앱 구조를 유지하기 위해 하나의 JSONB 상태 레코드를 사용합니다. 따라서 운영 중에는 서버 인스턴스를 하나만 실행해야 합니다. 수평 확장이 필요하면 팀·사용자·투표를 각각의 Postgres 테이블로 분리해야 합니다.

## 관리자 계정

관리자 이메일은 `admin@hackathon.kr`입니다. 새 데이터로 처음 실행하거나 이전 데모 버전에서 업그레이드할 때는 `ADMIN_PASSWORD` 환경 변수로 초기 비밀번호를 지정하세요. 지정하지 않으면 서버 콘솔에 한 번만 임시 비밀번호가 표시됩니다. 기존에 직접 변경한 비밀번호는 업그레이드해도 유지되며, 비밀번호는 문서와 로그인 화면에 노출되지 않습니다.

## 주요 규칙

- 참가자는 팀 코드로 가입하며 자기 팀에는 투표할 수 없습니다.
- 운영자가 현재 투표 팀으로 지정한 한 팀에만 투표할 수 있습니다.
- 운영자 화면에서 현재 팀의 투표 완료 인원과 미투표자 이름·소속·이메일을 확인할 수 있습니다.
- 발표 정보가 공개된 팀만 현재 투표 팀으로 지정할 수 있습니다.
- 한 참가자는 팀당 한 번 투표하며, 마감 전에는 수정할 수 있습니다.
- 운영자는 발표 공개, 심사 평가, 투표 시작·마감, 결과 확인이 가능합니다.
- 운영자는 팀 이름과 고유 참가 코드를 입력해 새 팀을 추가할 수 있습니다.
- 운영자는 팀 카드에서 참가 코드를 확인하고 복사할 수 있으며, 모든 사용자는 계정 설정에서 비밀번호를 변경할 수 있습니다.
- 운영자는 다음 공개 발표 팀으로 투표를 자동 전환하거나, 팀과 관련 데이터를 삭제할 수 있습니다.
- 팀마다 PDF, PPT, PPTX, 이미지 발표자료를 최대 5개, 파일당 10MB까지 등록할 수 있습니다.
- 결과는 참가자 60%, 운영자 40%로 합산합니다. 한쪽 평가만 있으면 해당 평가 평균을 표시합니다.
- 비밀번호는 scrypt로 해시되며 로그인 세션 쿠키는 HttpOnly/SameSite로 설정됩니다.
- 로그인한 화면은 5초마다 변경 사항을 확인해 발표 팀 전환과 투표 현황을 자동 반영합니다.

## 데이터와 운영

Supabase가 설정되면 원격 JSONB·Storage를, 설정되지 않으면 `data/database.json`·`data/uploads`를 사용합니다. 실제 행사 전에 관리자 비밀번호와 팀 코드는 반드시 변경하세요.

포트와 데이터 파일은 환경 변수로 바꿀 수 있습니다.

```bash
HOST=0.0.0.0 PORT=8080 DATA_FILE=/safe/path/database.json npm start
```

## 테스트

```bash
npm test
```
