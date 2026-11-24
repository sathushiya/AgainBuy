using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgainBuy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryOrPickupWithCourier : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Courier",
                table: "Products",
                type: "text",
                nullable: true);

            // "Both" is no longer offered; those listings did offer delivery. The
            // seller chooses a courier when they ship.
            migrationBuilder.Sql("UPDATE \"Products\" SET \"Delivery\" = 'Delivery' WHERE \"Delivery\" = 'Both';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Courier",
                table: "Products");
        }
    }
}
