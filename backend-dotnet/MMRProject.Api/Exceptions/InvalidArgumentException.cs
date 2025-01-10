using System.Net;

namespace MMRProject.Api.Exceptions;

public class InvalidArgumentException(string message) : Exception(message), IHttpException
{
    public HttpStatusCode StatusCode => HttpStatusCode.BadRequest;
    public string Title => "Bad Request";
}