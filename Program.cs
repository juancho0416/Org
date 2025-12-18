using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// =================================================================
// 1. CONFIGURACIÓN DE SERVICIOS
// =================================================================

builder.Services.AddRazorPages();

// 🚨 MANTENER: Habilitar el soporte para controladores API (necesario para EmpleadoController)
builder.Services.AddControllers();

// 🚨 ELIMINADO: Ya no necesitamos registrar IEmpleadoService


var app = builder.Build();

// =================================================================
// 2. MIDDLEWARE DE CONFIGURACIÓN
// =================================================================

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

// 🚨 MANTENER: Mapea los endpoints para los Controladores API
app.MapControllers();

app.MapRazorPages();

app.Run();