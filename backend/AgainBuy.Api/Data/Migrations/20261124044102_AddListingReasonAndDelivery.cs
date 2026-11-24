using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgainBuy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddListingReasonAndDelivery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing listings are treated as meet-up only (the enum's stored name).
            migrationBuilder.AddColumn<string>(
                name: "Delivery",
                table: "Products",
                type: "text",
                nullable: false,
                defaultValue: "MeetUp");

            migrationBuilder.AddColumn<string>(
                name: "ReasonForSelling",
                table: "Products",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Delivery",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ReasonForSelling",
                table: "Products");
        }
    }
}
