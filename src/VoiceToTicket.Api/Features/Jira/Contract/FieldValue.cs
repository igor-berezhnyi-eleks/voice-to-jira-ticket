using System.Text.Json.Serialization;

namespace VoiceToTicket.Api.Features.Jira.Contract;

/// <summary>
/// A typed value for one Jira field on create (jira-plan 4.3). The discriminator is <c>kind</c>; the generated
/// TypeScript must be a union of these shapes. J3 turns each case into Jira's JSON.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind", UnknownDerivedTypeHandling = JsonUnknownDerivedTypeHandling.FailSerialization)]
[JsonDerivedType(typeof(TextFieldValue), "text")]
[JsonDerivedType(typeof(TextareaFieldValue), "textarea")]
[JsonDerivedType(typeof(NumberFieldValue), "number")]
[JsonDerivedType(typeof(DateFieldValue), "date")]
[JsonDerivedType(typeof(OptionFieldValue), "option")]
[JsonDerivedType(typeof(OptionsFieldValue), "options")]
[JsonDerivedType(typeof(LabelsFieldValue), "labels")]
public abstract record FieldValue;

public sealed record TextFieldValue(string Value) : FieldValue;

public sealed record TextareaFieldValue(string Value) : FieldValue;

public sealed record NumberFieldValue(double Value) : FieldValue;

/// <summary><c>YYYY-MM-DD</c>.</summary>
public sealed record DateFieldValue(string Value) : FieldValue;

public sealed record OptionFieldValue(string Id) : FieldValue;

public sealed record OptionsFieldValue(string[] Ids) : FieldValue;

public sealed record LabelsFieldValue(string[] Values) : FieldValue;
