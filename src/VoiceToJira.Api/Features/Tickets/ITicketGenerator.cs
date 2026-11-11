namespace VoiceToJira.Api.Features.Tickets;

public interface ITicketGenerator
{
    // Returns a validated ticket with MissingInformation filled, or throws TicketGenerationException.
    Task<Ticket> GenerateAsync(string transcript, CancellationToken cancellationToken);
}

public enum TicketGenerationError
{
    NotConfigured,
    Refused,
    Truncated,
    InvalidOutput,
    Unavailable,
    Timeout,
}

public sealed class TicketGenerationException(TicketGenerationError error, string message, Exception? inner = null)
    : Exception(message, inner)
{
    public TicketGenerationError Error { get; } = error;
}
