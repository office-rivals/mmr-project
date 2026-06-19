// Aspire AppHost: the single local-development entry point for the whole stack.
// Run with `dotnet run --project local-dev/MMRProject.AppHost`.
//
// One source of truth for the api <-> mmr-api shared secret, Postgres wired via
// service discovery, and Clerk values supplied as parameters (placeholders by
// default so the stack boots with a single command). See local-dev/README.md.

var builder = DistributedApplication.CreateBuilder(args);

// --- Parameters --------------------------------------------------------------

// Config-backed parameter with a dev fallback. The plain AddParameter(name, value)
// overload binds a *literal* constant and never reads configuration, so
// `dotnet user-secrets set Parameters:<name> ...` would be silently ignored. Reading
// Configuration[$"Parameters:{name}"] first makes user-secrets (and any other config
// source) win, while the fallback keeps first run a single command.
IResourceBuilder<ParameterResource> Param(string name, string fallback, bool secret = false) =>
    builder.AddParameter(name, () => builder.Configuration[$"Parameters:{name}"] ?? fallback, secret: secret);

// The api and mmr-api authenticate with a SHARED secret. Injecting one parameter
// into both (api's Admin:Secret + MMRCalculationAPI:ApiKey, mmr-api's ADMIN_SECRET)
// makes it impossible for them to drift. Dev default keeps first run one command;
// override via `dotnet user-secrets set Parameters:admin-secret <value>`.
var adminSecret = Param("admin-secret", "super-secret-admin", secret: true);

// Stable Postgres password so a persisted data volume keeps working across
// restarts. Matches the repo's established local password (docker-compose.e2e.yml,
// scripts/seed-local.sh) so the seed/inspect tooling works unchanged.
var postgresPassword = Param("postgres-password", "this_is_a_hard_password1337", secret: true);

// Clerk auth. Placeholders let the stack start; set real values via AppHost
// user-secrets (Parameters:clerk-*) to actually sign in (see local-dev/README.md).
// The publishable key is a valid-format placeholder (decodes to
// example.clerk.accounts.dev) so Clerk's SDK parses it and SSR renders the
// sign-in page rather than erroring.
var clerkPublishableKey = Param("clerk-publishable-key", "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk");
var clerkSecretKey = Param("clerk-secret-key", "sk_test_placeholder", secret: true);
var clerkIssuer = Param("clerk-issuer", "https://example.clerk.accounts.dev");

// --- Postgres ----------------------------------------------------------------

// Pinned to the standard host port 5432 so the api's appsettings default and the
// seed/inspect tooling (which assume localhost:5432) keep working as-is.
var postgres = builder
    .AddPostgres("postgres", password: postgresPassword, port: 5432)
    .WithDataVolume(); // persist dev data across runs

// Resource name "ApiDbContext" => the api receives ConnectionStrings__ApiDbContext.
// Actual database on the server is "mmr_project".
var database = postgres.AddDatabase("ApiDbContext", "mmr_project");

// --- MMR API (Go) ------------------------------------------------------------

#pragma warning disable CS0618 // AddGolangApp obsolete; Aspire.Hosting.Go is preview-only (see csproj).
var mmrApi = builder.AddGolangApp("mmr-api", "../../mmr-api")
#pragma warning restore CS0618
    .WithHttpEndpoint(env: "MMR_API_PORT") // Aspire allocates the port and injects it
    .WithEnvironment("ADMIN_SECRET", adminSecret)
    .WithHttpHealthCheck("/health") // existing probe (also the mmr-api-prod Container App's)
    // The Go service uses OTLP/HTTP exporters (otlptracehttp/...), which ignore
    // OTEL_EXPORTER_OTLP_PROTOCOL and always POST http/protobuf. Force the http
    // endpoint so traces/metrics/logs reach the Aspire dashboard.
    .WithOtlpExporter(OtlpProtocol.HttpProtobuf);

// --- API (ASP.NET Core) ------------------------------------------------------

// Startup is gated only on the database (EF migrations run at boot). The api
// talks to mmr-api lazily on request paths, so its base URL resolves without
// waiting for mmr-api to be healthy — letting the two start in parallel.
var api = builder.AddProject<Projects.MMRProject_Api>("api", launchProfileName: "http")
    .WithReference(database).WaitFor(database)
    .WithEnvironment("Admin__Secret", adminSecret)
    .WithEnvironment("MMRCalculationAPI__ApiKey", adminSecret)
    .WithEnvironment("MMRCalculationAPI__BaseUrl", mmrApi.GetEndpoint("http"))
    .WithEnvironment("Authorization__Issuer", clerkIssuer)
    // Gate dependents on readiness (DB reachable), not bare liveness.
    .WithHttpHealthCheck("/ready")
    // Pin OTLP to http/protobuf (same as mmr-api). The api otherwise defaults to
    // gRPC, whose per-request dashboard API key isn't forwarded through the DCP
    // proxy in this setup, so its telemetry would be rejected. The HTTP endpoint
    // forwards the key header correctly.
    .WithOtlpExporter(OtlpProtocol.HttpProtobuf);

// --- Frontend (SvelteKit / Vite) --------------------------------------------

builder.AddViteApp("frontend", "../../frontend")
    .WithNpm() // npm package manager + install on first run
    .WaitFor(api)
    // Lets vite.config.ts force a clean dep pre-bundle only under Aspire, where a
    // mid-request re-optimize otherwise crashes esbuild with write EPIPE.
    .WithEnvironment("ASPIRE_MANAGED", "true")
    .WithEnvironment("API_BASE_PATH", api.GetEndpoint("http"))
    .WithEnvironment("PUBLIC_CLERK_PUBLISHABLE_KEY", clerkPublishableKey)
    .WithEnvironment("CLERK_SECRET_KEY", clerkSecretKey)
    .WithExternalHttpEndpoints();

builder.Build().Run();
