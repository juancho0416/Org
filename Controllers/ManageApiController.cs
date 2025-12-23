using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Organigrama.Data;
using Organigrama.Models;

namespace Organigrama.Controllers
{
    [ApiController]
    [Route("api/manage")]
    public class ManageApiController : ControllerBase
    {
        private readonly AppDbContext _db;

        public ManageApiController(AppDbContext db)
        {
            _db = db;
        }

        public class UpdateManagerDto
        {
            public int EmployeeId { get; set; }
            public int? ManagerId { get; set; }
        }

        [HttpPost("update-manager")]
        public async Task<IActionResult> UpdateManager([FromBody] UpdateManagerDto dto)
        {
            if (dto == null) return BadRequest(new { success = false, message = "Payload inválido" });

            var emp = await _db.Empleados.FindAsync(dto.EmployeeId);
            if (emp == null) return NotFound(new { success = false, message = "Empleado no encontrado" });

            if (dto.ManagerId.HasValue && dto.ManagerId.Value == emp.Id)
                return BadRequest(new { success = false, message = "Un empleado no puede ser su propio jefe." });

            // Detect cycles
            if (dto.ManagerId.HasValue)
            {
                var visited = new HashSet<int>();
                var current = dto.ManagerId.Value;
                while (true)
                {
                    if (current == emp.Id) return BadRequest(new { success = false, message = "Asignación inválida: crea un ciclo." });
                    if (visited.Contains(current)) return BadRequest(new { success = false, message = "Asignación inválida." });
                    visited.Add(current);

                    var mgr = await _db.Empleados.AsNoTracking().FirstOrDefaultAsync(e => e.Id == current);
                    if (mgr == null) break;
                    if (!mgr.JefeId.HasValue) break;
                    current = mgr.JefeId.Value;
                }
            }

            emp.JefeId = dto.ManagerId;
            _db.Empleados.Update(emp);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, message = "Jefe actualizado correctamente." });
        }
    }
}
