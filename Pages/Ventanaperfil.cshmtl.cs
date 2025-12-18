using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Data.Sqlite;
using Dapper;
using Organigrama.Models;

namespace Organigrama.Pages
{
    public class VentanaperfilModel : PageModel
    {
        private readonly string _connectionString = "Data Source=Organigrama.db";
        public Empleado Empleado { get; set; } = new();

        [BindProperty]
        public IFormFile? ArchivoCV { get; set; }

        private readonly (string Primary, string Secondary)[] _areaColors = new[]
        {
            ("#5A67D8", "#EEF0FA"), ("#d85a9bff", "#F1EEFA"),
            ("#48bb78ff", "#EBF9F1"), ("#00b7ffff", "#E6F6EC"),
            ("#F56565", "#FEEEEE"), ("#ED64A6", "#FDEFF6")
        };

        public (string Primary, string Secondary) GetAreaColors(string areaName)
        {
            if (string.IsNullOrEmpty(areaName) || areaName == "N/A") return _areaColors[0];
            int hash = 0;
            foreach (char c in areaName.Trim().ToUpper()) hash += (int)c;
            return _areaColors[Math.Abs(hash) % _areaColors.Length];
        }

        public async Task<IActionResult> OnGetAsync(int? id)
        {
            if (id == null) return RedirectToPage("/Index");
            using (var connection = new SqliteConnection(_connectionString))
            {
                const string sql = "SELECT * FROM Empleado WHERE Id = @Id";
                Empleado = await connection.QueryFirstOrDefaultAsync<Empleado>(sql, new { Id = id });
                if (Empleado == null) return RedirectToPage("/Index");
            }
            return Page();
        }

        public async Task<IActionResult> OnPostUploadCVAsync(int id)
        {
            if (ArchivoCV == null) return RedirectToPage(new { id });
            var folderPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "cvs");
            if (!Directory.Exists(folderPath)) Directory.CreateDirectory(folderPath);
            var fileName = $"CV_{id}_{Guid.NewGuid().ToString().Substring(0, 8)}.pdf";
            using (var stream = new FileStream(Path.Combine(folderPath, fileName), FileMode.Create))
            {
                await ArchivoCV.CopyToAsync(stream);
            }
            using (var connection = new SqliteConnection(_connectionString))
            {
                await connection.ExecuteAsync("UPDATE Empleado SET CvUrl = @CvUrl WHERE Id = @Id", new { CvUrl = fileName, Id = id });
            }
            return RedirectToPage(new { id });
        }

        // ELIMINAR CV
        public async Task<IActionResult> OnPostDeleteCVAsync(int id)
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                await connection.ExecuteAsync("UPDATE Empleado SET CvUrl = NULL WHERE Id = @Id", new { Id = id });
            }
            return RedirectToPage(new { id });
        }
    }
}