FROM node:24-bookworm-slim AS web
WORKDIR /web
RUN npm install -g pnpm@11.19.0
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY backend/ ./
COPY --from=web /web/dist /app/frontend/dist
RUN useradd --create-home app
USER app
EXPOSE 8000
CMD ["sh", "-c", "python -m alembic upgrade head && if [ \"$DEMO_MODE\" = true ]; then python -m slotguard.cli seed-demo; fi && python -m uvicorn slotguard.app:create_app --factory --host 0.0.0.0 --port 8000"]
