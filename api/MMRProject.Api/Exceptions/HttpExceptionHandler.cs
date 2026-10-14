using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MMRProject.Api.Exceptions;

internal sealed class HttpExceptionHandler(ILogger<HttpExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var httpException = exception switch
        {
            IHttpException knownException => knownException,
            Exception deadlock when ContainsPostgresDeadlock(deadlock) => new ConflictException(
                "The request conflicted with another update. Reload and retry."),
            DbUpdateConcurrencyException => new ConflictException(
                "The resource changed during this request. Reload it and retry."),
            _ => null,
        };

        if (httpException == null)
        {
            return false;
        }

        logger.LogError(exception, "Exception occurred: {Message}", exception.Message);

        var problemDetails = new ProblemDetails
        {
            Status = (int)httpException.StatusCode,
            Title = httpException.Title,
            Detail = httpException.Message
        };

        httpContext.Response.StatusCode = problemDetails.Status.Value;

        await httpContext.Response
            .WriteAsJsonAsync(problemDetails, cancellationToken);

        return true;
    }

    private static bool ContainsPostgresDeadlock(Exception exception)
    {
        for (var current = exception; current != null; current = current.InnerException)
        {
            if (current is PostgresException { SqlState: PostgresErrorCodes.DeadlockDetected })
                return true;
        }

        return false;
    }
}
