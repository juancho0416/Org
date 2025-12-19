// Archivo: Models/Actividad.cs
using System;
using System.ComponentModel.DataAnnotations;

namespace Organigrama.Models
{
    // Models/Actividad.cs
    public class Actividad
    {
        public int Id { get; set; }
        public int EmpleadoId { get; set; } // Se relacionará con el Id de tu tabla Empleado
        public string Descripcion { get; set; }
        public DateTime Fecha { get; set; }
    }
}