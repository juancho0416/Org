using Microsoft.EntityFrameworkCore;
using Organigrama.Data;

var builder = WebApplication.CreateBuilder(args);

// 1. Obtener la ruta absoluta de la base de datos en la raíz
string dbPath = Path.Combine(Directory.GetCurrentDirectory(), "Organigrama.db");

// 2. Configurar el contexto con esa ruta física
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

builder.Services.AddRazorPages();
builder.Services.AddControllers();

var app = builder.Build();

// LOG DE DEPURACIÓN: Esto aparecerá en tu terminal al iniciar
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    Console.WriteLine($"🔍 Verificando archivo en: {dbPath}");

    if (File.Exists(dbPath))
    {
        var count = context.Empleados.Count();
        Console.WriteLine($"✅ Archivo encontrado. Empleados en DB: {count}");
    }
    else
    {
        Console.WriteLine("❌ ERROR: No se encuentra el archivo Organigrama.db en la raíz.");
    }
}

app.UseStaticFiles();
app.UseRouting();
app.MapRazorPages();
app.MapControllers();

app.Run();