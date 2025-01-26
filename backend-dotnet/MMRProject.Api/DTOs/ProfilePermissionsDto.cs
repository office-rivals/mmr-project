using System.Text.Json.Serialization;

namespace MMRProject.Api.DTOs;

public class ProfilePermissionsDto
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? IsAdmin { get; set; }
}