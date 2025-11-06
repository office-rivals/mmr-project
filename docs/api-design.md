# API Design Document

**Version:** 1.0
**Last Updated:** 2025-11-01
**Purpose:** Architectural blueprint for ASP.NET Core APIs with RBAC and multi-tenancy support

---

## Table of Contents

1. [Introduction & Design Principles](#1-introduction--design-principles)
2. [Multi-Tenancy Architecture](#2-multi-tenancy-architecture)
3. [Endpoint Organization Strategy](#3-endpoint-organization-strategy)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [API Endpoint Design Patterns](#5-api-endpoint-design-patterns)
6. [Admin Endpoints](#6-admin-endpoints)
7. [Public/User Endpoints](#7-publicuser-endpoints)
8. [API Versioning Strategy](#8-api-versioning-strategy)
9. [Request/Response Formats](#9-requestresponse-formats)
10. [API Conventions](#10-api-conventions)
11. [Security & Validation](#11-security--validation)

---

## 1. Introduction & Design Principles

### 1.1 Purpose

This document defines the architectural standards and design patterns for HTTP APIs in the MMR Project and serves as a guide for future API development. It focuses on endpoint design, multi-tenancy support, and role-based access control.

### 1.2 Core Design Principles

**Resource-Oriented Design**
- APIs are organized around resources (users, matches, seasons) rather than actions
- Resources are identified by URIs and manipulated using HTTP methods
- Resource representations use JSON for request and response bodies

**RESTful Principles**
- Stateless communication between client and server
- Standard HTTP methods with consistent semantics (GET for retrieval, POST for creation, etc.)
- Proper use of HTTP status codes to indicate outcome
- Hypermedia is not required (pragmatic REST)

**Security First**
- Authentication required by default for all endpoints
- Defense in depth: authorization checks at multiple layers
- Principle of least privilege for role assignments
- Explicit over implicit security decisions

**Consistency and Predictability**
- Uniform URL structure and naming conventions
- Consistent error response formats
- Predictable behavior across similar operations
- Clear API contracts via OpenAPI/Swagger

**Maintainability**
- Clear separation between admin and user operations
- Versioning strategy for breaking changes
- Self-documenting endpoint names
- Explicit rather than clever implementations

### 1.3 Technology Stack

- **Framework:** ASP.NET Core 8+
- **Authentication:** JWT Bearer tokens (Clerk) + Personal Access Tokens
- **Database:** PostgreSQL with Entity Framework Core
- **API Documentation:** OpenAPI 3.0 (Swagger)
- **Serialization:** System.Text.Json

---

## 2. Multi-Tenancy Architecture

### 2.1 Overview

Multi-tenancy enables a single API instance to serve multiple isolated customer organizations (tenants) while maintaining data separation and security boundaries.

### 2.2 Tenancy Model

**Shared Database, Shared Schema with Tenant Discriminator**

- All tenants share the same database and schema
- Every tenant-scoped entity has a `TenantId` column
- Global query filters enforce tenant isolation at the EF Core level
- Chosen for operational simplicity and cost efficiency

**Rationale:**
- Lower infrastructure costs (single database)
- Simpler backup and maintenance
- Good performance for small to medium tenant counts
- Easier development and testing
- Acceptable for B2B SaaS where extreme isolation is not required

**Trade-offs Accepted:**
- Noisy neighbor risk (one tenant's query load affects others)
- Migration complexity (schema changes affect all tenants)
- Cannot offer tenant-specific database regions/compliance

### 2.3 Tenant Identification

**Header-Based Tenant Resolution (Recommended)**

```
X-Tenant-ID: acme-corp
Authorization: Bearer <jwt-token>
```

**Rationale:**
- Works with single domain (no subdomain DNS required)
- Easy to test and debug
- Simple client implementation
- Compatible with mobile apps and SPAs
- Tenant switching doesn't require domain changes

**Alternative Approaches (Not Recommended):**
- **Subdomain-based:** `acme.api.mmr.com` - Requires wildcard SSL, complex DNS, harder mobile support
- **Path-based:** `/api/tenants/acme/users` - Pollutes URLs, harder versioning
- **Token claims:** Tenant in JWT - Inflexible, requires re-authentication to switch tenants

### 2.4 Tenant Context Resolution

**Middleware Pipeline:**
1. Authentication middleware validates JWT/PAT
2. Tenant resolution middleware extracts `X-Tenant-ID` header
3. Validates user has access to specified tenant (via database lookup)
4. Sets `ITenantContext.CurrentTenantId` in scoped service
5. EF Core query filters automatically apply tenant filtering

**User-Tenant Relationship:**
- Users can belong to multiple tenants (many-to-many)
- `UserTenant` join table with role scoping: `{ UserId, TenantId, Role }`
- Roles are tenant-scoped (User is Moderator in Tenant A, User in Tenant B)

### 2.5 Global vs Tenant-Scoped Data

**Tenant-Scoped Entities:**
- Players (user profiles within a tenant)
- Matches, Teams, Seasons
- Statistics and leaderboards
- Queue and active matches

**Global Entities:**
- Users (identity, email, Clerk ID)
- User-Tenant relationships
- Personal Access Tokens
- Audit logs (cross-tenant for super admins)

### 2.6 Tenant Isolation Enforcement

**Database Level:**
```csharp
// Global query filter in DbContext.OnModelCreating
modelBuilder.Entity<Match>()
    .HasQueryFilter(m => m.TenantId == _tenantContext.CurrentTenantId);
```

**Service Level:**
```csharp
// Services inject ITenantContext
public class MatchService : IMatchService
{
    private readonly ITenantContext _tenantContext;

    public async Task<Match> CreateMatchAsync(...)
    {
        var match = new Match
        {
            TenantId = _tenantContext.CurrentTenantId, // Always set
            // ...
        };
    }
}
```

**Controller Level:**
```csharp
// Tenant ID validation for path parameters
[HttpGet("matches/{matchId}")]
public async Task<IActionResult> GetMatch(Guid matchId)
{
    // EF query filter ensures match.TenantId == CurrentTenantId
    var match = await _matchService.GetByIdAsync(matchId);
    // Returns 404 if match doesn't exist or belongs to different tenant
}
```

### 2.7 Super Admin Cross-Tenant Access

**Special Role: PlatformAdmin**
- Can access data across all tenants
- Bypasses tenant query filters (explicit opt-in per query)
- Used for platform monitoring, support, and billing
- Requires explicit `IgnoreQueryFilters()` in LINQ queries

**Endpoint Pattern:**
```
GET /api/v1/platform/tenants
GET /api/v1/platform/tenants/{tenantId}/users
GET /api/v1/platform/tenants/{tenantId}/matches
```

### 2.8 Migration Path from Single to Multi-Tenant

**Phase 1: Database Schema**
- Add `TenantId` column to all entities (nullable initially)
- Create default tenant and assign to all existing data
- Make `TenantId` non-nullable with default constraint

**Phase 2: Application Code**
- Implement `ITenantContext` and resolution middleware
- Add global query filters to DbContext
- Update services to set `TenantId` on entity creation

**Phase 3: API Changes**
- Require `X-Tenant-ID` header on all requests
- Update frontend to send tenant header
- Update Personal Access Tokens to be tenant-scoped

**Phase 4: Testing and Rollout**
- Test with multiple tenants in staging
- Gradual rollout with feature flags
- Monitor for tenant isolation bugs

---

## 3. Endpoint Organization Strategy

### 3.1 The Decision: Admin Prefix vs Shared Endpoints

This is a critical architectural decision that affects security, maintainability, and developer experience.

### 3.2 Approach A: Admin Prefix Pattern

**Structure:**
```
/api/v1/users              - Public user operations (list, search, view profiles)
/api/v1/admin/users        - Admin user operations (create, update, delete, role assignment)

/api/v1/matches            - User match operations (submit, view own matches)
/api/v1/admin/matches      - Admin match operations (edit, delete, recalculate MMR)
```

**Characteristics:**
- Separate endpoint namespaces for admin and regular operations
- Clear visual distinction in URL structure
- Controllers can be organized in `Controllers/Admin/` folder
- Endpoints may operate on the same resources with different capabilities

**Pros:**
1. **Explicit Security Boundary:** Clear separation makes it obvious which endpoints require elevated privileges
2. **Defense in Depth:** Easier to apply middleware (rate limiting, logging, monitoring) specifically to admin routes
3. **API Gateway Configuration:** Can route `/admin/*` to different backends or apply different policies
4. **Discoverability:** Developers immediately know endpoint capabilities from URL
5. **Testing:** Easier to write integration tests with clear context
6. **Performance:** Can optimize admin endpoints differently (e.g., no caching, more detailed responses)
7. **Audit Logging:** Simpler to audit all admin actions by intercepting `/admin/*` routes
8. **Documentation:** Swagger UI can group admin endpoints separately

**Cons:**
1. **Potential Duplication:** Some CRUD operations may be duplicated across admin and user endpoints
2. **More Routes:** Total number of routes increases
3. **Less RESTful:** Breaks pure resource-oriented design (resource has two URLs)

### 3.3 Approach B: Shared Endpoints with Role-Based Behavior

**Structure:**
```
/api/v1/users              - All user operations (behavior varies by role)
  - GET: Lists users (regular users see public profiles, admins see all details)
  - POST: Regular users cannot create, admins can
  - PATCH: Users update own profile, admins update any profile

/api/v1/matches            - All match operations
  - GET: Everyone sees matches (different filters by role)
  - DELETE: Only admins can delete
```

**Characteristics:**
- Single endpoint per resource
- Authorization logic inside controller/service determines capabilities
- Same URL serves different responses based on caller's role

**Pros:**
1. **Pure REST:** True resource-oriented design (one resource = one URL)
2. **Fewer Routes:** Smaller routing table
3. **Single Source of Truth:** One controller method handles both admin and user logic

**Cons:**
1. **Hidden Complexity:** URL doesn't reveal capabilities, must check documentation or code
2. **Complex Authorization:** Each method needs intricate role-checking logic
3. **Security Risk:** Easy to accidentally expose admin functionality or data
4. **Harder Testing:** Test cases must cover all role permutations for each endpoint
5. **Difficult Rate Limiting:** Cannot easily apply different limits to admin vs user operations
6. **Confusing 403s:** Users hit endpoints that exist but return Forbidden (poor UX)
7. **Performance:** Cannot optimize separately for admin (e.g., admins always bypass cache)
8. **Audit Trail:** Harder to identify admin actions without inspecting request body/claims

### 3.4 Recommended Approach: Admin Prefix Pattern

**Decision: Use `/api/v{version}/admin/*` prefix for all administrative operations.**

**Justification:**

**Security Trumps Purity**
- Security is paramount in API design. The admin prefix provides an explicit, visual security boundary that is hard to misunderstand or accidentally bypass.
- Defense in depth: authorization at routing level, middleware level, and controller level.

**Operational Benefits**
- Easy to monitor and alert on admin operations (all under `/admin/*`)
- Simple to apply stricter rate limits, logging, or WAF rules to admin routes
- Clear audit trail without complex filtering

**Developer Experience**
- New developers immediately understand endpoint capabilities from URL
- Easier code review: admin logic is in admin controllers
- Less cognitive load: no need to track role-based branching in shared methods

**Evolution and Multi-Tenancy**
- Admin prefix cleanly separates tenant-scoped admin (`/api/v1/admin/users`) from platform admin (`/api/v1/platform/tenants`)
- Future requirement: different authentication for admin panel (e.g., MFA required) is trivial to enforce

**Acceptable Trade-offs**
- Slight endpoint duplication is worth the clarity and security benefits
- Not strictly RESTful, but pragmatic REST prioritizes usability and security

### 3.5 Implementation Guidelines

**When to Use Admin Prefix:**
- Creating entities that users cannot create (e.g., seasons)
- Updating entities users don't own
- Deleting any entity
- Assigning roles or permissions
- Bulk operations
- System operations (recalculate MMR, data imports)
- Viewing sensitive data (audit logs, full user details)

**When to Use Regular Prefix:**
- Public data access (leaderboards, public profiles)
- User self-service operations (update own profile, view own matches)
- Standard CRUD where user owns the resource
- Matchmaking and game actions (join queue, submit match)

**Example Resource Splits:**

**Users:**
- `GET /api/v1/users` - Search public user profiles
- `GET /api/v1/users/{id}` - View public profile
- `GET /api/v1/users/me` - View own full profile
- `PATCH /api/v1/users/me` - Update own profile
- `GET /api/v1/admin/users` - List all users with sensitive data
- `POST /api/v1/admin/users` - Create user
- `PATCH /api/v1/admin/users/{id}` - Update any user
- `DELETE /api/v1/admin/users/{id}` - Soft delete user
- `POST /api/v1/admin/users/{id}/roles` - Assign role

**Matches:**
- `GET /api/v1/matches` - View public match history
- `POST /api/v1/matches` - Submit match result
- `GET /api/v1/admin/matches` - View all matches with admin filters
- `PATCH /api/v1/admin/matches/{id}` - Edit match details
- `DELETE /api/v1/admin/matches/{id}` - Delete match
- `POST /api/v1/admin/matches/{id}/recalculate` - Recalculate MMR

---

## 4. Authentication & Authorization

### 4.1 Authentication Schemes

**Multi-Scheme Authentication**

The API supports two authentication schemes with automatic selection based on token format:

**1. JWT Bearer (Primary)**
- **Provider:** Clerk (or similar OAuth/OIDC provider)
- **Token Format:** `Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Use Case:** Frontend web/mobile applications, user-facing operations
- **Claims:** `sub` (user ID), `email`, `name`, custom claims
- **Validation:** Issuer signature verification, expiration check, audience validation

**2. Personal Access Token (PAT)**
- **Token Format:** `Authorization: Bearer pat_<random-string>`
- **Use Case:** API integrations, automated scripts, external services
- **Storage:** SHA256 hash in database (never plaintext)
- **Expiration:** Optional expiration date, last-used tracking
- **Scoping:** Tenant-scoped, role-based (can be User, Moderator, or Owner PAT)
- **Validation:** Hash comparison, expiration check, tenant validation

**Token Selection Logic:**
- If header starts with `Bearer pat_` → PAT authentication
- Otherwise → JWT authentication
- Implemented via `AuthenticationSchemeSelector` policy

### 4.2 Role Hierarchy

**Three-Tier Role Model:**

```
Owner (2)
  ├─ All Moderator permissions
  ├─ Assign/revoke roles
  ├─ Update user profiles
  └─ Delete tenant data

Moderator (1)
  ├─ All User permissions
  ├─ View admin panel
  ├─ Manage matches (edit, delete, recalculate)
  ├─ Manage seasons
  └─ View audit logs

User (0)
  ├─ View public data
  ├─ Update own profile
  ├─ Submit matches
  └─ Join matchmaking queue
```

**Role Scoping:**
- **Single-Tenant:** Roles are global per user
- **Multi-Tenant:** Roles are scoped per tenant (user can be Owner in Tenant A, User in Tenant B)
- Stored in `UserTenant.Role` column

**Special Roles:**
- **PlatformAdmin:** Super admin role for cross-tenant operations (future)
- Not exposed in regular API, only in platform admin endpoints

### 4.3 Authorization Policies

**Policy-Based Authorization (Recommended over Role-Based)**

Define policies in `Program.cs`:
```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireOwnerRole", policy =>
        policy.RequireRole("Owner"));

    options.AddPolicy("RequireModeratorRole", policy =>
        policy.RequireAssertion(context =>
            context.User.IsInRole("Owner") || context.User.IsInRole("Moderator")));

    options.AddPolicy("RequireUserRole", policy =>
        policy.RequireAuthenticatedUser());
});
```

**Policy Application:**
```csharp
[Authorize(Policy = "RequireOwnerRole")]
[HttpPost("admin/users/{userId}/roles")]
public async Task<IActionResult> AssignRole(...)

[Authorize(Policy = "RequireModeratorRole")]
[HttpGet("admin/matches")]
public async Task<IActionResult> ListMatches(...)
```

**Why Policies over [Authorize(Roles = "Owner")]:**
- Centralized permission logic
- Easier to change role hierarchy
- Can combine multiple requirements (role + tenant + custom logic)
- Better testability

### 4.4 Claims Structure

**JWT Claims (from Clerk):**
```json
{
  "sub": "user_2abc123xyz",
  "email": "user@example.com",
  "email_verified": true,
  "iss": "https://clerk.mmr.com",
  "iat": 1698765432,
  "exp": 1698769032
}
```

**Custom Claims (added by ClaimsTransformation):**
```json
{
  "player_id": "550e8400-e29b-41d4-a716-446655440000",
  "player_role": "Moderator",
  "tenant_id": "acme-corp"
}
```

**Claims Transformation Process:**
1. JWT authentication completes successfully
2. `IClaimsTransformation` implementation executes
3. Queries database to find Player by `IdentityUserId` (Clerk ID)
4. Adds `player_id`, `player_role`, `tenant_id` claims
5. Claims cached for 5 minutes (in-memory cache keyed by user ID)
6. Cache invalidated on role assignment or tenant changes

### 4.5 User Context Resolution

**Interface: `IUserContextResolver`**

Scoped service providing access to current user's context:

```csharp
public interface IUserContextResolver
{
    string GetIdentityUserId();     // Clerk user ID
    string GetEmail();              // User email
    Guid GetPlayerId();             // Internal player ID
    PlayerRole GetRole();           // Current role
    bool HasRole(PlayerRole role);  // Check role hierarchy (>= comparison)
    bool IsPatAuthentication();     // True if using PAT auth
    string GetTenantId();           // Current tenant ID (multi-tenant)
}
```

**Usage in Services:**
```csharp
public class MatchService : IMatchService
{
    private readonly IUserContextResolver _userContext;

    public async Task<Match> SubmitMatchAsync(...)
    {
        var playerId = _userContext.GetPlayerId();
        // Use in business logic
    }
}
```

**Authorization in Services (Defense in Depth):**
```csharp
public async Task DeleteMatchAsync(Guid matchId)
{
    if (!_userContext.HasRole(PlayerRole.Moderator))
        throw new ForbiddenException("Only moderators can delete matches");

    // Delete logic
}
```

### 4.6 Authorization Strategy

**Multi-Layer Authorization (Defense in Depth):**

1. **Routing Layer:** Global `RequireAuthorization()` - all endpoints require auth by default
2. **Controller/Action Layer:** `[Authorize(Policy = "...")]` attributes
3. **Service Layer:** Explicit role checks for critical operations
4. **Data Layer:** EF query filters (tenant isolation, soft deletes)

**Example Flow:**
```
Request → Authentication Middleware (validates token)
       → Claims Transformation (adds role claims)
       → Tenant Resolution (validates tenant access)
       → Authorization Middleware (checks policy)
       → Controller (action executes)
       → Service (additional business rule checks)
       → DbContext (query filters apply)
```

---

## 5. API Endpoint Design Patterns

### 5.1 URL Structure

**Standard Format:**
```
https://api.mmr.com/api/v{version}/{prefix?}/{resource}/{identifier?}/{action?}
```

**Components:**
- `v{version}`: API version (v1, v2, etc.)
- `{prefix}`: Optional prefix (`admin`, `platform`)
- `{resource}`: Resource name in plural form (`users`, `matches`, `seasons`)
- `{identifier}`: Resource ID (UUID or slug)
- `{action}`: Optional sub-resource or action (`roles`, `recalculate`)

**Examples:**
```
GET    /api/v1/users
GET    /api/v1/users/550e8400-e29b-41d4-a716-446655440000
PATCH  /api/v1/users/me
GET    /api/v1/admin/users
POST   /api/v1/admin/users/550e8400-e29b-41d4-a716-446655440000/roles
POST   /api/v1/admin/matches/abc123/recalculate
GET    /api/v1/platform/tenants
```

### 5.2 Resource Naming Conventions

**Pluralization:**
- Use plural nouns for collections: `/users`, `/matches`, `/seasons`
- Exception: Singleton resources like `/me` for current user

**Kebab-Case for Multi-Word Resources:**
- `/personal-access-tokens` (preferred)
- Avoid: `/personalAccessTokens`, `/PersonalAccessTokens`

**Avoid Verbs in URLs:**
- ❌ `/api/v1/createUser`
- ✅ `POST /api/v1/users`
- Exception: Non-CRUD actions that don't fit REST model (e.g., `/recalculate`)

**Nested Resources (Use Sparingly):**
- ✅ `/api/v1/users/{userId}/roles` - Roles belong to user
- ❌ `/api/v1/users/{userId}/matches` - Matches don't belong to user; use query param instead: `/api/v1/matches?userId={userId}`
- Rule: Only nest if child cannot exist without parent

### 5.3 HTTP Method Semantics

**GET - Retrieve Resource(s)**
- **Idempotent:** Multiple identical requests have same effect
- **Safe:** No side effects, no state changes
- **Cacheable:** Responses can be cached
- **Use For:** Fetching data, listing resources, searching

**POST - Create Resource or Non-Idempotent Actions**
- **Not Idempotent:** Multiple requests create multiple resources
- **Use For:** Creating new resources, actions with side effects (e.g., recalculate)
- **Return:** `201 Created` with `Location` header for new resources

**PUT - Replace Entire Resource**
- **Idempotent:** Multiple identical requests have same effect
- **Use For:** Full resource replacement (rarely used in practice)
- **Requires:** Sending complete resource representation

**PATCH - Partial Update**
- **Idempotent:** Multiple identical requests have same effect (if designed correctly)
- **Use For:** Updating specific fields without sending entire resource
- **Preferred:** Use PATCH over PUT for updates

**DELETE - Remove Resource**
- **Idempotent:** Multiple identical requests have same effect (deleting already deleted resource returns same result)
- **Use For:** Soft deletes (set `DeletedAt`) or hard deletes
- **Return:** `204 No Content` or `200 OK` with deleted resource representation

### 5.4 Query Parameters

**Pagination:**
```
GET /api/v1/users?offset=0&limit=20
```
- `offset`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 20, max: 100)
- Return total count in response for UI pagination

**Filtering:**
```
GET /api/v1/matches?seasonId=abc123&winner=true
GET /api/v1/users?search=john
```
- Use resource field names as filter parameters
- `search`: Full-text search across multiple fields
- Support common operators: `createdAfter`, `createdBefore` for dates

**Sorting:**
```
GET /api/v1/users?sortBy=mmr&sortOrder=desc
```
- `sortBy`: Field name to sort by (default: `createdAt`)
- `sortOrder`: `asc` or `desc` (default: `asc`)

**Field Selection (Sparse Fieldsets):**
```
GET /api/v1/users?fields=id,name,mmr
```
- Return only specified fields (performance optimization)
- Optional feature, implement for expensive resources

### 5.5 Path Parameters

**Resource Identifiers:**
```
GET /api/v1/users/{userId}
```
- Always use UUIDs for resource IDs (GUIDs in .NET)
- Avoid sequential integers (security risk, information leak)
- Use URL-safe formats (no encoding needed)

**Special Identifiers:**
- `me`: Current authenticated user (`/api/v1/users/me`)
- Slugs for public-facing resources (e.g., season names)

### 5.6 Request Body Patterns

**Create Requests:**
```json
POST /api/v1/admin/users
{
  "email": "user@example.com",
  "name": "John Doe",
  "role": "User"
}
```
- Include only fields needed for creation
- Omit server-generated fields (ID, timestamps)

**Update Requests (PATCH):**
```json
PATCH /api/v1/admin/users/{userId}
{
  "name": "Jane Doe"
}
```
- Include only fields being updated (partial update)
- Null values may mean "set to null" or "no change" (document clearly)
- Prefer explicit `null` handling: omit field = no change, `null` value = clear field

**Bulk Operations:**
```json
POST /api/v1/admin/matches/bulk-delete
{
  "matchIds": ["id1", "id2", "id3"]
}
```
- Use POST for bulk operations (not DELETE with body)
- Return summary of operation (success count, failures)

### 5.7 Response Patterns

**Single Resource:**
```json
GET /api/v1/users/{userId}
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "John Doe",
  "mmr": 1500,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Collection (Paginated):**
```json
GET /api/v1/users?offset=0&limit=20
{
  "data": [
    { "id": "...", "email": "...", "name": "..." },
    { "id": "...", "email": "...", "name": "..." }
  ],
  "pagination": {
    "offset": 0,
    "limit": 20,
    "total": 150
  }
}
```

**Creation Success:**
```json
POST /api/v1/admin/users
Response: 201 Created
Location: /api/v1/admin/users/550e8400-e29b-41d4-a716-446655440000
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Update Success:**
```json
PATCH /api/v1/admin/users/{userId}
Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Jane Doe",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

**Delete Success:**
```
DELETE /api/v1/admin/users/{userId}
Response: 204 No Content
```

---

## 6. Admin Endpoints

### 6.1 Admin Endpoint Principles

**All admin endpoints:**
- Require Moderator or Owner role (specified per endpoint below)
- Use `/api/v1/admin/*` prefix
- Include comprehensive audit logging
- Return detailed error messages (safe since authenticated admin)
- May bypass certain business rules (with explicit override flags)

### 6.2 User Management Endpoints

**List All Users**
```
GET /api/v1/admin/users
Authorization: Moderator+
Query Parameters:
  - offset (int): Pagination offset (default: 0)
  - limit (int): Page size (default: 20, max: 100)
  - search (string): Search by name or email
  - role (enum): Filter by role (User, Moderator, Owner)
  - sortBy (string): Field to sort by (name, email, mmr, createdAt)
  - sortOrder (string): asc or desc
  - includeDeleted (bool): Include soft-deleted users (default: false)

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "identityUserId": "user_clerk123",
      "email": "user@example.com",
      "name": "John Doe",
      "mmr": 1500,
      "role": "User",
      "createdAt": "2024-01-15T10:30:00Z",
      "deletedAt": null
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "total": 150 }
}
```

**Get User Details**
```
GET /api/v1/admin/users/{userId}
Authorization: Moderator+

Response: 200 OK
{
  "id": "uuid",
  "identityUserId": "user_clerk123",
  "email": "user@example.com",
  "name": "John Doe",
  "mmr": 1500,
  "sigma": 250,
  "role": "Moderator",
  "roleAssignedBy": "uuid-of-owner",
  "roleAssignedAt": "2024-01-10T09:00:00Z",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-20T14:30:00Z",
  "deletedAt": null,
  "stats": {
    "totalMatches": 45,
    "wins": 28,
    "losses": 17,
    "winRate": 0.622
  }
}

Errors:
  - 404 Not Found: User does not exist
```

**Create User**
```
POST /api/v1/admin/users
Authorization: Owner
Content-Type: application/json

Request Body:
{
  "email": "newuser@example.com",
  "name": "Jane Doe",
  "identityUserId": "user_clerk456",  // Optional: link to existing Clerk user
  "role": "User"                       // Optional: default is User
}

Response: 201 Created
Location: /api/v1/admin/users/{userId}
{
  "id": "uuid",
  "email": "newuser@example.com",
  "name": "Jane Doe",
  "role": "User",
  "createdAt": "2024-01-21T10:00:00Z"
}

Errors:
  - 400 Bad Request: Invalid data (e.g., duplicate email)
  - 403 Forbidden: Insufficient permissions
```

**Update User**
```
PATCH /api/v1/admin/users/{userId}
Authorization: Owner
Content-Type: application/json

Request Body: (all fields optional)
{
  "name": "Jane Smith",
  "email": "jane.smith@example.com",
  "mmr": 1600,        // Manual MMR override (use with caution)
  "sigma": 200
}

Response: 200 OK
{
  "id": "uuid",
  "name": "Jane Smith",
  "email": "jane.smith@example.com",
  "mmr": 1600,
  "updatedAt": "2024-01-21T11:00:00Z"
}

Errors:
  - 404 Not Found: User does not exist
  - 400 Bad Request: Invalid data
  - 403 Forbidden: Insufficient permissions
```

**Delete User (Soft Delete)**
```
DELETE /api/v1/admin/users/{userId}
Authorization: Owner

Response: 204 No Content

Errors:
  - 404 Not Found: User does not exist or already deleted
  - 403 Forbidden: Insufficient permissions
  - 409 Conflict: User has active matches in queue
```

**Assign Role**
```
POST /api/v1/admin/users/{userId}/roles
Authorization: Owner
Content-Type: application/json

Request Body:
{
  "role": "Moderator"  // User, Moderator, or Owner
}

Response: 200 OK
{
  "userId": "uuid",
  "role": "Moderator",
  "roleAssignedBy": "uuid-of-current-owner",
  "roleAssignedAt": "2024-01-21T12:00:00Z"
}

Audit Log: Role assignment logged with full context

Errors:
  - 404 Not Found: User does not exist
  - 403 Forbidden: Only Owners can assign roles
  - 400 Bad Request: Invalid role
```

**Get User Audit Log**
```
GET /api/v1/admin/users/{userId}/audit
Authorization: Moderator+
Query Parameters:
  - offset, limit (pagination)
  - eventType (string): Filter by event type (created, updated, deleted, role_assigned)

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "eventType": "role_assigned",
      "performedBy": "uuid-of-owner",
      "performedAt": "2024-01-21T12:00:00Z",
      "changes": {
        "role": { "old": "User", "new": "Moderator" }
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0..."
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "total": 8 }
}
```

### 6.3 Data Management Endpoints (Matches)

**List All Matches (Admin View)**
```
GET /api/v1/admin/matches
Authorization: Moderator+
Query Parameters:
  - offset, limit (pagination)
  - seasonId (uuid): Filter by season
  - playerId (uuid): Filter by player
  - createdAfter, createdBefore (ISO 8601): Date range filter
  - includeDeleted (bool): Include soft-deleted matches

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "seasonId": "uuid",
      "team1": {
        "player1Id": "uuid",
        "player2Id": "uuid",
        "score": 15,
        "winner": true
      },
      "team2": {
        "player1Id": "uuid",
        "player2Id": "uuid",
        "score": 10,
        "winner": false
      },
      "createdAt": "2024-01-20T18:30:00Z",
      "submittedBy": "uuid",
      "deletedAt": null
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "total": 500 }
}
```

**Get Match Details (Admin View)**
```
GET /api/v1/admin/matches/{matchId}
Authorization: Moderator+

Response: 200 OK
{
  "id": "uuid",
  "seasonId": "uuid",
  "team1": { ... },
  "team2": { ... },
  "mmrCalculations": [
    {
      "playerId": "uuid",
      "mmrBefore": 1500,
      "mmrAfter": 1520,
      "mmrChange": 20
    }
  ],
  "submittedBy": "uuid",
  "submittedAt": "2024-01-20T18:30:00Z",
  "createdAt": "2024-01-20T18:30:00Z",
  "updatedAt": null,
  "deletedAt": null
}
```

**Update Match**
```
PATCH /api/v1/admin/matches/{matchId}
Authorization: Moderator+
Content-Type: application/json

Request Body: (all fields optional)
{
  "team1Score": 16,
  "team2Score": 11,
  "recalculateMmr": true  // If true, recalculates MMR after update
}

Response: 200 OK
{
  "id": "uuid",
  "team1": { "score": 16, ... },
  "team2": { "score": 11, ... },
  "updatedAt": "2024-01-21T13:00:00Z"
}

Side Effects:
  - If recalculateMmr=true, triggers MMR recalculation for this match and all subsequent matches in season

Errors:
  - 404 Not Found: Match does not exist
  - 400 Bad Request: Invalid scores
```

**Delete Match**
```
DELETE /api/v1/admin/matches/{matchId}
Authorization: Moderator+
Query Parameters:
  - recalculateMmr (bool): Recalculate MMR for season after deletion (default: false)

Response: 204 No Content

Side Effects:
  - Soft deletes match (sets deletedAt)
  - If recalculateMmr=true, recalculates MMR for all matches after this one in season

Errors:
  - 404 Not Found: Match does not exist or already deleted
```

**Recalculate MMR**
```
POST /api/v1/admin/matches/{matchId}/recalculate
Authorization: Moderator+
Content-Type: application/json

Request Body:
{
  "fromThisMatch": true  // If true, recalculate this match and all subsequent
                          // If false, recalculate only this match
}

Response: 200 OK
{
  "matchesRecalculated": 45,
  "playersAffected": 12,
  "processingTimeMs": 234
}

Errors:
  - 404 Not Found: Match does not exist
  - 400 Bad Request: Cannot recalculate deleted match
```

**Bulk Delete Matches**
```
POST /api/v1/admin/matches/bulk-delete
Authorization: Moderator+
Content-Type: application/json

Request Body:
{
  "matchIds": ["uuid1", "uuid2", "uuid3"],
  "recalculateMmr": true
}

Response: 200 OK
{
  "deleted": 3,
  "failed": 0,
  "errors": []
}
```

### 6.4 Data Management Endpoints (Seasons)

**List All Seasons**
```
GET /api/v1/admin/seasons
Authorization: Moderator+
Query Parameters:
  - offset, limit (pagination)
  - active (bool): Filter by active status

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "Season 1 - 2024",
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-03-31T23:59:59Z",
      "isActive": true,
      "matchCount": 150
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "total": 5 }
}
```

**Create Season**
```
POST /api/v1/admin/seasons
Authorization: Owner
Content-Type: application/json

Request Body:
{
  "name": "Season 2 - 2024",
  "startDate": "2024-04-01T00:00:00Z",
  "endDate": "2024-06-30T23:59:59Z"
}

Response: 201 Created
Location: /api/v1/admin/seasons/{seasonId}
{
  "id": "uuid",
  "name": "Season 2 - 2024",
  "startDate": "2024-04-01T00:00:00Z",
  "endDate": "2024-06-30T23:59:59Z",
  "isActive": false,
  "createdAt": "2024-01-21T14:00:00Z"
}
```

**Update Season**
```
PATCH /api/v1/admin/seasons/{seasonId}
Authorization: Owner
Content-Type: application/json

Request Body: (all fields optional)
{
  "name": "Season 2 - Spring 2024",
  "endDate": "2024-07-15T23:59:59Z"
}

Response: 200 OK
{
  "id": "uuid",
  "name": "Season 2 - Spring 2024",
  "endDate": "2024-07-15T23:59:59Z",
  "updatedAt": "2024-01-21T15:00:00Z"
}
```

**Delete Season**
```
DELETE /api/v1/admin/seasons/{seasonId}
Authorization: Owner

Response: 204 No Content

Errors:
  - 409 Conflict: Cannot delete season with matches (must delete matches first or use force flag)
```

---

## 7. Public/User Endpoints

### 7.1 User-Facing Principles

**All user endpoints:**
- Accessible to authenticated users (User role minimum)
- Return only data user is authorized to see
- Operate on resources user owns or public data
- Use `/api/v1/{resource}` prefix (no admin prefix)

### 7.2 Profile Endpoints

**Get Current User Profile**
```
GET /api/v1/users/me
Authorization: User+

Response: 200 OK
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "mmr": 1500,
  "sigma": 250,
  "role": "User",
  "stats": {
    "totalMatches": 45,
    "wins": 28,
    "losses": 17,
    "winRate": 0.622
  }
}
```

**Update Current User Profile**
```
PATCH /api/v1/users/me
Authorization: User+
Content-Type: application/json

Request Body: (all fields optional)
{
  "name": "Johnny Doe"
}

Response: 200 OK
{
  "id": "uuid",
  "name": "Johnny Doe",
  "updatedAt": "2024-01-21T16:00:00Z"
}

Note: Users can only update their own name. MMR and role changes require admin.
```

**Search Users (Public Profiles)**
```
GET /api/v1/users
Authorization: User+
Query Parameters:
  - search (string): Search by name
  - offset, limit (pagination)

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "mmr": 1500,
      "stats": { "totalMatches": 45, "winRate": 0.622 }
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "total": 100 }
}

Note: Returns public profile data only (no email, no role)
```

**Get User Public Profile**
```
GET /api/v1/users/{userId}
Authorization: User+

Response: 200 OK
{
  "id": "uuid",
  "name": "John Doe",
  "mmr": 1500,
  "stats": { ... }
}

Note: Returns public data only
```

### 7.3 Match Endpoints

**Submit Match**
```
POST /api/v1/matches
Authorization: User+
Content-Type: application/json

Request Body:
{
  "seasonId": "uuid",
  "team1": {
    "player1Id": "uuid",
    "player2Id": "uuid",
    "score": 15
  },
  "team2": {
    "player1Id": "uuid",
    "player2Id": "uuid",
    "score": 10
  }
}

Response: 201 Created
Location: /api/v1/matches/{matchId}
{
  "id": "uuid",
  "seasonId": "uuid",
  "team1": { ... },
  "team2": { ... },
  "createdAt": "2024-01-21T18:00:00Z",
  "mmrCalculations": [ ... ]
}

Business Rules:
  - All 4 players must exist
  - Scores must be valid (0-15, one team must have 15)
  - Season must be active
  - Duplicate match detection (same players + scores + timestamp)
```

**Get Match History**
```
GET /api/v1/matches
Authorization: User+
Query Parameters:
  - playerId (uuid): Filter by player (defaults to current user)
  - seasonId (uuid): Filter by season
  - offset, limit (pagination)

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "seasonId": "uuid",
      "team1": { ... },
      "team2": { ... },
      "createdAt": "2024-01-21T18:00:00Z"
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "total": 45 }
}
```

**Get Match Details**
```
GET /api/v1/matches/{matchId}
Authorization: User+

Response: 200 OK
{
  "id": "uuid",
  "seasonId": "uuid",
  "team1": { ... },
  "team2": { ... },
  "mmrCalculations": [ ... ],
  "createdAt": "2024-01-21T18:00:00Z"
}
```

### 7.4 Statistics Endpoints

**Get Leaderboard**
```
GET /api/v1/statistics/leaderboard
Authorization: User+
Query Parameters:
  - seasonId (uuid): Filter by season (required)
  - offset, limit (pagination)

Response: 200 OK
{
  "data": [
    {
      "rank": 1,
      "playerId": "uuid",
      "playerName": "John Doe",
      "mmr": 1850,
      "wins": 50,
      "losses": 10,
      "winRate": 0.833
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "total": 150 }
}
```

**Get Player Statistics**
```
GET /api/v1/statistics/players/{playerId}
Authorization: User+
Query Parameters:
  - seasonId (uuid): Filter by season (optional, defaults to current season)

Response: 200 OK
{
  "playerId": "uuid",
  "playerName": "John Doe",
  "mmr": 1500,
  "rank": 45,
  "totalMatches": 45,
  "wins": 28,
  "losses": 17,
  "winRate": 0.622,
  "recentMatches": [ ... ]
}
```

### 7.5 Matchmaking Endpoints

**Join Queue**
```
POST /api/v1/matchmaking/queue
Authorization: User+
Content-Type: application/json

Request Body:
{
  "seasonId": "uuid"
}

Response: 200 OK
{
  "queuedAt": "2024-01-21T19:00:00Z",
  "position": 3,
  "estimatedWaitSeconds": 45
}

Errors:
  - 409 Conflict: Already in queue
```

**Leave Queue**
```
DELETE /api/v1/matchmaking/queue
Authorization: User+

Response: 204 No Content
```

**Get Queue Status**
```
GET /api/v1/matchmaking/queue/status
Authorization: User+

Response: 200 OK
{
  "inQueue": true,
  "queuedAt": "2024-01-21T19:00:00Z",
  "position": 2
}
```

**Get Active Match**
```
GET /api/v1/matchmaking/active
Authorization: User+

Response: 200 OK
{
  "matchId": "uuid",
  "team1": { "player1Id": "uuid", "player2Id": "uuid" },
  "team2": { "player1Id": "uuid", "player2Id": "uuid" },
  "createdAt": "2024-01-21T19:05:00Z"
}

Or: 404 Not Found if no active match
```

### 7.6 Season Endpoints

**List Active Seasons**
```
GET /api/v1/seasons
Authorization: User+

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "Season 1 - 2024",
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-03-31T23:59:59Z",
      "isActive": true
    }
  ]
}
```

**Get Season Details**
```
GET /api/v1/seasons/{seasonId}
Authorization: User+

Response: 200 OK
{
  "id": "uuid",
  "name": "Season 1 - 2024",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-03-31T23:59:59Z",
  "isActive": true,
  "matchCount": 150,
  "playerCount": 50
}
```

### 7.7 Personal Access Token Endpoints

**List My Tokens**
```
GET /api/v1/personal-access-tokens
Authorization: User+ (JWT only, not PAT)

Response: 200 OK
{
  "data": [
    {
      "id": "uuid",
      "name": "CI/CD Token",
      "prefix": "pat_abc123",
      "createdAt": "2024-01-15T10:00:00Z",
      "lastUsedAt": "2024-01-21T18:00:00Z",
      "expiresAt": "2025-01-15T10:00:00Z"
    }
  ]
}

Note: Full token value never returned after creation
```

**Create Token**
```
POST /api/v1/personal-access-tokens
Authorization: User+ (JWT only)
Content-Type: application/json

Request Body:
{
  "name": "My API Token",
  "expiresAt": "2025-01-21T10:00:00Z"  // Optional
}

Response: 201 Created
{
  "id": "uuid",
  "name": "My API Token",
  "token": "pat_abc123xyz...",  // ONLY returned on creation
  "createdAt": "2024-01-21T20:00:00Z",
  "expiresAt": "2025-01-21T10:00:00Z"
}

Warning: Token value shown only once. User must save it.
```

**Revoke Token**
```
DELETE /api/v1/personal-access-tokens/{tokenId}
Authorization: User+ (JWT only)

Response: 204 No Content
```

---

## 8. API Versioning Strategy

### 8.1 Versioning Approach

**URL-Based Versioning (Recommended)**

- Version included in URL path: `/api/v1/users`, `/api/v2/users`
- Simple, explicit, and visible
- Easy to route different versions to different implementations
- Compatible with API gateways and proxies

**Why Not Header-Based or Query Parameter Versioning:**
- Header-based: Not visible in URL, harder to test, poor discoverability
- Query parameter: Easy to forget, not RESTful, caching issues

### 8.2 Version Numbering

**Major Versions Only:**
- `v1`, `v2`, `v3` (not `v1.1`, `v1.2`)
- Increment major version for breaking changes only
- Non-breaking changes deployed to existing version

**What Constitutes a Breaking Change:**
- Removing an endpoint
- Removing a field from response
- Changing field type (string → int)
- Renaming a field
- Changing authentication requirements
- Changing HTTP status codes for existing scenarios
- Changing error response format

**Non-Breaking Changes (Can Deploy to Existing Version):**
- Adding new endpoints
- Adding optional query parameters
- Adding new fields to response (clients should ignore unknown fields)
- Adding new optional request body fields
- Fixing bugs that return incorrect data

### 8.3 Version Lifecycle

**Phases:**
1. **Current:** Latest version, actively developed
2. **Supported:** Previous versions still maintained (bug fixes, security patches)
3. **Deprecated:** No new features, only critical security fixes, sunset date announced
4. **Sunset:** Endpoint returns 410 Gone

**Support Policy:**
- Current version (v2): All new features, bug fixes
- Previous version (v1): Bug fixes for 12 months after v2 release
- Deprecation notice: 6 months before sunset
- Sunset: v1 endpoints return `410 Gone` with message pointing to v2

**Communication:**
- Deprecation announced via email, changelog, and in-app notifications
- `Sunset` HTTP header on deprecated endpoints: `Sunset: Sat, 31 Dec 2024 23:59:59 GMT`
- `Deprecation` header: `Deprecation: true`

### 8.4 Implementing New Versions

**When to Create v2:**
- Multiple breaking changes accumulated
- Major architectural shift (e.g., multi-tenancy)
- Complete resource redesign

**Implementation Strategy:**
- Create new controllers: `UsersV2Controller`
- Share service layer when possible
- Use separate DTOs for different versions (`UserDetailsV1`, `UserDetailsV2`)
- Map between versions in controller layer

**Gradual Migration:**
- Both v1 and v2 run concurrently
- Clients migrate endpoint by endpoint
- Monitor v1 usage, deprecate when usage drops below threshold

---

## 9. Request/Response Formats

### 9.1 Content Types

**Request/Response:**
- **Content-Type:** `application/json` (required for all POST/PATCH/PUT)
- **Accept:** `application/json` (default, clients should send)
- **Character Encoding:** UTF-8 (always)

**Not Supported:**
- XML, form-urlencoded, multipart (unless specific use case like file uploads)

### 9.2 Date/Time Formats

**ISO 8601 with UTC Timezone:**
```json
{
  "createdAt": "2024-01-21T10:30:00Z"
}
```

- Always UTC (Z suffix)
- No milliseconds (unless needed for precision)
- Date-only fields: `"2024-01-21"` (no time component)

**Why UTC:**
- No timezone ambiguity
- Client responsible for local timezone conversion
- Consistent database storage

### 9.3 Field Naming Conventions

**camelCase for JSON Fields:**
```json
{
  "userId": "uuid",
  "createdAt": "2024-01-21T10:30:00Z",
  "mmrCalculation": { ... }
}
```

**Rationale:**
- JavaScript/TypeScript convention (frontend uses camelCase)
- Consistent with C# naming when serialized (configured in `System.Text.Json`)

### 9.4 Null vs Omitted Fields

**Response Fields:**
- **Null:** Field exists but has no value (`"email": null`)
- **Omitted:** Field not included in response at all

**Convention:**
- Always include fields that are part of resource schema (use `null` if no value)
- Omit fields user doesn't have permission to see
- Optional: Implement sparse fieldsets (`?fields=id,name`) to reduce payload

**Request Fields (PATCH):**
- **Omitted:** No change to field
- **Null:** Explicitly set field to null/clear value
- **Present:** Update field to provided value

### 9.5 Error Response Format

**RFC 7807 Problem Details:**
```json
{
  "type": "https://api.mmr.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "One or more validation errors occurred.",
  "instance": "/api/v1/admin/users",
  "errors": {
    "email": ["Email is required.", "Email must be valid format."],
    "name": ["Name must be between 1 and 100 characters."]
  },
  "traceId": "0HMVFE3F4S1PV:00000001"
}
```

**Fields:**
- `type`: URI identifying error type (for documentation)
- `title`: Short human-readable error description
- `status`: HTTP status code (redundant with response status, but useful in body)
- `detail`: Detailed explanation of this specific error instance
- `instance`: URI of the request that caused the error
- `errors`: Validation errors keyed by field name (optional, for 400 Bad Request)
- `traceId`: Correlation ID for log searching

**Common Error Types:**

**400 Bad Request - Validation Error:**
```json
{
  "type": "https://api.mmr.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "One or more validation errors occurred.",
  "errors": { "email": ["Email is required."] }
}
```

**401 Unauthorized - Missing or Invalid Token:**
```json
{
  "type": "https://api.mmr.com/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Authentication token is missing or invalid."
}
```

**403 Forbidden - Insufficient Permissions:**
```json
{
  "type": "https://api.mmr.com/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "You do not have permission to perform this action. Owner role required."
}
```

**404 Not Found - Resource Doesn't Exist:**
```json
{
  "type": "https://api.mmr.com/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "User with ID '550e8400-e29b-41d4-a716-446655440000' was not found."
}
```

**409 Conflict - Business Rule Violation:**
```json
{
  "type": "https://api.mmr.com/errors/conflict",
  "title": "Conflict",
  "status": 409,
  "detail": "A user with this email already exists.",
  "conflictingResource": "/api/v1/users/abc-123"
}
```

**500 Internal Server Error:**
```json
{
  "type": "https://api.mmr.com/errors/internal-server-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred. Please try again later.",
  "traceId": "0HMVFE3F4S1PV:00000001"
}
```

**Note:** 500 errors should NOT expose internal details (stack traces, database errors). Log these server-side, return generic message to client.

### 9.6 Success Response Patterns

**200 OK - Successful GET/PATCH:**
```json
// Return the resource
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com"
}
```

**201 Created - Successful POST:**
```http
HTTP/1.1 201 Created
Location: /api/v1/users/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "createdAt": "2024-01-21T10:00:00Z"
}
```

**204 No Content - Successful DELETE:**
```http
HTTP/1.1 204 No Content
```
(Empty body)

**202 Accepted - Asynchronous Operation:**
```http
HTTP/1.1 202 Accepted
Location: /api/v1/jobs/abc-123

{
  "jobId": "abc-123",
  "status": "pending",
  "statusUrl": "/api/v1/jobs/abc-123"
}
```

### 9.7 Pagination Response Format

**Envelope with Metadata:**
```json
{
  "data": [
    { "id": "uuid1", "name": "User 1" },
    { "id": "uuid2", "name": "User 2" }
  ],
  "pagination": {
    "offset": 20,
    "limit": 20,
    "total": 150,
    "hasMore": true
  }
}
```

**Alternative: Link Header (Optional):**
```http
Link: </api/v1/users?offset=40&limit=20>; rel="next",
      </api/v1/users?offset=0&limit=20>; rel="first",
      </api/v1/users?offset=140&limit=20>; rel="last"
```

---

## 10. API Conventions

### 10.1 HTTP Status Codes

**Success Codes:**
- `200 OK`: Successful GET, PATCH, or POST without creation
- `201 Created`: Successful POST that created a resource
- `204 No Content`: Successful DELETE or operation with no response body
- `202 Accepted`: Request accepted for async processing

**Client Error Codes:**
- `400 Bad Request`: Validation error, malformed request
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Authenticated but insufficient permissions
- `404 Not Found`: Resource doesn't exist (or user lacks permission to see it)
- `409 Conflict`: Business rule violation, duplicate resource
- `422 Unprocessable Entity`: Semantic validation error (e.g., end date before start date)
- `429 Too Many Requests`: Rate limit exceeded

**Server Error Codes:**
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Upstream service (e.g., MMR API) unavailable
- `503 Service Unavailable`: Temporary unavailability (maintenance, overload)

**Deprecation/Removal:**
- `410 Gone`: Endpoint permanently removed (after sunset)

### 10.2 HTTP Headers

**Request Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json
X-Tenant-ID: acme-corp
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000  // Client-generated correlation ID
```

**Response Headers:**
```http
Content-Type: application/json; charset=utf-8
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000  // Echoed back
X-RateLimit-Limit: 100                              // Max requests per window
X-RateLimit-Remaining: 95                           // Remaining requests
X-RateLimit-Reset: 1698769200                       // Unix timestamp when limit resets
Deprecation: true                                   // Endpoint deprecated
Sunset: Sat, 31 Dec 2024 23:59:59 GMT              // Deprecation date
```

**CORS Headers (if applicable):**
```http
Access-Control-Allow-Origin: https://app.mmr.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-Tenant-ID
Access-Control-Max-Age: 86400
```

### 10.3 Idempotency

**Idempotent Methods (Safe to Retry):**
- GET, PUT, PATCH, DELETE
- Multiple identical requests have same effect as single request

**Non-Idempotent Methods:**
- POST (creates multiple resources on retry)
- **Solution:** Implement idempotency keys for critical operations

**Idempotency Key Pattern:**
```http
POST /api/v1/matches
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{ "team1": {...}, "team2": {...} }
```

**Server Behavior:**
- Store idempotency key + request hash on first request
- If duplicate key received within 24 hours, return cached response (200 OK, not 201)
- Prevents duplicate match submissions due to network retries

### 10.4 Rate Limiting

**Strategy:**
- **User Tier:** 100 requests per minute per user
- **Admin Tier:** 500 requests per minute per admin
- **PAT Tier:** Configured per token (default 100/min)

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698769200
```

**Response on Limit Exceeded:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "type": "https://api.mmr.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded the rate limit of 100 requests per minute.",
  "retryAfter": 60
}
```

### 10.5 Filtering and Search Syntax

**Exact Match:**
```
GET /api/v1/matches?seasonId=abc-123
```

**Search (Partial Match):**
```
GET /api/v1/users?search=john
```
(Searches across name, email)

**Range Filters:**
```
GET /api/v1/matches?createdAfter=2024-01-01T00:00:00Z&createdBefore=2024-01-31T23:59:59Z
```

**Boolean Filters:**
```
GET /api/v1/admin/users?includeDeleted=true
```

**Enum Filters:**
```
GET /api/v1/admin/users?role=Moderator
```

### 10.6 Sorting Syntax

**Single Field:**
```
GET /api/v1/users?sortBy=mmr&sortOrder=desc
```

**Default Sort:**
- If not specified: `sortBy=createdAt&sortOrder=desc` (most recent first)

**Multiple Fields (Future):**
```
GET /api/v1/users?sort=-mmr,+name
```
(- prefix for desc, + for asc)

---

## 11. Security & Validation

### 11.1 Authentication Security

**Token Security:**
- **JWT:** Short-lived (1 hour), refresh tokens rotated
- **PAT:** Long-lived, stored as SHA256 hash, revocable
- **HTTPS Only:** All API traffic over TLS 1.2+ (enforce in production)
- **No Token in URL:** Never pass tokens in query parameters (logged in server logs)

**Token Validation:**
- Verify signature (JWT)
- Check expiration
- Validate issuer and audience
- Check revocation list (for PATs)

### 11.2 Authorization Security

**Defense in Depth:**
1. **Routing:** Global `RequireAuthorization()`
2. **Controller:** `[Authorize(Policy = "...")]` attributes
3. **Service:** Explicit role checks for critical operations
4. **Data:** EF query filters (tenant isolation)

**Principle of Least Privilege:**
- Default role: User (minimal permissions)
- Explicit grants for Moderator/Owner
- Admin operations require explicit authorization
- Audit all permission changes

### 11.3 Input Validation

**Multi-Layer Validation:**

**1. Model Validation (Data Annotations):**
```csharp
public class CreateUserRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; }

    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; set; }
}
```

**2. Business Rule Validation (Service Layer):**
```csharp
// Check uniqueness
if (await _context.Users.AnyAsync(u => u.Email == email))
    throw new ConflictException("User with this email already exists");

// Check relationships
if (!await _context.Seasons.AnyAsync(s => s.Id == seasonId))
    throw new NotFoundException("Season not found");
```

**3. Authorization Validation:**
```csharp
if (!_userContext.HasRole(PlayerRole.Owner))
    throw new ForbiddenException("Only owners can assign roles");
```

**Validation Error Response:**
- Return `400 Bad Request` with field-specific errors
- Use Problem Details format with `errors` dictionary

### 11.4 SQL Injection Prevention

**Entity Framework Parameterization:**
- All queries parameterized automatically by EF Core
- Never use string interpolation in LINQ to Entities
- For raw SQL, always use parameterized queries:

```csharp
// ✅ Safe
await _context.Users.FromSqlRaw(
    "SELECT * FROM Users WHERE Email = {0}", email).ToListAsync();

// ❌ Unsafe
await _context.Users.FromSqlRaw(
    $"SELECT * FROM Users WHERE Email = '{email}'").ToListAsync();
```

### 11.5 XSS and Injection Prevention

**JSON Serialization:**
- Use `System.Text.Json` (default in ASP.NET Core)
- Automatically escapes HTML characters in JSON strings
- Never use `Html.Raw()` or disable encoding

**Content Security Policy:**
```http
Content-Security-Policy: default-src 'self'; script-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

### 11.6 CORS Configuration

**Production:**
```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("https://app.mmr.com")
              .AllowCredentials()
              .AllowMethods("GET", "POST", "PATCH", "DELETE")
              .AllowHeaders("Authorization", "Content-Type", "X-Tenant-ID");
    });
});
```

**Development:**
```csharp
policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
```

### 11.7 Secrets Management

**Never in Code:**
- No hardcoded API keys, passwords, or tokens
- No secrets in appsettings.json (checked into source control)

**Use:**
- **Development:** User Secrets (`dotnet user-secrets`)
- **Production:** Azure Key Vault, AWS Secrets Manager, or environment variables
- **CI/CD:** GitHub Secrets, Azure DevOps variable groups

**Rotation:**
- Database credentials rotated every 90 days
- API keys rotated every 180 days
- PATs have expiration dates

### 11.8 Audit Logging

**What to Log (Admin Actions):**
- User role assignments/changes
- User profile updates (by admin)
- Match edits/deletions
- Season creation/deletion
- MMR recalculations
- Failed authorization attempts

**Log Fields:**
- Action performed (`role_assigned`, `user_updated`)
- Performed by (user ID)
- Target resource (user ID, match ID)
- Timestamp
- IP address
- User agent
- Changes (old value → new value)

**Storage:**
- Dedicated `AuditLogs` table
- Immutable (insert-only, no updates/deletes)
- Retained for compliance period (e.g., 2 years)

### 11.9 Data Privacy

**PII Handling:**
- Email addresses considered PII (log with caution)
- Never log full authentication tokens
- Redact sensitive fields in error messages

**GDPR Compliance:**
- User deletion = hard delete all PII, soft delete anonymized gameplay data
- Data export endpoint: `GET /api/v1/users/me/export` returns all user data
- Consent tracking (if applicable)

### 11.10 Dependency Security

**Regular Updates:**
- NuGet packages updated monthly
- Security patches applied immediately
- Dependabot enabled for vulnerability scanning

**Vulnerability Scanning:**
- `dotnet list package --vulnerable` in CI/CD
- Fail build on high/critical vulnerabilities

---

## Appendix A: Migration from Current Implementation

### A.1 Multi-Tenancy Migration Steps

**Phase 1: Schema Changes**
1. Add `TenantId` column to entities (nullable)
2. Create `Tenants` table
3. Create `UserTenants` join table
4. Migrate existing data to default tenant

**Phase 2: Application Changes**
1. Implement `ITenantContext` and middleware
2. Add global query filters
3. Update services to set `TenantId`
4. Update role system to be tenant-scoped

**Phase 3: API Changes**
1. Require `X-Tenant-ID` header
2. Update frontend to send header
3. Update PAT system for tenant scoping

### A.2 Admin Prefix Migration

**Current State:**
- Some admin endpoints in `AdminController`
- User management in `UsersController` (mixed admin/user operations)
- Role management in `RolesController`

**Target State:**
- Move admin operations to `/api/v1/admin/*` prefix
- Keep user self-service in `/api/v1/*`
- Create admin-specific controllers in `Controllers/Admin/` folder

**Migration Plan:**
1. Create new admin controllers (don't delete old ones yet)
2. Implement new endpoints with admin prefix
3. Update frontend to use new endpoints
4. Deprecate old endpoints (return 301 redirect to new endpoints)
5. After 3 months, return 410 Gone on old endpoints

---

## Appendix B: Future Considerations

### B.1 GraphQL API

Consider GraphQL for complex query requirements:
- Reduces over-fetching (clients request only needed fields)
- Reduces under-fetching (single request for multiple resources)
- Strong typing and introspection
- Trade-off: Added complexity, caching harder

### B.2 WebSockets for Real-Time

For real-time matchmaking updates:
- WebSocket endpoint: `wss://api.mmr.com/ws`
- Send queue position updates in real-time
- Notify when match is found

### B.3 Bulk Operations

Add bulk endpoints for admin efficiency:
- `POST /api/v1/admin/users/bulk-update`
- `POST /api/v1/admin/matches/bulk-delete`
- Return summary of successes and failures

### B.4 Webhooks

Allow external systems to subscribe to events:
- `user.created`, `match.completed`, `season.ended`
- Signed payloads for verification
- Retry logic with exponential backoff

---

## Appendix C: OpenAPI/Swagger Standards

### C.1 Operation IDs

**Format:** `{ControllerName}_{ActionName}`
```yaml
paths:
  /api/v1/users/{userId}:
    get:
      operationId: Users_GetById
```

### C.2 Tags

Organize endpoints by resource:
- `Users`
- `Admin - Users`
- `Matches`
- `Admin - Matches`
- `Statistics`
- `Matchmaking`

### C.3 Descriptions

Every endpoint should have:
- Summary (one line)
- Description (detailed explanation)
- Parameter descriptions
- Response descriptions
- Example requests/responses

### C.4 Security Schemes

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    PersonalAccessToken:
      type: http
      scheme: bearer
      bearerFormat: PAT
```

---

**End of Document**

This design document serves as the authoritative reference for API design in the MMR Project. All new APIs should follow these patterns, and existing APIs should be gradually migrated to align with this design.

**Document Maintainers:** Engineering Team
**Review Cycle:** Quarterly
**Change Process:** Propose changes via pull request with team review
