using MMRProject.Api.MMRCalculationApi.Models;

namespace MMRProject.Api.MMRCalculationApi;

public interface IMMRCalculationApiClient
{
    Task<MMRCalculationResponse> CalculateMMRAsync(MMRCalculationRequest request);
}

public class MMRCalculationApiClient(HttpClient httpClient) : IMMRCalculationApiClient
{
    public async Task<MMRCalculationResponse> CalculateMMRAsync(MMRCalculationRequest request)
    {
        var response = await httpClient.PostAsJsonAsync("api/v1/mmr-calculation", request);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<MMRCalculationResponse>();
        if (result == null)
        {
            // TODO: Better exception
            throw new Exception("Failed to deserialize response");
        }

        return result;
    }
}