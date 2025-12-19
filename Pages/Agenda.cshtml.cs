using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Organigrama.Data;
using Organigrama.Models;
using ClosedXML.Excel;
using System.Security.Cryptography.X509Certificates;
using System.Runtime.CompilerServices;
using System.Diagnostics.Tracing;
using System.Text;

namespace Organigrama.Pages
{
    public class AgendaModel : PageModel
    {
        private readonly AppDbContext _context;
        public AgendaModel(AppDbContext context) { _context = context; }

        [BindProperty]
        public string NuevaActividad { get; set; }
        public int EmpleadoId { get; set; }
        public string NombreEmpleado { get; set; }
        public List<Actividad> ListaActividades { get; set; }

        public async Task<IActionResult> OnGetAsync(int id)
        {
            EmpleadoId = id;
            // 2. Intentar obtener el empleado
            var emp = await _context.Empleados.FirstOrDefaultAsync(e => e.Id == id);

            NombreEmpleado = emp.Nombre;

            ListaActividades = await _context.Actividades
                .Where(a => a.EmpleadoId == id)
                .OrderByDescending(a => a.Fecha)
                .ToListAsync();

            return Page();
        }

        public async Task<IActionResult> OnPostAsync(int id)
        {
            if (!string.IsNullOrWhiteSpace(NuevaActividad))
            {
                var actividad = new Actividad
                {
                    EmpleadoId = id,
                    Descripcion = NuevaActividad,
                    Fecha = DateTime.Now
                };
                _context.Actividades.Add(actividad);
                await _context.SaveChangesAsync();
            }
            return RedirectToPage(new { id = id });
        }
        public async Task<IActionResult> OnPostEliminarAsync(int actividadId, int empleadoId)
        {
            // Buscamos la actividad directamente por su Id
            var actividad = await _context.Actividades.FindAsync(actividadId);

            if (actividad != null)
            {
                _context.Actividades.Remove(actividad);
                await _context.SaveChangesAsync();
            }

            // Redirigimos de vuelta a la agenda del empleado
            return RedirectToPage(new { id = empleadoId });
        }


        public async Task<IActionResult> OnGetExportarExcel(int id)
        {
            var emp = await _context.Empleados.FirstOrDefaultAsync(e => e.Id == id);
            var actividades = await _context.Actividades
                .Where(a => a.EmpleadoId == id)
                .OrderByDescending(a => a.Fecha)
                .ToListAsync();

            using (var workbook = new XLWorkbook())
            {
                var worksheet = workbook.Worksheets.Add("Actividades");
                worksheet.Cell(1, 1).Value = "Empleado:";
                worksheet.Cell(1, 2).Value = emp?.Nombre;

                // Encabezados
                worksheet.Cell(3, 1).Value = "Fecha";
                worksheet.Cell(3, 2).Value = "Descripción";
                worksheet.Range("A3:B3").Style.Font.Bold = true;

                // Datos
                for (int i = 0; i < actividades.Count; i++)
                {
                    worksheet.Cell(i + 4, 1).Value = actividades[i].Fecha.ToString("dd/MM/yyyy HH:mm");
                    worksheet.Cell(i + 4, 2).Value = actividades[i].Descripcion;
                }

                worksheet.Columns().AdjustToContents();

                using (var stream = new MemoryStream())
                {
                    workbook.SaveAs(stream);
                    var content = stream.ToArray();
                    return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Agenda_{emp?.Nombre}.xlsx");
                }
            }
        }
    }
}
