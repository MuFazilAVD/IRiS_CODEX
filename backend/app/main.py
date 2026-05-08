from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.errors import IrisAPIError
from app.routers import admin, audit, auth, chatbot, claims, compliance, dashboard, operations, reports, underwriting, worklist
from app.seed import seed_database


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


app = FastAPI(title=settings.app_name, version=settings.version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=None,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(IrisAPIError)
async def iris_api_error_handler(_: Request, exc: IrisAPIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.error, "details": exc.details},
    )


@app.on_event("startup")
def startup() -> None:
    logger.info("Initializing application database")
    logger.info("Configured API prefix: %s", settings.api_v1_prefix)
    logger.info("Configured CORS policy: origins=*, methods=*, headers=*")
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "version": settings.version}


app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(dashboard.router, prefix=settings.api_v1_prefix)
app.include_router(underwriting.router, prefix=settings.api_v1_prefix)
app.include_router(claims.router, prefix=settings.api_v1_prefix)
app.include_router(operations.router, prefix=settings.api_v1_prefix)
app.include_router(compliance.router, prefix=settings.api_v1_prefix)
app.include_router(audit.router, prefix=settings.api_v1_prefix)
app.include_router(reports.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
app.include_router(chatbot.router, prefix=settings.api_v1_prefix)
app.include_router(worklist.router, prefix=settings.api_v1_prefix)
