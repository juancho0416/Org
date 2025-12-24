using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Organigrama.Data;
using Organigrama.Models;
using Microsoft.EntityFrameworkCore;

namespace Organigrama.Pages
{
    public class ManageStructureModel : PageModel
    {
        private readonly AppDbContext _db;

        public ManageStructureModel(AppDbContext db)
        {
            _db = db;
        }
        private bool CreatesCycle(int employeeId, int newManagerId, List<Empleado> allEmployees)
        {
            var current = allEmployees.FirstOrDefault(e => e.Id == newManagerId);
            while (current != null)
            {
                if (current.Id == employeeId) return true;
                if (!current.JefeId.HasValue) break;
                current = allEmployees.FirstOrDefault(e => e.Id == current.JefeId);
            }
            return false;
        }
        public List<Empleado> Empleados { get; set; } = new();
        [BindProperty]
        public Empleado NewEmpleado { get; set; } = new();

        public async Task OnGetAsync()
        {
            Empleados = await _db.Empleados.OrderBy(e => e.Id).ToListAsync();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            Empleados = await _db.Empleados.OrderBy(e => e.Id).ToListAsync();

            var form = Request.Form;
            var updates = new List<Empleado>();

            foreach (var emp in Empleados)
            {
                var key = $"manager_{emp.Id}";
                if (!form.ContainsKey(key)) continue;

                var val = form[key].ToString();
                int? newManager = null;
                if (!string.IsNullOrWhiteSpace(val))
                {
                    if (int.TryParse(val, out var parsed)) newManager = parsed;
                }


                if (newManager.HasValue && newManager.Value == emp.Id)
                {
                    ModelState.AddModelError(string.Empty, $"Empleado {emp.Id} no puede ser su propio jefe.");
                    continue;
                }


                if (newManager.HasValue && CreatesCycle(emp.Id, newManager.Value).Result)
                {
                    ModelState.AddModelError(string.Empty, $"Asignación inválida para {emp.Nombre}: crea un ciclo.");
                    continue;
                }

                if (emp.JefeId != newManager)
                {
                    emp.JefeId = newManager;
                    updates.Add(emp);
                }
            }

            if (!ModelState.IsValid)
            {
                return Page();
            }

            if (updates.Any())
            {
                _db.Empleados.UpdateRange(updates);
                await _db.SaveChangesAsync();
                TempData["Message"] = "Estructura actualizada correctamente.";
            }

            return RedirectToPage();
        }

        public async Task<IActionResult> OnPostAddAsync()
        {
            Empleados = await _db.Empleados.OrderBy(e => e.Id).ToListAsync();

            if (string.IsNullOrWhiteSpace(NewEmpleado.Nombre))
            {
                ModelState.AddModelError(string.Empty, "El nombre es requerido.");
                return Page();
            }

            var emp = new Empleado
            {
                Nombre = NewEmpleado.Nombre,
                Puesto = NewEmpleado.Puesto,
                Area = NewEmpleado.Area,
                Email = NewEmpleado.Email,
                JefeId = NewEmpleado.JefeId
            };

            _db.Empleados.Add(emp);
            await _db.SaveChangesAsync();
            TempData["Message"] = "Empleado agregado correctamente.";
            return RedirectToPage();
        }

        public async Task<IActionResult> OnPostDeleteAsync(int id)
        {
            var emp = await _db.Empleados.FindAsync(id);
            if (emp == null) return NotFound();

            // Reasignar subordinados a sin jefe (null)
            var subs = await _db.Empleados.Where(e => e.JefeId == id).ToListAsync();
            foreach (var s in subs) s.JefeId = null;

            _db.Empleados.UpdateRange(subs);
            _db.Empleados.Remove(emp);
            await _db.SaveChangesAsync();

            TempData["Message"] = "Empleado eliminado correctamente (subordinados sin jefe).";
            return RedirectToPage();
        }

        private async Task<bool> CreatesCycle(int employeeId, int newManagerId)
        {
            var visited = new HashSet<int>();
            var current = newManagerId;
            while (true)
            {
                if (current == employeeId) return true;
                if (visited.Contains(current)) return true; // defensive
                visited.Add(current);

                var mgr = await _db.Empleados.AsNoTracking().FirstOrDefaultAsync(e => e.Id == current);
                if (mgr == null) break;
                if (!mgr.JefeId.HasValue) break;
                current = mgr.JefeId.Value;
            }
            return false;
        }
    }
}

