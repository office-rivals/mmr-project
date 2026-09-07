using System.Net;

namespace MMRProject.Api.Exceptions;

public class ConflictException(string message) : Exception(message), IHttpException
{
    public HttpStatusCode StatusCode => HttpStatusCode.Conflict;
    public string Title => "Conflict";
}
