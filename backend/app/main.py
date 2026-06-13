from fastapi import FastAPI

app = FastAPI(title="AI Resume Align API")


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}
