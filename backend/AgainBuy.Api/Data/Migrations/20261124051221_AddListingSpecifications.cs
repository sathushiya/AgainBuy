using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgainBuy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddListingSpecifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing listings start with no specifications ("" would not be valid jsonb).
            migrationBuilder.AddColumn<string>(
                name: "Specifications",
                table: "Products",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Specifications",
                table: "Products");
        }
    }
}
