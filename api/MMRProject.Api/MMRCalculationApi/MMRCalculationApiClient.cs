using MMRProject.Api.MMRCalculationApi.Models;

namespace MMRProject.Api.MMRCalculationApi;

public interface IMMRCalculationApiClient
{
    Task<MMRCalculationResponse> CalculateMMRAsync(MMRCalculationRequest request);
    Task<List<MMRCalculationResponse>> CalculateMMRBatchAsync(List<MMRCalculationRequest> requests);
    Task<GenerateTeamsResponse> GenerateTeamsAsync(GenerateTeamsRequest request);
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

    public async Task<List<MMRCalculationResponse>> CalculateMMRBatchAsync(List<MMRCalculationRequest> requests)
    {
        var response = await httpClient.PostAsJsonAsync("api/v1/mmr-calculation/batch", requests);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<List<MMRCalculationResponse>>();
        if (result == null)
        {
            // TODO: Better exception
            throw new Exception("Failed to deserialize response");
        }

        return result;
    }

    public async Task<GenerateTeamsResponse> GenerateTeamsAsync(GenerateTeamsRequest request)
    {
        var response = await httpClient.PostAsJsonAsync("api/v1/generate-teams", request);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<GenerateTeamsResponse>();
        if (result == null)
        {
            throw new Exception("Failed to deserialize response");
        }

        return result;
    }
}
