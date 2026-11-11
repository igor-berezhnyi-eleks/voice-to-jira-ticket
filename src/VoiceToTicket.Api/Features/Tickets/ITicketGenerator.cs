using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Features.Tickets;

public interface ITicketGenerator
{
    /// <param name="requestedType">The type the reporter chose (decision D16); null lets the generator decide.</param>
    Task<GenerationResult> GenerateAsync(string transcript, CancellationToken cancellationToken, TicketType? requestedType = null);
}
