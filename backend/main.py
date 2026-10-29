from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timezone
from threading import Lock
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator

from brand_engine import load_brand_kit, review_content

MAX_CONTENT_LENGTH = 10_000
MAX_STORED_REVIEWS = 500

brand_kit = load_brand_kit()

app = FastAPI(
    title="BrandGuard API",
    description="Rule-based content reviews for the Northstar Workspace demo.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReviewRequest(StrictRequest):
    text: str = Field(min_length=1, max_length=MAX_CONTENT_LENGTH)

    @model_validator(mode="after")
    def reject_blank_text(self) -> ReviewRequest:
        if not self.text.strip():
            raise ValueError("Text must contain at least one non-whitespace character.")
        return self


class FindingResponse(BaseModel):
    id: str
    ruleId: str
    category: str
    severity: str
    matchedText: str
    reason: str
    source: str
    suggestion: str
    replacement: str
    start: int
    end: int
    status: Literal["Pending", "Accepted", "Edited", "Dismissed"]


class ReviewResponse(BaseModel):
    reviewId: str
    text: str
    findings: list[FindingResponse]


class DecisionRequest(StrictRequest):
    action: Literal["accept", "edit", "dismiss"]
    replacement: str | None = Field(default=None, max_length=MAX_CONTENT_LENGTH)

    @model_validator(mode="after")
    def validate_replacement(self) -> DecisionRequest:
        if self.replacement is not None and not self.replacement.strip():
            raise ValueError("Replacement must contain non-whitespace text.")
        if self.action == "edit" and self.replacement is None:
            raise ValueError("Replacement is required when action is 'edit'.")
        if self.action == "dismiss" and self.replacement is not None:
            raise ValueError("Replacement cannot be provided when action is 'dismiss'.")
        return self


class DecisionResponse(BaseModel):
    reviewId: str
    findingId: str
    status: Literal["Accepted", "Edited", "Dismissed"]
    replacement: str | None
    text: str


class ReviewSummary(BaseModel):
    reviewId: str
    title: str
    text: str
    issues: int
    pending: int
    status: Literal["In review", "Reviewed"]
    createdAt: datetime
    updatedAt: datetime


class StoredReview:
    def __init__(self, text: str, findings: list[dict[str, object]]) -> None:
        self.text = text
        self.findings = {str(finding["id"]): finding for finding in findings}
        self.decisions: dict[str, tuple[str, str | None]] = {}
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = self.created_at


_reviews: OrderedDict[str, StoredReview] = OrderedDict()
_reviews_lock = Lock()


def _render_review_text(review: StoredReview) -> str:
    edits: list[tuple[int, int, str]] = []
    for finding_id, (action, replacement) in review.decisions.items():
        if action == "dismiss" or replacement is None:
            continue

        finding = review.findings[finding_id]
        start = finding["start"]
        end = finding["end"]
        matched_text = finding["matched_text"]
        if (
            not isinstance(start, int)
            or not isinstance(end, int)
            or not isinstance(matched_text, str)
            or not 0 <= start <= end <= len(review.text)
            or review.text[start:end] != matched_text
        ):
            continue

        if matched_text:
            new_text = replacement
        else:
            new_text = ("\n\n" if review.text.strip() else "") + replacement
        edits.append((start, end, new_text))

    text = review.text
    for start, end, replacement in sorted(edits, reverse=True):
        text = text[:start] + replacement + text[end:]
    return text


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/rules")
def get_rules() -> dict[str, object]:
    return {
        "brandName": brand_kit.get("brand_name", ""),
        "description": brand_kit.get("description", ""),
        "approvedFacts": brand_kit.get("approved_facts", []),
        "requiredDisclaimer": brand_kit.get("required_disclaimer", ""),
        "disclaimerRule": {
            "id": "D-01",
            "category": "Missing disclaimer",
            "severity": "Medium",
            "terms": [brand_kit.get("required_disclaimer", "")],
            "reason": "The draft must include the required brand disclaimer.",
            "source": "Brand Messaging Guide, D-01",
            "suggestion": "Add the required disclaimer to applicable marketing content.",
        },
        "rules": [
            {
                "id": rule["id"],
                "category": rule["category"],
                "severity": rule["severity"],
                "terms": rule.get("terms", []),
                "reason": rule["reason"],
                "source": rule["source"],
                "suggestion": rule["suggestion"],
            }
            for rule in brand_kit.get("rules", [])
        ],
        "heuristics": [
            {
                "id": "C-03",
                "category": "Potential unsupported claim",
                "severity": "High",
                "terms": ["#1", "best", "fastest", "guaranteed"],
                "reason": (
                    "This wording may imply a performance claim that should be "
                    "checked against approved evidence."
                ),
                "source": "Approved Claims Register, C-03",
                "suggestion": (
                    "Verify the claim against approved evidence, or replace it "
                    "with a specific, verifiable benefit."
                ),
            }
        ],
    }


@app.get("/api/reviews", response_model=list[ReviewSummary])
def list_reviews() -> list[ReviewSummary]:
    with _reviews_lock:
        reviews = list(reversed(_reviews.items()))

        return [
            ReviewSummary(
                reviewId=review_id,
                title=next(
                    (
                        line.strip()[:60]
                        for line in review.text.splitlines()
                        if line.strip()
                    ),
                    "Untitled review",
                ),
                text=review.text,
                issues=len(review.findings),
                pending=sum(
                    finding.get("status") == "Pending"
                    for finding in review.findings.values()
                ),
                status=(
                    "In review"
                    if any(
                        finding.get("status") == "Pending"
                        for finding in review.findings.values()
                    )
                    else "Reviewed"
                ),
                createdAt=review.created_at,
                updatedAt=review.updated_at,
            )
            for review_id, review in reviews
        ]


@app.post("/api/review", response_model=ReviewResponse)
def create_review(request: ReviewRequest) -> ReviewResponse:
    findings = review_content(request.text, brand_kit)
    review_id = str(uuid4())

    for finding in findings:
        finding["id"] = (
            f'{finding["rule_id"]}-{finding["start"]}-{finding["end"]}'
        )
        finding["status"] = "Pending"

    stored_review = StoredReview(request.text, findings)
    with _reviews_lock:
        _reviews[review_id] = stored_review
        while len(_reviews) > MAX_STORED_REVIEWS:
            _reviews.popitem(last=False)

    return ReviewResponse(
        reviewId=review_id,
        text=request.text,
        findings=[
            FindingResponse(
                id=str(finding["id"]),
                ruleId=str(finding["rule_id"]),
                category=str(finding["category"]),
                severity=str(finding["severity"]),
                matchedText=str(finding["matched_text"]),
                reason=str(finding["reason"]),
                source=str(finding["source"]),
                suggestion=str(finding["suggestion"]),
                replacement=str(finding.get("replacement_text", "")),
                start=int(finding["start"]),
                end=int(finding["end"]),
                status="Pending",
            )
            for finding in findings
        ],
    )


@app.post(
    "/api/reviews/{review_id}/findings/{finding_id}/decision",
    response_model=DecisionResponse,
)
def decide_finding(
    review_id: str,
    finding_id: str,
    request: DecisionRequest,
) -> DecisionResponse:
    with _reviews_lock:
        review = _reviews.get(review_id)
        if review is None:
            raise HTTPException(status_code=404, detail="Review not found.")

        finding = review.findings.get(finding_id)
        if finding is None:
            raise HTTPException(status_code=404, detail="Finding not found in this review.")

        replacement = request.replacement
        if request.action == "accept" and replacement is None:
            configured_replacement = finding.get("replacement_text", "")
            replacement = configured_replacement if configured_replacement else None
        if replacement is not None:
            replacement = replacement.strip()

        review.decisions[finding_id] = (request.action, replacement)
        status = {
            "accept": "Accepted",
            "edit": "Edited",
            "dismiss": "Dismissed",
        }[request.action]
        finding["status"] = status
        review.updated_at = datetime.now(timezone.utc)
        text = _render_review_text(review)

    return DecisionResponse(
        reviewId=review_id,
        findingId=finding_id,
        status=status,
        replacement=replacement,
        text=text,
    )
