# UBID Platform — RBAC Design

## Roles

| Role Code | Display Name | Description |
|-----------|-------------|-------------|
| `OFFICER` | Department Officer | Field/desk officer in any department. Lookup-only. |
| `REVIEWER` | Data Reviewer / Steward | Resolves ambiguous entity matches. Can approve/reject merges. |
| `SUPERVISOR` | Supervisor / Commissioner | Senior officer. Full read access + dashboard. Cannot merge/split. |
| `ADMIN` | System Administrator | Manages users, departments, adapters, field mappings. |
| `AUDITOR` | Auditor | Read-only access to all data including audit logs. No write access. |

---

## Screen Access Matrix

| Screen | OFFICER | REVIEWER | SUPERVISOR | ADMIN | AUDITOR |
|--------|---------|----------|------------|-------|---------|
| Login | ✅ | ✅ | ✅ | ✅ | ✅ |
| Business Search | ✅ | ✅ | ✅ | ✅ | ✅ |
| Business Profile (basic) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Business Profile (raw PAN/GSTIN) | ❌ masked | ✅ | ✅ | ✅ | ✅ |
| Linked Records Panel | ✅ | ✅ | ✅ | ✅ | ✅ |
| Activity Timeline | ✅ | ✅ | ✅ | ✅ | ✅ |
| Review Queue | ❌ | ✅ | ✅ read-only | ❌ | ✅ read-only |
| Review Case Detail | ❌ | ✅ | ✅ read-only | ❌ | ✅ read-only |
| Pincode Intelligence | ✅ | ✅ | ✅ | ✅ | ✅ |
| Supervisor Dashboard | ❌ | ❌ | ✅ | ✅ | ✅ read-only |
| Admin: User Management | ❌ | ❌ | ❌ | ✅ | ❌ |
| Admin: Department Config | ❌ | ❌ | ❌ | ✅ | ❌ |
| Admin: Field Mappings | ❌ | ❌ | ❌ | ✅ | ❌ |
| Audit Log Viewer | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## Action Permissions

### Search & Lookup

| Action | OFFICER | REVIEWER | SUPERVISOR | ADMIN | AUDITOR |
|--------|---------|----------|------------|-------|---------|
| Search by name | ✅ | ✅ | ✅ | ✅ | ✅ |
| Search by PAN/GSTIN | ✅ (masked) | ✅ | ✅ | ✅ | ✅ |
| Search by UBID | ✅ | ✅ | ✅ | ✅ | ✅ |
| Search by pincode | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export search results (CSV) | ❌ | ✅ | ✅ | ✅ | ✅ |

### Business Entity Actions

| Action | OFFICER | REVIEWER | SUPERVISOR | ADMIN | AUDITOR |
|--------|---------|----------|------------|-------|---------|
| View business profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| View linked department records | ✅ | ✅ | ✅ | ✅ | ✅ |
| View activity timeline | ✅ | ✅ | ✅ | ✅ | ✅ |
| Add manual note to profile | ❌ | ✅ | ✅ | ✅ | ❌ |
| Request manual review | ✅ | ✅ | ✅ | ❌ | ❌ |
| Split a merged entity | ❌ | ✅ | ❌ | ✅ | ❌ |

### Review Actions

| Action | OFFICER | REVIEWER | SUPERVISOR | ADMIN | AUDITOR |
|--------|---------|----------|------------|-------|---------|
| View review queue | ❌ | ✅ | ✅ | ❌ | ✅ |
| Approve merge | ❌ | ✅ | ❌ | ❌ | ❌ |
| Reject merge | ❌ | ✅ | ❌ | ❌ | ❌ |
| Escalate case | ❌ | ✅ | ✅ | ❌ | ❌ |
| Resolve escalated case | ❌ | ❌ | ✅ | ❌ | ❌ |
| View reviewer decision history | ❌ | ✅ | ✅ | ✅ | ✅ |

### Admin Actions

| Action | OFFICER | REVIEWER | SUPERVISOR | ADMIN | AUDITOR |
|--------|---------|----------|------------|-------|---------|
| Create/deactivate users | ❌ | ❌ | ❌ | ✅ | ❌ |
| Assign roles | ❌ | ❌ | ❌ | ✅ | ❌ |
| Add/configure department | ❌ | ❌ | ❌ | ✅ | ❌ |
| Edit field mappings | ❌ | ❌ | ❌ | ✅ | ❌ |
| Trigger ingestion job | ❌ | ❌ | ❌ | ✅ | ❌ |
| Trigger entity resolution job | ❌ | ❌ | ❌ | ✅ | ❌ |
| View system audit logs | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## Data Visibility Rules

### PAN / GSTIN Masking

| Role | PAN display | GSTIN display |
|------|------------|---------------|
| OFFICER | `AQCPK****K` (last 4 visible) | `29AQCPK****` (prefix visible) |
| REVIEWER | Full clear | Full clear |
| SUPERVISOR | Full clear | Full clear |
| ADMIN | Full clear | Full clear |
| AUDITOR | Full clear | Full clear |

### Department Data Scoping

Officers may be scoped to only see records from their own department (future feature). In prototype, all officers see all departments.

---

## RBAC Implementation Plan

**Backend:**
```python
# FastAPI dependency
def require_role(*roles: str):
    def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return checker

# Usage on route
@router.post("/review/{case_id}/decide")
async def decide(
    case_id: UUID,
    body: ReviewDecisionRequest,
    user: User = Depends(require_role("REVIEWER", "SUPERVISOR"))
):
    ...
```

**Frontend:**
- Role stored in JWT payload and Zustand store after login
- Next.js middleware redirects to `/login` if no valid token
- Component-level guards hide/disable restricted actions
- API returns 403 as secondary enforcement (never rely on frontend-only guards)

---

## Demo User Accounts

| Username | Role | Password |
|----------|------|----------|
| `officer@ubid.demo` | OFFICER | `demo1234` |
| `reviewer@ubid.demo` | REVIEWER | `demo1234` |
| `supervisor@ubid.demo` | SUPERVISOR | `demo1234` |
| `admin@ubid.demo` | ADMIN | `demo1234` |
| `auditor@ubid.demo` | AUDITOR | `demo1234` |
