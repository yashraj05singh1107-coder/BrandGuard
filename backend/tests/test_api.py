from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_rules_returns_configured_brand_rules() -> None:
    response = client.get("/api/rules")
    body = response.json()

    assert response.status_code == 200
    assert body["brandName"] == "Northstar Workspace"
    assert body["requiredDisclaimer"] == "Features vary by plan."
    assert {rule["id"] for rule in body["rules"]} >= {"T-01", "T-02", "M-01"}
    assert body["disclaimerRule"]["id"] == "D-01"
    assert body["heuristics"][0]["id"] == "C-03"


def test_review_history_lists_reviews_and_decision_status() -> None:
    review = client.post(
        "/api/review",
        json={"text": "Our revolutionary product. Features vary by plan."},
    ).json()
    initial = client.get("/api/reviews")
    item = next(entry for entry in initial.json() if entry["reviewId"] == review["reviewId"])

    assert initial.status_code == 200
    assert item["title"] == "Our revolutionary product."
    assert item["issues"] == 1
    assert item["pending"] == 1
    assert item["status"] == "In review"

    finding = review["findings"][0]
    decision = client.post(
        f"/api/reviews/{review['reviewId']}/findings/{finding['id']}/decision",
        json={"action": "dismiss"},
    )
    updated = client.get("/api/reviews")
    item = next(entry for entry in updated.json() if entry["reviewId"] == review["reviewId"])

    assert decision.status_code == 200
    assert item["pending"] == 0
    assert item["status"] == "Reviewed"
    assert item["updatedAt"] >= item["createdAt"]


def test_cors_allows_local_next_development_origin() -> None:
    response = client.options(
        "/api/review",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_review_returns_frontend_compatible_findings() -> None:
    response = client.post(
        "/api/review",
        json={"text": "Our revolutionary product helps every customer. Features vary by plan."},
    )
    body = response.json()

    assert response.status_code == 200
    assert body["text"].startswith("Our revolutionary")
    assert body["reviewId"]
    assert {finding["ruleId"] for finding in body["findings"]} == {"T-01", "T-02"}

    banned_term = next(finding for finding in body["findings"] if finding["ruleId"] == "T-01")
    assert banned_term["matchedText"] == "revolutionary"
    assert banned_term["severity"] == "Medium"
    assert banned_term["reason"]
    assert banned_term["source"] == "Brand Voice Guide, T-01"
    assert banned_term["suggestion"]
    assert banned_term["status"] == "Pending"
    assert body["text"][banned_term["start"] : banned_term["end"]] == banned_term["matchedText"]


def test_review_flags_potential_claim_without_asserting_falsehood() -> None:
    response = client.post("/api/review", json={"text": "We are the best."})
    finding = next(
        item for item in response.json()["findings"] if item["ruleId"] == "C-03"
    )

    assert response.status_code == 200
    assert finding["matchedText"] == "best"
    assert "may imply" in finding["reason"]
    assert "Verify" in finding["suggestion"]


def test_review_rejects_missing_blank_and_oversized_text() -> None:
    assert client.post("/api/review", json={}).status_code == 422
    assert client.post("/api/review", json={"text": " \n\t "}).status_code == 422
    assert client.post("/api/review", json={"text": "x" * 10_001}).status_code == 422


def test_review_rejects_unexpected_request_fields() -> None:
    response = client.post("/api/review", json={"text": "Valid text", "extra": True})

    assert response.status_code == 422


def test_accept_edit_and_dismiss_decisions() -> None:
    review_response = client.post(
        "/api/review",
        json={"text": "Our revolutionary product helps every customer."},
    )
    review = review_response.json()
    findings = {finding["ruleId"]: finding for finding in review["findings"]}

    accepted = client.post(
        f"/api/reviews/{review['reviewId']}/findings/{findings['T-01']['id']}/decision",
        json={"action": "accept"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "Accepted"
    assert accepted.json()["text"] == review["text"]

    edited = client.post(
        f"/api/reviews/{review['reviewId']}/findings/{findings['T-02']['id']}/decision",
        json={"action": "edit", "replacement": "team"},
    )
    assert edited.status_code == 200
    assert edited.json()["status"] == "Edited"
    assert "every team." in edited.json()["text"]

    dismissed = client.post(
        f"/api/reviews/{review['reviewId']}/findings/{findings['T-01']['id']}/decision",
        json={"action": "dismiss"},
    )
    assert dismissed.status_code == 200
    assert dismissed.json()["status"] == "Dismissed"
    assert "revolutionary" in dismissed.json()["text"]
    assert "every team." in dismissed.json()["text"]


def test_decision_validation_and_unknown_ids() -> None:
    review = client.post("/api/review", json={"text": "A valid draft."}).json()
    review_id = review["reviewId"]

    assert (
        client.post(
            f"/api/reviews/{review_id}/findings/unknown/decision",
            json={"action": "accept"},
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/reviews/unknown/findings/unknown/decision",
            json={"action": "accept"},
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/reviews/{review_id}/findings/unknown/decision",
            json={"action": "invalid"},
        ).status_code
        == 422
    )
    missing_replacement = client.post(
        f"/api/reviews/{review_id}/findings/unknown/decision",
        json={"action": "edit"},
    )
    assert missing_replacement.status_code == 422
    assert "Replacement is required" in missing_replacement.text
    assert (
        client.post(
            f"/api/reviews/{review_id}/findings/unknown/decision",
            json={"action": "dismiss", "replacement": "not allowed"},
        ).status_code
        == 422
    )
