using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;

namespace AgainBuy.Api.Tests;

public class SupportTicketTests
{
    [Fact]
    public async Task Users_send_support_requests_and_see_only_their_own()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();
        var other = await factory.SignedInClient(SeedData.DemoBuyerEmail, SeedData.DemoBuyerPassword);

        var response = await customer.PostAsJsonAsync("/api/support/tickets", new { type = "problem", subject = "Photos won't upload", message = "Uploading from my phone fails every time." });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var ticket = await response.Read<SupportTicketDto>();
        Assert.Equal(SupportTicketType.Problem, ticket.Type);
        Assert.Equal(SupportTicketStatus.Open, ticket.Status);
        Assert.StartsWith("SUP-", ticket.Id);

        Assert.Equal(ticket.Id, Assert.Single(await (await customer.GetAsync("/api/support/tickets")).Read<List<SupportTicketDto>>()).Id);
        Assert.Empty(await (await other.GetAsync("/api/support/tickets")).Read<List<SupportTicketDto>>());
    }

    [Fact]
    public async Task Support_requests_need_a_type_subject_and_real_message()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/support/tickets", new { subject = "Help", message = "Something went wrong here." })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/support/tickets", new { type = "contact", subject = "Hi", message = "Short" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsJsonAsync("/api/support/tickets", new { type = "contact", subject = "Question", message = "How do refunds work here?" })).StatusCode);
    }
}
