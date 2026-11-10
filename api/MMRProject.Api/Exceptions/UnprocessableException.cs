using System.Net;

namespace MMRProject.Api.Exceptions;

public class UnprocessableException(string message) : Exception(message), IHttpException
{
    public HttpStatusCode StatusCode => HttpStatusCode.UnprocessableEntity;
    public string Title => "Unprocessable";
}
