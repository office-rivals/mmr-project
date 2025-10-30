using System.Net;

namespace MMRProject.Api.Exceptions;

public class ForbiddenException(string message) : Exception(message), IHttpException
{
    public HttpStatusCode StatusCode => HttpStatusCode.Forbidden;
    public string Title => "Forbidden";
}
