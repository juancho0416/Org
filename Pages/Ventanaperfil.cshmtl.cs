using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Data.Sqlite;
using Dapper;
using Organigrama.Models;

namespace Organigrama.Pages
{
    /// <summary>
    /// Modelo de página para la visualización y gestión del perfil de empleado
    /// Optimizado con mejor manejo de errores y validaciones
    /// </summary>
    public class VentanaperfilModel : PageModel
    {
        // ============================================
        // CONSTANTES Y CONFIGURACIÓN
        // ============================================
        private readonly string _connectionString = "Data Source=Organigrama.db";

        // Paleta de colores sincronizada con el sistema de diseño
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

        // ============================================
        // PROPIEDADES PÚBLICAS
        // ============================================

        /// <summary>
        /// Empleado actual
        /// </summary>
        public Empleado Empleado { get; set; } = new();

        /// <summary>
        /// Archivo CV para upload
        /// </summary>
        [BindProperty]
        public IFormFile? ArchivoCV { get; set; }

        /// <summary>
        /// Diccionario de colores por área (pre-calculado)
        /// </summary>
        public Dictionary<string, (string Primary, string Secondary)> AreaPalette { get; set; } = new();

        // ============================================
        // MÉTODOS DE UTILIDAD
        // ============================================

        /// <summary>
        /// Obtiene los colores asignados a un área específica
        /// </summary>
        /// <param name="areaName">Nombre del área</param>
        /// <returns>Tupla con colores primario y secundario</returns>
        public (string Primary, string Secondary) GetAreaColors(string? areaName)
        {
            // Validación de entrada
            if (string.IsNullOrWhiteSpace(areaName) || areaName == "N/A")
            {
                return _areaColors[0]; // Color por defecto
            }

            var normalizedArea = areaName.Trim();

            // Intenta obtener del diccionario pre-calculado
            if (AreaPalette.TryGetValue(normalizedArea, out var colors))
            {
                return colors;
            }

            // Fallback: genera color usando hash consistente
            return GenerateColorFromHash(normalizedArea);
        }

        /// <summary>
        /// Genera colores consistentes basados en hash del nombre del área
        /// </summary>
        private (string Primary, string Secondary) GenerateColorFromHash(string areaName)
        {
            var hash = 0;
            foreach (var c in areaName.ToUpperInvariant())
            {
                hash = ((hash << 5) - hash) + c;
            }

            var index = Math.Abs(hash) % _areaColors.Length;
            return _areaColors[index];
        }

        /// <summary>
        /// Pre-calcula la paleta de colores para todas las áreas
        /// </summary>
        private async Task PrecomputeAreaColorsAsync()
        {
            try
            {
                using var connection = new SqliteConnection(_connectionString);

                const string areasSql = @"
                    SELECT DISTINCT Area 
                    FROM Empleado 
                    WHERE Area IS NOT NULL 
                      AND Area != '' 
                      AND Area != 'N/A'
                    ORDER BY Area";

                var areas = await connection.QueryAsync<string>(areasSql);

                var index = 0;
                foreach (var area in areas.Where(a => !string.IsNullOrWhiteSpace(a)))
                {
                    var normalizedArea = area.Trim();
                    if (!AreaPalette.ContainsKey(normalizedArea))
                    {
                        AreaPalette[normalizedArea] = _areaColors[index % _areaColors.Length];
                        index++;
                    }
                }
            }
            catch (Exception ex)
            {
                // Log del error (en producción usar ILogger)
                Console.WriteLine($"Error al pre-calcular colores: {ex.Message}");

                // Continuar con paleta vacía - los colores se generarán on-demand
            }
        }

        // ============================================
        // HANDLERS DE PÁGINA
        // ============================================

        /// <summary>
        /// Handler GET - Carga el perfil del empleado
        /// </summary>
        public async Task<IActionResult> OnGetAsync(int? id)
        {
            // Validación de parámetro
            if (!id.HasValue || id.Value <= 0)
            {
                TempData["Error"] = "ID de empleado inválido";
                return RedirectToPage("/Index");
            }

            try
            {
                // Cargar empleado
                Empleado = await LoadEmpleadoAsync(id.Value);

                if (Empleado == null)
                {
                    TempData["Error"] = "Empleado no encontrado";
                    return RedirectToPage("/Index");
                }

                // Pre-calcular paleta de colores
                await PrecomputeAreaColorsAsync();

                return Page();
            }
            catch (Exception ex)
            {
                // Log del error
                Console.WriteLine($"Error al cargar perfil: {ex.Message}");
                TempData["Error"] = "Error al cargar el perfil del empleado";
                return RedirectToPage("/Index");
            }
        }

        /// <summary>
        /// Handler POST - Sube o actualiza el CV del empleado
        /// </summary>
        public async Task<IActionResult> OnPostUploadCVAsync(int id)
        {
            // Validaciones
            if (id <= 0)
            {
                TempData["Error"] = "ID de empleado inválido";
                return RedirectToPage(new { id });
            }

            if (ArchivoCV == null || ArchivoCV.Length == 0)
            {
                TempData["Error"] = "Debe seleccionar un archivo PDF";
                return RedirectToPage(new { id });
            }

            // Validar tipo de archivo
            if (!ArchivoCV.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                TempData["Error"] = "Solo se permiten archivos PDF";
                return RedirectToPage(new { id });
            }

            // Validar tamaño (máximo 10MB)
            if (ArchivoCV.Length > 10 * 1024 * 1024)
            {
                TempData["Error"] = "El archivo no debe superar los 10MB";
                return RedirectToPage(new { id });
            }

            try
            {
                // Crear carpeta si no existe
                var folderPath = Path.Combine(
                    Directory.GetCurrentDirectory(),
                    "wwwroot",
                    "uploads",
                    "cvs"
                );

                Directory.CreateDirectory(folderPath);

                // Generar nombre único para el archivo
                var fileName = GenerateUniqueFileName(id);
                var filePath = Path.Combine(folderPath, fileName);

                // Guardar archivo
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await ArchivoCV.CopyToAsync(stream);
                }

                // Actualizar base de datos
                await UpdateCvUrlAsync(id, fileName);

                TempData["Success"] = "CV actualizado correctamente";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al subir CV: {ex.Message}");
                TempData["Error"] = "Error al subir el archivo";
            }

            return RedirectToPage(new { id });
        }

        /// <summary>
        /// Handler POST - Elimina el CV del empleado
        /// </summary>
        public async Task<IActionResult> OnPostDeleteCVAsync(int id)
        {
            if (id <= 0)
            {
                TempData["Error"] = "ID de empleado inválido";
                return RedirectToPage(new { id });
            }

            try
            {
                // Obtener nombre del archivo actual
                var currentCvUrl = await GetCvUrlAsync(id);

                // Eliminar archivo físico si existe
                if (!string.IsNullOrWhiteSpace(currentCvUrl))
                {
                    var filePath = Path.Combine(
                        Directory.GetCurrentDirectory(),
                        "wwwroot",
                        "uploads",
                        "cvs",
                        currentCvUrl
                    );

                    if (System.IO.File.Exists(filePath))
                    {
                        System.IO.File.Delete(filePath);
                    }
                }

                // Actualizar base de datos
                using var connection = new SqliteConnection(_connectionString);
                await connection.ExecuteAsync(
                    "UPDATE Empleado SET CvUrl = NULL WHERE Id = @Id",
                    new { Id = id }
                );

                TempData["Success"] = "CV eliminado correctamente";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al eliminar CV: {ex.Message}");
                TempData["Error"] = "Error al eliminar el CV";
            }

            return RedirectToPage(new { id });
        }

        // ============================================
        // MÉTODOS PRIVADOS DE DATOS
        // ============================================

        /// <summary>
        /// Carga un empleado desde la base de datos
        /// </summary>
        private async Task<Empleado?> LoadEmpleadoAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);

            const string sql = @"
                SELECT * 
                FROM Empleado 
                WHERE Id = @Id";

            return await connection.QueryFirstOrDefaultAsync<Empleado>(sql, new { Id = id });
        }

        /// <summary>
        /// Obtiene la URL del CV de un empleado
        /// </summary>
        private async Task<string?> GetCvUrlAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);

            const string sql = @"
                SELECT CvUrl 
                FROM Empleado 
                WHERE Id = @Id";

            return await connection.QueryFirstOrDefaultAsync<string>(sql, new { Id = id });
        }

        /// <summary>
        /// Actualiza la URL del CV en la base de datos
        /// </summary>
        private async Task UpdateCvUrlAsync(int id, string fileName)
        {
            using var connection = new SqliteConnection(_connectionString);

            const string sql = @"
                UPDATE Empleado 
                SET CvUrl = @CvUrl 
                WHERE Id = @Id";

            await connection.ExecuteAsync(sql, new { CvUrl = fileName, Id = id });
        }

        /// <summary>
        /// Genera un nombre de archivo único para el CV
        /// </summary>
        private string GenerateUniqueFileName(int empleadoId)
        {
            var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            var guid = Guid.NewGuid().ToString("N").Substring(0, 8);
            return $"CV_{empleadoId}_{timestamp}_{guid}.pdf";
        }
    }
}