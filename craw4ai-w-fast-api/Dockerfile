FROM python:3.12-slim

# Install uv.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy the application into the container.
COPY . /app

# Install the application dependencies.
WORKDIR /app
RUN uv sync --frozen --no-cache
# RUN uv sync --frozen

# RUN "/app/.venv/bin/crawl4ai-setup"
# RUN "/app/.venv/bin/python -m playwright install --with-deps"
RUN uv run crawl4ai-setup
RUN uv run playwright install --with-deps
# Run the application.
CMD ["/app/.venv/bin/fastapi", "run", "/app/main.py", "--port", "8000", "--host", "0.0.0.0"]