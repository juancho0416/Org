using Microsoft.EntityFrameworkCore;
using Organigrama.Models;

namespace Organigrama.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Empleado> Empleados { get; set; }
        public DbSet<Actividad> Actividades { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // MAPEOS MANUAL
            modelBuilder.Entity<Empleado>().ToTable("Empleado");
            modelBuilder.Entity<Actividad>().ToTable("Actividades");

        }
    }
}