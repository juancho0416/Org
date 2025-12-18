// Models/OrgChartViewModel.cs
using System.Collections.Generic;

namespace Organigrama.Models
{
    public class OrgChartViewModel
    {
        public Empleado Chief { get; set; }
        public List<Empleado> Subordinates { get; set; }
    }
}