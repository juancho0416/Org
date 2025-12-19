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
            // MAPEOS MANUALES (Crucial ya que no hay migraciones)
            modelBuilder.Entity<Empleado>().ToTable("Empleado"); // Tu tabla se llama Empleado
            modelBuilder.Entity<Actividad>().ToTable("Actividades"); // Tu tabla se llama Actividades

            // Si tus columnas en SQL se llaman igual que tus propiedades en C#, 
            // no necesitas más configuración.
        }
    }
}