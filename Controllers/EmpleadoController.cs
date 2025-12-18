using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Dapper;
using Organigrama.Models;
using System.Collections.Generic;
using System.Linq;
using System;

[Route("api/[controller]")]
[ApiController]
public class EmpleadoController : ControllerBase
{
    private readonly string _connectionString = "Data Source=Organigrama.db";

    [HttpGet("todos")] // Endpoint: /api/empleado/todos
    public ActionResult<IEnumerable<Empleado>> ObtenerTodosLosEmpleados()
    {
        try
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();

                // Consulta SQL para obtener todos los campos de la tabla Empleado
                const string sql = "SELECT Id, JefeId, Nombre, Puesto, Area, Email, Foto FROM Empleado ORDER BY Id";

                // Usamos Dapper para mapear automáticamente los resultados a la lista de objetos Empleado
                var empleados = connection.Query<Empleado>(sql).ToList();

                if (!empleados.Any())
                {
                    // HTTP 404 si la tabla está vacía
                    // Si recibes el 404, revisa si has cargado datos a la tabla.
                    return NotFound(new { mensaje = "No se encontraron empleados en la base de datos." });
                }

                // HTTP 200 OK con la lista de empleados
                return Ok(empleados);
            }
        }
        catch (Exception ex)
        {
            // Manejo de errores de conexión o consulta
            // Esto devolverá un HTTP 500 si la DB no se puede abrir o la tabla no existe.
            return StatusCode(500, new
            {
                mensaje = "Error al leer datos de SQLite.",
                detalle = ex.Message
            });
        }
    }
}