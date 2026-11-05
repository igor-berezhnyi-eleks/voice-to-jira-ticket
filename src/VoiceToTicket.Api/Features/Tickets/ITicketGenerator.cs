namespace VoiceToTicket.Api.Features.Tickets;

public interface ITicketGenerator
{
    Task<GenerationResult> GenerateAsync(string transcript, CancellationToken cancellationToken);
}
