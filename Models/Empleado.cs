using System.ComponentModel.DataAnnotations;

namespace Organigrama.Models
{
    public class Empleado
    {
        [Key]
        public int Id { get; set; }
        public int? JefeId { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Puesto { get; set; } = string.Empty;
        public string Area { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? CvUrl { get; set; }
        public string? Foto { get; set; }
        // Propiedad calculada para el JS (opcional)
        public bool HasSubordinates { get; set; }
    }
}