using System.Net;

namespace MMRProject.Api.Exceptions;

public class GoneException(string message) : Exception(message), IHttpException
{
    public HttpStatusCode StatusCode => HttpStatusCode.Gone;
    public string Title => "Gone";
}
