using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Organigrama.Data;
using Organigrama.Models;
using ClosedXML.Excel;
using System.Globalization;

namespace Organigrama.Pages
{
    public class AgendaModel : PageModel
    {
        ///Dependencias
        private readonly AppDbContext _context;
        private readonly ILogger<AgendaModel> _logger;

        // Paleta de colores sincronizada con el sistema
        private static readonly (string Primary, string Secondary)[] _areaColors = new[]
        {
            ("#5A67D8", "#EEF0FA"),  // Azul Real (por defecto)
            ("#805AD5", "#FAF5FF"),  // Púrpura
            ("#38A169", "#F0FFF4"),  // Verde
            ("#00B5D8", "#E6FFFA"),  // Cyan
            ("#DD6B20", "#FFFAF0"),  // Naranja
            ("#D53F8C", "#FFF5F7"),  // Rosa
            ("#44337A", "#F3F0FF"),  // Púrpura Oscuro
            ("#9C4221", "#FFFAF0")   // Marrón
        };

        public AgendaModel(AppDbContext context, ILogger<AgendaModel> logger)
        {
            _context = context;
            _logger = logger;
        }

        ///Propiedades publicas

        ///Id del empleado actual
        public int EmpleadoId { get; set; }

        /// Nombre Completo del empleado


        public string NombreEmpleado { get; set; } = string.Empty;

        /// Área del empleado (para colores)
        public string AreaEmpleado { get; set; } = string.Empty;


        /// Lista de todas las actividades del empleado
        public List<Actividad> ListaActividades { get; set; } = new();
        /// Nueva actividad a registrar (binding desde formulario)

        [BindProperty]
        public string? NuevaActividad { get; set; }

        // MÉTODOS DE UTILIDAD

        /// Obtiene los colores del área del empleado
        public (string Primary, string Secondary) GetAreaColors()
        {
            if (string.IsNullOrWhiteSpace(AreaEmpleado) || AreaEmpleado == "N/A")
            {
                return _areaColors[0];
            }

            // Generar color consistente usando hash
            var hash = 0;
            foreach (var c in AreaEmpleado.ToUpperInvariant())
            {
                hash = ((hash << 5) - hash) + c;
            }

            var index = Math.Abs(hash) % _areaColors.Length;
            return _areaColors[index];
        }

        // HANDLERS DE PÁGINA

        /// Handler GET - Carga la agenda del empleado
        public async Task<IActionResult> OnGetAsync(int id)
        {
            // Validación de parámetro
            if (id <= 0)
            {
                _logger.LogWarning("Intento de acceso a agenda con ID inválido: {Id}", id);
                TempData["Error"] = "ID de empleado inválido";
                return RedirectToPage("/Index");
            }

            try
            {
                EmpleadoId = id;

                // Cargar empleado
                var empleado = await LoadEmpleadoAsync(id);

                if (empleado == null)
                {
                    _logger.LogWarning("Empleado no encontrado: {Id}", id);
                    TempData["Error"] = "Empleado no encontrado";
                    return RedirectToPage("/Index");
                }

                NombreEmpleado = empleado.Nombre ?? "Sin nombre";
                AreaEmpleado = empleado.Area ?? "N/A";

                // Cargar actividades
                ListaActividades = await LoadActividadesAsync(id);

                _logger.LogInformation(
                    "Agenda cargada para empleado {Id} - {Nombre}: {Count} actividades",
                    id,
                    NombreEmpleado,
                    ListaActividades.Count
                );

                return Page();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al cargar agenda del empleado {Id}", id);
                TempData["Error"] = "Error al cargar la agenda";
                return RedirectToPage("/Index");
            }
        }

        /// Handler POST - Registra una nueva actividad
        public async Task<IActionResult> OnPostAsync(int id)
        {
            // Validaciones
            if (id <= 0)
            {
                _logger.LogWarning("Intento de crear actividad con ID inválido: {Id}", id);
                TempData["Error"] = "ID de empleado inválido";
                return RedirectToPage(new { id });
            }

            // Validar descripción
            if (string.IsNullOrWhiteSpace(NuevaActividad))
            {
                TempData["Error"] = "La descripción de la actividad no puede estar vacía";
                return RedirectToPage(new { id });
            }

            // Normalizar texto
            var descripcionNormalizada = NuevaActividad.Trim();

            // Validar longitud
            if (descripcionNormalizada.Length < 3)
            {
                TempData["Error"] = "La descripción debe tener al menos 3 caracteres";
                return RedirectToPage(new { id });
            }

            if (descripcionNormalizada.Length > 500)
            {
                TempData["Error"] = "La descripción no puede superar los 500 caracteres";
                return RedirectToPage(new { id });
            }

            try
            {
                // Verificar que el empleado existe
                var empleadoExists = await _context.Empleados.AnyAsync(e => e.Id == id);
                if (!empleadoExists)
                {
                    _logger.LogWarning("Intento de crear actividad para empleado inexistente: {Id}", id);
                    TempData["Error"] = "Empleado no encontrado";
                    return RedirectToPage("/Index");
                }

                // Crear actividad
                var actividad = new Actividad
                {
                    EmpleadoId = id,
                    Descripcion = descripcionNormalizada,
                    Fecha = DateTime.Now
                };

                _context.Actividades.Add(actividad);
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "Actividad creada: Empleado {EmpleadoId}, Descripción: {Descripcion}",
                    id,
                    descripcionNormalizada
                );

                TempData["Success"] = "Actividad registrada correctamente";
                TempData["NewActivity"] = "true"; // Para scroll automático
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear actividad para empleado {Id}", id);
                TempData["Error"] = "Error al registrar la actividad";
            }

            return RedirectToPage(new { id });
        }
        /// Handler POST - Elimina una actividad
        public async Task<IActionResult> OnPostEliminarAsync(int actividadId, int empleadoId)
        {
            // Validaciones
            if (actividadId <= 0 || empleadoId <= 0)
            {
                _logger.LogWarning(
                    "Intento de eliminar actividad con IDs inválidos: Actividad={ActividadId}, Empleado={EmpleadoId}",
                    actividadId,
                    empleadoId
                );
                TempData["Error"] = "Parámetros inválidos";
                return RedirectToPage(new { id = empleadoId });
            }

            try
            {
                // Buscar actividad
                var actividad = await _context.Actividades
                    .FirstOrDefaultAsync(a => a.Id == actividadId && a.EmpleadoId == empleadoId);

                if (actividad == null)
                {
                    _logger.LogWarning("Actividad no encontrada: {ActividadId}", actividadId);
                    TempData["Error"] = "Actividad no encontrada";
                    return RedirectToPage(new { id = empleadoId });
                }

                // Guardar descripción para log
                var descripcion = actividad.Descripcion;

                // Eliminar
                _context.Actividades.Remove(actividad);
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "Actividad eliminada: Id={Id}, Empleado={EmpleadoId}, Descripción={Descripcion}",
                    actividadId,
                    empleadoId,
                    descripcion
                );

                TempData["Success"] = "Actividad eliminada correctamente";
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error al eliminar actividad {ActividadId} del empleado {EmpleadoId}",
                    actividadId,
                    empleadoId
                );
                TempData["Error"] = "Error al eliminar la actividad";
            }

            return RedirectToPage(new { id = empleadoId });
        }

        /// <summary>
        /// Handler GET - Exporta la agenda a Excel
        /// </summary>
        public async Task<IActionResult> OnGetExportarExcelAsync(int id)
        {
            if (id <= 0)
            {
                _logger.LogWarning("Intento de exportar Excel con ID inválido: {Id}", id);
                TempData["Error"] = "ID de empleado inválido";
                return RedirectToPage(new { id });
            }

            try
            {
                // Cargar datos
                var empleado = await LoadEmpleadoAsync(id);
                if (empleado == null)
                {
                    TempData["Error"] = "Empleado no encontrado";
                    return RedirectToPage("/Index");
                }

                var actividades = await LoadActividadesAsync(id);

                // Generar Excel
                var excelData = GenerateExcel(empleado, actividades);

                _logger.LogInformation(
                    "Excel exportado: Empleado {Id} - {Nombre}, {Count} actividades",
                    id,
                    empleado.Nombre,
                    actividades.Count
                );

                var fileName = $"Agenda_{SanitizeFileName(empleado.Nombre)}_{DateTime.Now:yyyyMMdd}.xlsx";
                return File(
                    excelData,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    fileName
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al exportar Excel para empleado {Id}", id);
                TempData["Error"] = "Error al generar el archivo Excel";
                return RedirectToPage(new { id });
            }
        }

        // ============================================
        // MÉTODOS PRIVADOS DE DATOS
        // ============================================

        /// <summary>
        /// Carga un empleado desde la base de datos
        /// </summary>
        private async Task<Empleado?> LoadEmpleadoAsync(int id)
        {
            return await _context.Empleados
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == id);
        }

        /// <summary>
        /// Carga las actividades de un empleado
        /// </summary>
        private async Task<List<Actividad>> LoadActividadesAsync(int empleadoId)
        {
            return await _context.Actividades
                .AsNoTracking()
                .Where(a => a.EmpleadoId == empleadoId)
                .OrderByDescending(a => a.Fecha)
                .ToListAsync();
        }

        // ============================================
        // GENERACIÓN DE EXCEL
        // ============================================

        /// <summary>
        /// Genera el archivo Excel con las actividades
        /// </summary>
        private byte[] GenerateExcel(Empleado empleado, List<Actividad> actividades)
        {
            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Actividades");

            // Configurar cultura para español
            var culture = new CultureInfo("es-MX");

            // === ENCABEZADO ===
            worksheet.Cell(1, 1).Value = "AGENDA DE ACTIVIDADES";
            worksheet.Cell(1, 1).Style
                .Font.SetBold(true)
                .Font.SetFontSize(16)
                .Fill.SetBackgroundColor(XLColor.FromArgb(90, 103, 216));
            worksheet.Cell(1, 1).Style.Font.FontColor = XLColor.White;
            worksheet.Range("A1:D1").Merge();

            // === INFORMACIÓN DEL EMPLEADO ===
            worksheet.Cell(3, 1).Value = "Empleado:";
            worksheet.Cell(3, 1).Style.Font.SetBold(true);
            worksheet.Cell(3, 2).Value = empleado.Nombre;

            worksheet.Cell(4, 1).Value = "Área:";
            worksheet.Cell(4, 1).Style.Font.SetBold(true);
            worksheet.Cell(4, 2).Value = empleado.Area ?? "N/A";

            worksheet.Cell(5, 1).Value = "Fecha de exportación:";
            worksheet.Cell(5, 1).Style.Font.SetBold(true);
            worksheet.Cell(5, 2).Value = DateTime.Now.ToString("dd/MM/yyyy HH:mm", culture);

            worksheet.Cell(6, 1).Value = "Total de actividades:";
            worksheet.Cell(6, 1).Style.Font.SetBold(true);
            worksheet.Cell(6, 2).Value = actividades.Count;

            // === ENCABEZADOS DE TABLA ===
            var headerRow = 8;
            worksheet.Cell(headerRow, 1).Value = "#";
            worksheet.Cell(headerRow, 2).Value = "Fecha";
            worksheet.Cell(headerRow, 3).Value = "Hora";
            worksheet.Cell(headerRow, 4).Value = "Descripción";

            var headerRange = worksheet.Range($"A{headerRow}:D{headerRow}");
            headerRange.Style
                .Font.SetBold(true)
                .Fill.SetBackgroundColor(XLColor.FromArgb(238, 240, 250))
                .Border.SetOutsideBorder(XLBorderStyleValues.Thin);

            // === DATOS ===
            var currentRow = headerRow + 1;
            var counter = 1;

            foreach (var actividad in actividades.OrderByDescending(a => a.Fecha))
            {
                worksheet.Cell(currentRow, 1).Value = counter++;
                worksheet.Cell(currentRow, 2).Value = actividad.Fecha.ToString("dd/MM/yyyy", culture);
                worksheet.Cell(currentRow, 3).Value = actividad.Fecha.ToString("HH:mm");
                worksheet.Cell(currentRow, 4).Value = actividad.Descripcion;

                // Aplicar formato de filas alternadas
                if (counter % 2 == 0)
                {
                    worksheet.Range($"A{currentRow}:D{currentRow}")
                        .Style.Fill.SetBackgroundColor(XLColor.FromArgb(249, 250, 251));
                }

                currentRow++;
            }

            // FORMATO FINAL
            // Ajustar columnas
            worksheet.Column(1).Width = 20;  // #
            worksheet.Column(2).Width = 15; // Fecha
            worksheet.Column(3).Width = 10; // Hora
            worksheet.Column(4).Width = 60; // Descripción
            worksheet.Column(4).Style.Alignment.WrapText = true;

            // Bordes a toda la tabla
            if (actividades.Any())
            {
                var dataRange = worksheet.Range($"A{headerRow}:D{currentRow - 1}");
                dataRange.Style.Border.SetOutsideBorder(XLBorderStyleValues.Medium);
                dataRange.Style.Border.SetInsideBorder(XLBorderStyleValues.Thin);
            }

            // Pie de página
            var footerRow = currentRow + 2;
            worksheet.Cell(footerRow, 1).Value = $"Generado el {DateTime.Now:dd/MM/yyyy} a las {DateTime.Now:HH:mm}";
            worksheet.Cell(footerRow, 1).Style.Font.SetItalic(true).Font.FontColor = XLColor.Gray;
            worksheet.Range($"A{footerRow}:D{footerRow}").Merge();

            // Guardar en memoria
            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }
        ///Sanitiza un nombre de archivo removiendo caracteres invalidos
        private string SanitizeFileName(string? fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
                return "Agenda";

            var invalid = Path.GetInvalidFileNameChars();
            var sanitized = new string(fileName
                .Where(c => !invalid.Contains(c))
                .ToArray());

            return string.IsNullOrWhiteSpace(sanitized) ? "Agenda" : sanitized;
        }
    }
}