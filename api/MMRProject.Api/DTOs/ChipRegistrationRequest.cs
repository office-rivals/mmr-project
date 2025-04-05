namespace MMRProject.Api.DTOs;

public class ChipRegistrationRequest
{
    public string ChipId { get; set; } = "";
    public int[] ColorCode { get; set; } = [];
}
