using System.Net;

namespace MMRProject.Api.Exceptions;

public interface IHttpException
{
    public HttpStatusCode StatusCode { get; }
    public string Title { get; }
    public string Message { get; }
}