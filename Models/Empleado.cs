using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema; // <--- NECESARIO

namespace Organigrama.Models
{
    [Table("Empleado")]
    public class Empleado
    {
        [Key]
        public int Id { get; set; }
        public int? JefeId { get; set; }
        public string Nombre { get; set; }
        public string Puesto { get; set; }
        public string Area { get; set; }
        public string Email { get; set; }
        public string Foto { get; set; }
        public string CvUrl { get; set; }
    }
}