using System.Net;

namespace MMRProject.Api.Exceptions;

public class NotFoundException(string message) : Exception(message), IHttpException
{
    public HttpStatusCode StatusCode => HttpStatusCode.NotFound;
    public string Title => "Not Found";
}
