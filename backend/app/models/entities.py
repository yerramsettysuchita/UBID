import uuid
from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import (
    BusinessStatus, ClusterAction, ClusterStatus, ERRunStatus, EventType, PairDecision,
    PriorityLevel, ResolutionStatus, ReviewDecision, ReviewStatus, UserRole,
)


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    adapter_type: Mapped[str] = mapped_column(String(20), nullable=False, default="JSON_FILE")
    adapter_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    field_mapping_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    record_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRole] = mapped_column(nullable=False)
    department_code: Mapped[str | None] = mapped_column(String(20), ForeignKey("departments.code"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BusinessEntity(Base):
    __tablename__ = "business_entities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ubid: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    canonical_name: Mapped[str] = mapped_column(String(500), nullable=False)
    canonical_pan: Mapped[str | None] = mapped_column(String(10))
    canonical_gstin: Mapped[str | None] = mapped_column(String(15))
    status: Mapped[BusinessStatus] = mapped_column(nullable=False, default=BusinessStatus.REVIEW_NEEDED)
    status_reason: Mapped[str | None] = mapped_column(Text)
    status_last_updated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confidence_score: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False, default=0.0)
    primary_pincode: Mapped[str | None] = mapped_column(String(6))
    district: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Phase 2 additions
    cluster_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ubid_clusters.id"), nullable=True)
    linked_records_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dept_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    source_records: Mapped[list["SourceRecord"]] = relationship("SourceRecord", back_populates="business_entity")
    events: Mapped[list["BusinessEvent"]] = relationship("BusinessEvent", back_populates="business_entity")


class SourceRecord(Base):
    __tablename__ = "source_records"
    __table_args__ = (UniqueConstraint("department_code", "source_record_id", name="uq_source_dept_record"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("business_entities.id"))
    department_code: Mapped[str] = mapped_column(String(20), ForeignKey("departments.code"), nullable=False)
    source_record_id: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_name: Mapped[str | None] = mapped_column(String(500))
    normalized_name: Mapped[str | None] = mapped_column(String(500))
    registration_number: Mapped[str | None] = mapped_column(String(100))
    registration_date: Mapped[datetime | None] = mapped_column(Date)
    registration_status: Mapped[str | None] = mapped_column(String(50))
    owner_name: Mapped[str | None] = mapped_column(String(300))
    raw_address: Mapped[str | None] = mapped_column(Text)
    normalized_address: Mapped[str | None] = mapped_column(Text)
    pincode: Mapped[str | None] = mapped_column(String(6))
    district: Mapped[str | None] = mapped_column(String(100))
    pan: Mapped[str | None] = mapped_column(String(10))
    gstin: Mapped[str | None] = mapped_column(String(15))
    last_event_date: Mapped[datetime | None] = mapped_column(Date)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    data_hash: Mapped[str | None] = mapped_column(String(64))
    resolution_status: Mapped[ResolutionStatus] = mapped_column(nullable=False, default=ResolutionStatus.PENDING)

    business_entity: Mapped["BusinessEntity | None"] = relationship("BusinessEntity", back_populates="source_records")


class BusinessEvent(Base):
    __tablename__ = "business_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_entities.id"), nullable=False)
    source_record_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("source_records.id"))
    department_code: Mapped[str] = mapped_column(String(20), nullable=False)
    event_type: Mapped[EventType] = mapped_column(nullable=False)
    event_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    event_description: Mapped[str | None] = mapped_column(Text)
    event_outcome: Mapped[str | None] = mapped_column(String(100))
    source_event_id: Mapped[str | None] = mapped_column(String(100))
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    business_entity: Mapped["BusinessEntity"] = relationship("BusinessEntity", back_populates="events")


class ReviewCase(Base):
    __tablename__ = "review_cases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_a_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("source_records.id"), nullable=False)
    record_b_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("source_records.id"), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    name_score: Mapped[float | None] = mapped_column(Numeric(4, 3))
    address_score: Mapped[float | None] = mapped_column(Numeric(4, 3))
    pan_match: Mapped[bool | None] = mapped_column(Boolean)
    gstin_match: Mapped[bool | None] = mapped_column(Boolean)
    status: Mapped[ReviewStatus] = mapped_column(nullable=False, default=ReviewStatus.PENDING)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    # Phase 2 additions
    er_run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("er_runs.id"), nullable=True)
    pair_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    evidence: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Phase 3 additions
    priority_level: Mapped[str] = mapped_column(String(2), nullable=False, default="P3")
    sla_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_reviewer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReviewerDecision(Base):
    __tablename__ = "reviewer_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("review_cases.id"), nullable=False)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    decision: Mapped[ReviewDecision] = mapped_column(nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    resulting_ubid: Mapped[str | None] = mapped_column(String(50))
    confidence_agreement: Mapped[bool | None] = mapped_column(Boolean)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    old_value: Mapped[dict | None] = mapped_column(JSONB)
    new_value: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─── Phase 2: Entity Resolution Models ────────────────────────────────────────

class ERRun(Base):
    __tablename__ = "er_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[ERRunStatus] = mapped_column(nullable=False, default=ERRunStatus.PENDING)
    config_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    config_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Metrics
    total_records: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pairs_generated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    auto_matched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    review_needed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    non_matched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clusters_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ubids_assigned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    review_cases_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ERCandidatePair(Base):
    __tablename__ = "er_candidate_pairs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    er_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("er_runs.id"), nullable=False)
    record_a_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("source_records.id"), nullable=False)
    record_b_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("source_records.id"), nullable=False)
    pair_key: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    name_score: Mapped[float | None] = mapped_column(Numeric(4, 3))
    address_score: Mapped[float | None] = mapped_column(Numeric(4, 3))
    pan_match: Mapped[bool | None] = mapped_column(Boolean)
    gstin_match: Mapped[bool | None] = mapped_column(Boolean)
    pincode_match: Mapped[bool | None] = mapped_column(Boolean)
    decision: Mapped[PairDecision] = mapped_column(nullable=False)
    evidence: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    blocking_key: Mapped[str | None] = mapped_column(String(100))
    review_case_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("review_cases.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UBIDCluster(Base):
    __tablename__ = "ubid_clusters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cluster_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    ubid: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[ClusterStatus] = mapped_column(nullable=False, default=ClusterStatus.PENDING)
    er_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("er_runs.id"), nullable=False)
    canonical_name: Mapped[str | None] = mapped_column(String(500))
    canonical_pan: Mapped[str | None] = mapped_column(String(10))
    canonical_gstin: Mapped[str | None] = mapped_column(String(15))
    primary_pincode: Mapped[str | None] = mapped_column(String(6))
    district: Mapped[str | None] = mapped_column(String(100))
    member_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dept_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    confidence_score: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False, default=0.0)
    business_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("business_entities.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members: Mapped[list["ClusterMember"]] = relationship("ClusterMember", back_populates="cluster")


class ClusterMember(Base):
    __tablename__ = "cluster_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cluster_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ubid_clusters.id"), nullable=False)
    source_record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("source_records.id"), nullable=False)
    er_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("er_runs.id"), nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    cluster: Mapped["UBIDCluster"] = relationship("UBIDCluster", back_populates="members")


# ─── Phase 3: Reviewer Workflow & Cluster Governance Models ───────────────────

class ReviewComment(Base):
    __tablename__ = "review_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("review_cases.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClusterHistory(Base):
    __tablename__ = "cluster_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cluster_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ubid_clusters.id"), nullable=False)
    action: Mapped[ClusterAction] = mapped_column(nullable=False)
    performed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    before_state: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_state: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
