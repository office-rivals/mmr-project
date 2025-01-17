using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public class ActiveMatchSubmitRequest
{
    [Required]
    public int Team1Score { get; set; }

    [Required]
    public int Team2Score { get; set; }
}