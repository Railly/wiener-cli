import * as cheerio from "cheerio";
import type { PerfilData } from "../../types/intranet.ts";

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function parsePerfil(html: string): PerfilData {
  const $ = cheerio.load(html);

  const perfil: PerfilData = {
    codigo: "",
    nombres: "",
    apellidos: "",
    dni: "",
    carrera: "",
  };

  // Scan label→value pairs from adjacent td cells
  $("tr").each((_, row) => {
    const cells = $(row).find("td");
    for (let i = 0; i < cells.length - 1; i++) {
      const label = normalizeWhitespace(cells.eq(i).text()).toLowerCase();
      const val = normalizeWhitespace(cells.eq(i + 1).text());

      if (label.includes("código") || label.includes("codigo")) {
        perfil.codigo = perfil.codigo || val;
      } else if (label.includes("nombre") && !label.includes("apellido")) {
        perfil.nombres = perfil.nombres || val;
      } else if (label.includes("apellido") || label.includes("apellidos")) {
        perfil.apellidos = perfil.apellidos || val;
      } else if (label.includes("dni") || label.includes("documento")) {
        perfil.dni = perfil.dni || val;
      } else if (label.includes("carrera") || label.includes("programa")) {
        perfil.carrera = perfil.carrera || val;
      } else if (label.includes("facultad") || label.includes("escuela")) {
        perfil.facultad = perfil.facultad || val;
      } else if (label.includes("email") || label.includes("correo")) {
        perfil.email = perfil.email || val;
      } else if (
        label.includes("teléfono") ||
        label.includes("telefono") ||
        label.includes("celular")
      ) {
        perfil.telefono = perfil.telefono || val;
      } else if (
        label.includes("dirección") ||
        label.includes("direccion") ||
        label.includes("domicilio")
      ) {
        perfil.direccion = perfil.direccion || val;
      } else if (label.includes("ciclo")) {
        perfil.ciclo = perfil.ciclo || val;
      }
    }
  });

  // Also try input[value] pattern (ASP forms often use input fields for display)
  $("input[name]").each((_, el) => {
    const name = ($(el).attr("name") ?? "").toLowerCase();
    const val = normalizeWhitespace($(el).attr("value") ?? "");
    if (!val) return;

    if (name.includes("codigo") || name.includes("cod_alu")) {
      perfil.codigo = perfil.codigo || val;
    } else if (name.includes("nombre") && !name.includes("apellido")) {
      perfil.nombres = perfil.nombres || val;
    } else if (name.includes("apellido")) {
      perfil.apellidos = perfil.apellidos || val;
    } else if (name.includes("dni") || name.includes("documento")) {
      perfil.dni = perfil.dni || val;
    } else if (name.includes("carrera")) {
      perfil.carrera = perfil.carrera || val;
    } else if (name.includes("email") || name.includes("correo")) {
      perfil.email = perfil.email || val;
    }
  });

  return perfil;
}
