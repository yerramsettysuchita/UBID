import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserRole(str, enum.Enum):
    OFFICER = "OFFICER"
    REVIEWER = "REVIEWER"
    SUPERVISOR = "SUPERVISOR"
    ADMIN = "ADMIN"
    AUDITOR = "AUDITOR"


class BusinessStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DORMANT = "DORMANT"
    CLOSED = "CLOSED"
    REVIEW_NEEDED = "REVIEW_NEEDED"


class ResolutionStatus(str, enum.Enum):
    PENDING = "PENDING"
    LINKED = "LINKED"
    IN_REVIEW = "IN_REVIEW"
    UNLINKED = "UNLINKED"


class EventType(str, enum.Enum):
    INSPECTION = "INSPECTION"
    RENEWAL = "RENEWAL"
    FILING = "FILING"
    METER_READ = "METER_READ"
    NOTICE = "NOTICE"
    CLOSURE = "CLOSURE"
    REGISTRATION = "REGISTRATION"
    COMPLAINT = "COMPLAINT"


class ReviewStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"


class ReviewDecision(str, enum.Enum):
    APPROVED_MERGE = "APPROVED_MERGE"
    REJECTED_MERGE = "REJECTED_MERGE"
    ESCALATED = "ESCALATED"
    RESOLVED_MERGE = "RESOLVED_MERGE"
    RESOLVED_SEPARATE = "RESOLVED_SEPARATE"


class ERRunStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class PairDecision(str, enum.Enum):
    AUTO_MATCH = "AUTO_MATCH"
    REVIEW_NEEDED = "REVIEW_NEEDED"
    NON_MATCH = "NON_MATCH"


class ClusterStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    MERGED = "MERGED"
    SPLIT = "SPLIT"
    PENDING = "PENDING"


class PriorityLevel(str, enum.Enum):
    P1 = "P1"   # Critical — 4 h SLA
    P2 = "P2"   # High     — 24 h SLA
    P3 = "P3"   # Normal   — 3 d SLA
    P4 = "P4"   # Low      — 7 d SLA


class ClusterAction(str, enum.Enum):
    CREATED = "CREATED"
    MERGED = "MERGED"
    SPLIT = "SPLIT"
    REFRESHED = "REFRESHED"
    MEMBER_ADDED = "MEMBER_ADDED"
