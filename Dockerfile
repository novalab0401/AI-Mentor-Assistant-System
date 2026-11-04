# Nova Lab 배포 이미지 (Onpod 등 Docker 이미지 + 포트로 띄우는 곳).
# 빌드: docker build -t novalab .
# 실행: docker run -p 3000:3000 -e ADMIN_EMAILS=... -e OPENAI_API_KEY=... -e OPENAI_MODEL=... -v novalab-data:/workspace novalab
#
# 녹화·세션 기록은 /workspace/data에 쌓인다. Onpod는 /workspace만 영구 디스크로 붙이므로 그 아래에 둔다.
# 영구 저장 공간을 /workspace에 붙이지 않으면 재시작할 때 사라진다.
# 비밀 값(.env.local)은 이미지에 넣지 않는다(.dockerignore). 배포 서비스의 환경 변수 설정에 넣는다.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# ffmpeg-static이 설치 중에 리눅스용 ffmpeg를 내려받는다
RUN npm ci
COPY . .
# next.config.ts를 읽으려면 실행 때도 typescript가 필요해서 개발 의존성을 지우지 않는다
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    NOVALAB_DATA_DIR=/workspace/data \
    NEXT_TELEMETRY_DISABLED=1     NOVALAB_DEPLOYED=1
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
RUN mkdir -p /workspace/data && chown -R node:node /workspace /app/.next
EXPOSE 3000
# 붙인 영구 디스크는 소유자가 root일 수 있어서, 시작할 때 root로 저장 폴더를 만들고 node 사용자에게 넘긴 뒤
# 앱은 node 사용자로 실행한다(setpriv). 그래도 쓸 수 없으면 녹화 제출이 전부 실패하므로 바로 알린다.
# 외부 접속을 받으려면 0.0.0.0에 연다. 승인된 계정으로 로그인해야 들어온다(NOVALAB_DEPLOYED=1이면 LOCAL_NO_LOGIN 무시).
CMD ["sh", "-c", "mkdir -p \"$NOVALAB_DATA_DIR\" && chown node:node \"$NOVALAB_DATA_DIR\" 2>/dev/null; exec setpriv --reuid=node --regid=node --init-groups sh -c 'if ! touch \"$NOVALAB_DATA_DIR/.write-test\" 2>/dev/null; then echo \"[novalab] $NOVALAB_DATA_DIR 에 쓸 수 없어요. 저장 공간 권한을 확인하세요.\" >&2; fi; exec node_modules/.bin/next start -H 0.0.0.0 -p $PORT'"]
