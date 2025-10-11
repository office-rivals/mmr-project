# ADR 001: Multi-Tenant Identity Architecture

## Status

Proposed

## Context

The MMR Project is undergoing two significant architectural changes:

1. **Identity Provider Migration**: Moving from Supabase authentication to Clerk (PR #174)
2. **Multi-Tenancy Support**: Evolving from a single-tenant system to support multiple isolated organizations/workspaces

### Current Architecture Problems

The existing architecture tightly couples authentication identity with game data:

```
Player
  ├─ id: internal database ID
  ├─ identity_user_id: auth provider's user ID (Supabase UUID)
  └─ game data: MMR, matches, statistics (global)
```

This creates several issues:

1. **Identity Provider Lock-in**: Changing auth providers (Supabase → Clerk) requires updating all Player records, as `identity_user_id` values are provider-specific
2. **No Multi-Tenancy Support**: All players exist in a single global namespace with no organizational isolation
3. **Migration Complexity**: Users lose access to their accounts when identity providers change unless manually migrated
4. **Inflexible Access Control**: No way to grant users different roles in different organizations
5. **No Multiple Personas**: Users cannot have separate identities/MMRs in different contexts (work league vs friends league)

### Business Requirements

1. **Seamless Migration**: Users must retain access to their accounts and history when switching from Supabase to Clerk
2. **Future-Proof Authentication**: Support multiple identity providers simultaneously and add new providers without schema changes
3. **Multi-Tenancy**: Enable isolated workspaces where:
   - Each tenant (organization) has its own players, matches, and statistics
   - Users can belong to multiple tenants with different roles
   - Data is completely isolated between tenants
4. **Flexible Identity Management**: Allow users to link multiple authentication methods (Clerk, Google, Azure AD, etc.)
5. **Zero Downtime Migration**: Deploy new architecture without service interruption

## Decision Drivers

- **Data Integrity**: Player match history and statistics must be preserved during migration
- **User Experience**: Authentication changes should be transparent to users
- **Scalability**: Architecture must support hundreds of tenants and thousands of users
- **Security**: Tenant data isolation must be enforced at the database level
- **Maintainability**: Clear separation of concerns between identity, access control, and game logic
- **Future-Proofing**: Easy to add new auth providers or change providers in the future

## Considered Options

### Option 1: Simple Migration (Identity Field Update)

Update `Player.identity_user_id` from Supabase IDs to Clerk IDs via a one-time script.

**Rejected because:**
- Requires coordinated downtime
- No support for multi-tenancy
- Doesn't solve future provider changes
- Risk of data loss during migration

### Option 2: Dual Identity Support

Support both Supabase and Clerk IDs temporarily with fallback logic.

**Rejected because:**
- Creates technical debt
- Complex conditional authentication logic
- Still no multi-tenancy support
- Doesn't address long-term architectural needs

### Option 3: Multi-Provider Identity with Tenant Awareness (SELECTED)

Decouple identity from game data and introduce tenant isolation.

**Selected because:**
- Solves both immediate (migration) and future (multi-tenancy) needs
- Clean separation of concerns
- Provider-agnostic architecture
- Natural data isolation boundaries

## Decision Outcome

We will implement a **three-layer architecture** that separates identity, tenant membership, and game data:

### Architecture Layers

#### Layer 1: Identity Layer (Global)

**User**: The authenticated person across all tenants
- Represents a real person
- Exists once regardless of tenant membership
- Not tied to game data

**UserIdentity**: Links Users to authentication providers
- One User can have multiple UserIdentities (Clerk, Google, Supabase legacy, etc.)
- Supports automatic email-based account linking during migration
- Tracks primary identity and last used timestamp

#### Layer 2: Tenant Membership Layer (Access Control)

**Tenant**: Isolated organization/workspace
- Data isolation boundary
- All game data scoped to a tenant
- Independent settings and configuration

**TenantMembership**: Links Users to Tenants with roles
- Defines which tenants a user can access
- Role-based access control (owner, admin, player, viewer)
- Users can be members of multiple tenants

#### Layer 3: Tenant Data Layer (Game Data)

**Player**: User's in-game persona within a specific tenant
- One Player per User per Tenant
- Contains tenant-scoped game data (MMR, statistics)
- Linked to User via TenantMembership
- Different name/persona possible per tenant

### Entity Relationships

```
User (1) ──< UserIdentity (N)
  └─ Represents: Who you are

User (1) ──< TenantMembership (N) >── Tenant (1)
  └─ Represents: Which organizations you belong to + your role

TenantMembership (1) ──< Player (1) >── Tenant (1)
  └─ Represents: Your in-game persona per tenant
      └─< Matches, Statistics, History (all tenant-scoped)
```

### Migration Flow

When a user logs in with Clerk after migration:

1. Extract: `issuer`, `provider_user_id`, `email` from JWT
2. Check: Does a UserIdentity exist for this issuer + provider_user_id?
   - **Yes**: Return associated User → determine active tenant → load Player
   - **No**: Continue to step 3
3. Check: Does a legacy `Player.identity_user_id` match this provider_user_id?
   - **Yes**: Migrate to new structure (create User + UserIdentity), preserve Player data
   - **No**: Continue to step 4
4. Check: Does a UserIdentity exist with matching email from different provider?
   - **Yes**: Auto-link new UserIdentity to existing User (automatic migration)
   - **No**: New user → create User + UserIdentity → direct to tenant selection/claim

### Key Features

1. **Automatic Migration**: Email-based linking handles 95%+ of Supabase → Clerk migrations transparently
2. **Provider Agnostic**: Add/remove auth providers without touching game data
3. **Tenant Isolation**: All Player/Match/Statistics data scoped to Tenant via foreign keys
4. **Multiple Providers**: Users can link Clerk + Google + Azure AD simultaneously
5. **Audit Trail**: Complete history of identity links and migrations

## Consequences

### Positive

- **Clean Separation**: Identity, access control, and game data are independent concerns
- **Seamless Migration**: Users retain access during Supabase → Clerk transition
- **Multi-Tenancy Ready**: Architecture supports tenant isolation from day one
- **Future-Proof**: Adding auth providers requires no schema changes
- **Flexible Access**: Users can have different roles in different tenants
- **Data Isolation**: Tenant data completely separated (security + performance)
- **Audit Trail**: Full visibility into identity links and migrations
- **Rollback Safety**: Legacy `identity_user_id` retained during transition period

### Negative

- **Increased Complexity**: Three layers vs one simple `identity_user_id` field
- **More Joins**: Queries now traverse User → TenantMembership → Player → data
- **Migration Effort**: Requires careful data migration and testing
- **Additional Tables**: +3 new tables (User, UserIdentity, TenantMembership)
- **Tenant Context Required**: All queries must include tenant scope
- **Edge Cases**: Email changes between providers won't auto-migrate

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Retain `identity_user_id` field temporarily; extensive testing with production data copies |
| User can't find their account | Provide manual claim flow; export Supabase data for support |
| Performance degradation | Add indexes on foreign keys; use query optimization |
| Email-based linking false positives | Require email verification; log all auto-links for audit |
| Incomplete migration | Migration statistics dashboard; alerts for failures |

## Implementation Plan

### Phase 1: Schema Changes (Week 1)

- Create `users` table
- Create `user_identities` table
- Create `tenants` table
- Create `tenant_memberships` table
- Add `user_id` and `tenant_id` foreign keys to `players` table
- Add `legacy_identity_migrated` flag to `players` table
- Keep `identity_user_id` for backward compatibility

### Phase 2: Service Layer (Week 2)

- Implement `IdentityService` for multi-provider authentication
- Update `UserContextResolver` to extract email and issuer from JWT
- Create `TenantService` for tenant management
- Update `UserService` to use new identity layer
- Add migration logic for legacy identities

### Phase 3: Migration & Testing (Week 3)

- Export Supabase user data (id, email, verification status)
- Create one-time migration script for existing players
- Test automatic email-based linking with sample data
- Load test with realistic tenant/user volumes
- Create rollback procedures

### Phase 4: Deployment (Week 4)

- Deploy database migrations
- Run legacy identity migration script
- Deploy updated API with new services
- Deploy frontend with Clerk integration (PR #174)
- Monitor migration statistics and error rates

### Phase 5: Multi-Tenancy Features (Future)

- Tenant creation and management UI
- Invitation and onboarding workflows
- Per-tenant settings and configuration
- Cross-tenant user profile (optional)
- Tenant-scoped leaderboards and statistics

## Validation

Success criteria:

- [ ] 100% of existing players can authenticate after migration
- [ ] No loss of player match history or statistics
- [ ] Authentication works with both legacy (during transition) and new identities
- [ ] Users can link multiple auth providers to one account
- [ ] Tenant data isolation verified via database queries
- [ ] Migration completes with <1% requiring manual intervention
- [ ] API response times remain within 10% of baseline
- [ ] Zero-downtime deployment achieved

## Notes

### Alternative Approaches Considered

- **Single Identity Table**: Simpler but doesn't support multiple providers per user
- **Tenant Column on Player**: Simpler but doesn't support user roles or access control
- **Keep identity_user_id**: No path forward for multi-tenancy or provider flexibility

### Open Questions

1. **Default Tenant Strategy**: Create one global tenant for existing players, or per-organization?
2. **Tenant Discovery**: How do users find and join tenants? Invitation-only vs public directory?
3. **Player Cardinality**: Allow multiple players per user per tenant (smurf accounts)?
4. **Cross-Tenant Features**: Should users have a global profile/achievements across tenants?
5. **Personal Access Token Scope**: Scoped to User (cross-tenant) or TenantMembership?

### References

- PR #174: Migrate authentication from Supabase to Clerk
- [Multi-Tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/multi-tenancy)
- [Identity Linking Best Practices](https://auth0.com/docs/manage-users/user-accounts/user-account-linking)

## Decision

We will proceed with implementing the Multi-Tenant Identity Architecture as described above, beginning with Phase 1 schema changes coordinated with the Clerk migration in PR #174.

---

**Date**: 2025-10-12
**Deciders**: Engineering Team
**Next Review**: After Phase 3 completion (migration testing)
