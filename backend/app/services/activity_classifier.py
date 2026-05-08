"""
Activity classification service.

Rules:
  ACTIVE        : most recent event <= 180 days ago
  DORMANT       : 181-730 days
  CLOSED        : > 730 days OR explicit closure event present
  REVIEW_NEEDED : conflicting signals across departments (one says active, another closed)
"""
from datetime import date


def classify_status(
    events: list[dict],
    today: date | None = None,
) -> tuple[str, str]:
    """
    Returns (status, reason_sentence).
    events: list of dicts with keys: event_type, event_date (date), department_code
    """
    if today is None:
        today = date.today()

    if not events:
        return "REVIEW_NEEDED", "No activity signals found. Manual review required."

    has_closure = any(e["event_type"] == "CLOSURE" for e in events)
    if has_closure:
        closure = next(e for e in events if e["event_type"] == "CLOSURE")
        return "CLOSED", f"Explicit closure recorded on {closure['event_date']} ({closure['department_code']})."

    dated_events = [e for e in events if e.get("event_date")]
    if not dated_events:
        return "REVIEW_NEEDED", "Events present but no dates available."

    latest_date = max(e["event_date"] for e in dated_events)
    recency_days = (today - latest_date).days

    dept_signals: dict[str, date] = {}
    for e in dated_events:
        dept = e["department_code"]
        if dept not in dept_signals or e["event_date"] > dept_signals[dept]:
            dept_signals[dept] = e["event_date"]

    active_depts = [d for d, dt in dept_signals.items() if (today - dt).days <= 180]
    dormant_depts = [d for d, dt in dept_signals.items() if (today - dt).days > 180]

    if active_depts and dormant_depts:
        reason = (
            f"Active: {', '.join(active_depts)} (recent events). "
            f"Dormant: {', '.join(dormant_depts)} (no recent events). Review needed."
        )
        return "REVIEW_NEEDED", reason

    latest_event = next(e for e in dated_events if e["event_date"] == latest_date)

    if recency_days <= 180:
        reason = (
            f"Active — {latest_event['event_type'].replace('_',' ').title()} "
            f"{recency_days} days ago ({latest_event['department_code']})."
        )
        return "ACTIVE", reason
    elif recency_days <= 730:
        reason = (
            f"Dormant — last event was {latest_event['event_type'].replace('_',' ').title()} "
            f"{recency_days} days ago ({latest_event['department_code']}). "
            f"No activity in {recency_days // 30} months."
        )
        return "DORMANT", reason
    else:
        reason = (
            f"Closed — last activity was {recency_days} days ago "
            f"({latest_event['department_code']}). No signals in over 2 years."
        )
        return "CLOSED", reason
