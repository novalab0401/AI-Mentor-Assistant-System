# Nova Coach

Nova Lab AI 강사 품질 표준화 시스템. 강사가 지도안을 보고, 사이트에서 바로 모의수업을 녹화하고, 공통 루브릭 기준 AI 피드백을 받는다.

## 실행

```bash
npm install        # ffmpeg(음성 추출용)도 함께 내려받는다
cp .env.example .env.local   # OPENAI_API_KEY, OPENAI_MODEL 채우기
npm run dev        # http://localhost:3000
```

원본 문서(`수업 지도안/`)가 바뀌면 데이터를 다시 만든다.

```bash
python scripts/extract_content.py
```

## 테스트

```bash
npm test           # 단위 + 화면·API 테스트 전부
npm run test:unit  # Vitest: 총점 계산, 구간 재생, 파일 형식, 지도안·루브릭 데이터 구조
npm run test:e2e   # Playwright: 녹화 복구·탭 잠금(가짜 카메라), 업로드 제한, 접속 제한, 지도안 화면
```

AI 피드백 품질은 실제 OpenAI API를 불러 따로 평가한다(유료, `npm test`에는 안 들어감).

```bash
npm run eval:ai                                     # .env.local의 모델로
EVAL_MODELS=gpt-4o-mini,gpt-5.4-mini npm run eval:ai  # 여러 모델 비교, 결과는 test-results/eval/
```

평가용 녹취(`tests/eval/fixtures/`)는 지어낸 대본을 음성 합성한 가짜 데이터다. 일부러 넣은 약점(안전 안내 한 마디, 자원자만 발표, 학생 발언 없음)을 AI가 잡아내는지 본다.

화면·API 테스트는 따로 빌드한 서버(3200번)와 `test-data/` 폴더를 써서, 켜 둔 개발 서버와 실제 녹화(`data/`)를 건드리지 않는다. 설치된 Chrome을 쓴다.

## 폴더

| 폴더 | 용도 |
|---|---|
| `src/app/` | 화면과 API (Next.js 16) |
| `src/server/` | 백엔드 로직: 수업 자료 읽기, 녹화 세션 저장 |
| `src/server/analysis/` | AI 분석: 음성 추출(ffmpeg) → 음성 인식(Whisper) → 채점·피드백 → 검토 체크리스트 |
| `content/` | 원본 문서에서 추출한 지도안·루브릭·피드백 기준·제안서 JSON |
| `scripts/` | 원본 문서 추출 스크립트 |
| `tests/` | `unit/`(Vitest), `e2e/`(Playwright), `eval/`(AI 피드백 평가) |
| `수업 지도안/` | 커리큘럼팀 원본 문서 |
| `docs/` | 문서, 디자인 시안(`docs/design`) |
| `data/` | 녹화 영상, 세션 기록, 녹취(`transcripts/`) (git 제외, 강사 얼굴·목소리 포함) |
| `보류/` | 이전 설계와 실험 기록 |

## API

| 경로 | 내용 |
|---|---|
| `GET /api/lessons`, `/api/lessons/:no` | 차시 목록, 차시 지도안 전체 |
| `GET /api/rubric` | 공통 루브릭 13개 |
| `GET /api/feedback-standard` | AI 피드백 원칙 9개, 체크리스트 8개 |
| `GET /api/program` | 교육 운영 제안서 |
| `GET/POST /api/sessions` | 모의수업 녹화 목록, 녹화 업로드 |
| `GET /api/sessions/:id`, `/api/sessions/:id/media` | 세션 정보(분석 상태 포함), 녹화 영상 재생 |
| `POST /api/sessions/:id/analyze` | AI 분석 시작(202). 진행은 세션의 `status`·`analysis.stage`로 본다 |
| `POST /api/signup`, `/api/login`, `/api/logout` | 가입 신청, 로그인, 로그아웃(폼 전송) |
| `POST /api/admin/users/:id` | 운영진의 계정 승인·정지·운영진 지정(`action`) |

## AI 분석

피드백 화면에서 "AI 분석 시작"을 눌러야 시작한다. 녹화 음성이 OpenAI(미국)로 전송되므로 자동으로 보내지 않는다.

1. 음성 추출: 녹화에서 음성만 16kHz 모노 Opus로 뽑아 20분씩 나눈다(Whisper 25MB 제한).
2. 음성 인식: `OPENAI_TRANSCRIBE_MODEL`(기본 whisper-1, 문장별 시각 포함). 무음 구간에서 지어낸 문장은 버린다. 녹취는 `data/transcripts/`에 남겨 다시 시도할 때 재사용한다.
3. 채점: `OPENAI_MODEL`이 지도안 + 공통 루브릭 13개 + 피드백 원칙 9개를 보고 항목별 점수·근거·다음 행동을 쓴다.
4. 검토: 같은 모델이 체크리스트 8개로 초안을 검토하고, 통과 못 한 항목이 있으면 한 번 고쳐 쓴다.
5. 근거 대조(코드): 근거 발언이 실제 녹취에 있는지 확인해 시각을 바로잡고, 없는 인용은 버린다. 확인된 근거가 하나도 없는 점수는 "판단 불가"로 돌린다.

한 번에 하나만 분석한다. 분석 중 서버가 꺼지면 "분석 실패"로 보이고 다시 시도할 수 있다.

## 아직 안 된 것

- AI 분석: 분석을 마친 녹화는 다시 분석할 수 없다. 사람 검토 단계(강사·관리자가 AI 피드백을 확인)도 아직 없다. 피드백 화면의 1~3차시 예시 세션은 가짜 데이터다.
- 저장소: 로컬 `data/` 폴더. 배포할 때 Supabase로 바꾼다.
- 비밀번호 찾기·변경: 아직 없다. 잊으면 운영진이 계정을 정지하고 다시 가입하게 한다.
- 계정 기능 전에 올린 녹화는 주인이 없어 운영진만 볼 수 있다.
- 표준 강의 영상.

## 계정과 배포

- 강사는 `/signup`에서 이름·이메일·비밀번호로 가입 신청하고, 운영진이 **강사 관리**(`/admin/users`)에서 승인해야 로그인할 수 있다.
- 첫 운영진: `ADMIN_EMAILS`(쉼표 구분)에 적은 이메일로 가입하면 바로 운영진이 된다. 이후 운영진은 화면에서 다른 강사를 운영진으로 지정할 수 있다(마지막 운영진은 해제·정지할 수 없음).
- 강사는 본인 녹화·피드백만, 운영진은 모든 강사의 녹화·피드백을 본다. 진도와 홈 화면은 누구든 본인 연습 기록 기준이다.
- 계정은 `data/users.json`(비밀번호는 scrypt 해시), 로그인은 30일 유지되는 서명 쿠키다. 정지하면 바로 못 들어온다.
- 로컬 개발: `.env.local`의 `LOCAL_NO_LOGIN=1`이면 이 컴퓨터에서는 로그인 없이 "로컬 관리자"로 들어온다. 배포 이미지(`NOVALAB_DEPLOYED=1`)에서는 이 설정을 무시한다.
- 배포는 `Dockerfile`로 이미지를 만든다(포트 3000). 녹화·계정은 `/workspace/data`에 저장되므로 영구 저장 공간을 `/workspace`에 붙인다(Onpod는 `--persistent`). 붙이지 않으면 재시작할 때 사라진다.
- Onpod 배포 설정은 `.env.onpod`(git 제외: `ADMIN_EMAILS`, `OPENAI_API_KEY`, `OPENAI_MODEL` 등)에 두고 `onpod deploy --plan standard --env-file .env.onpod`로 올린다. `--env-file`을 빼면 `.env.local`이 넘어가니 주의.
- 개발 서버를 켠 채로 따로 빌드할 때는 `NEXT_DIST_DIR=.next-check npx next build`처럼 빌드 폴더를 바꾼다.

## 녹화 보호 장치

- 녹화 중 조각을 브라우저(IndexedDB)에 임시 저장한다. 화면 이동·새로고침 뒤 돌아오면 이어서 제출할 수 있다.
- 같은 차시는 한 탭에서만 녹화된다(Web Locks).
- 업로드: 녹화 1개 1GB, 전체 보관 한도 20GB(`RECORDINGS_QUOTA_GB`), 디스크 여유 2GB 유지, 동시 업로드 2개, WebM/MP4 파일만 받는다.
