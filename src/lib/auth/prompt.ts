import { cancel, isCancel, password, select, text } from "@clack/prompts";

export interface IntranetCredentials {
  usuario: string;
  contrasena: string;
  perfil: "A" | "D" | "P";
}

export async function promptIntranetCredentials(
  defaults?: Partial<IntranetCredentials>,
): Promise<IntranetCredentials> {
  const usuario = await text({
    message: "Usuario (ej: aXXXXXXXXX)",
    placeholder: defaults?.usuario ?? "",
    defaultValue: defaults?.usuario,
    validate: (v) => (v.trim().length === 0 ? "Usuario requerido" : undefined),
  });

  if (isCancel(usuario)) {
    cancel("Cancelado.");
    process.exit(0);
  }

  const contrasena = await password({
    message: "Contraseña",
    validate: (v) => (v.length === 0 ? "Contraseña requerida" : undefined),
  });

  if (isCancel(contrasena)) {
    cancel("Cancelado.");
    process.exit(0);
  }

  const perfil = await select({
    message: "Perfil",
    options: [
      { value: "A", label: "Alumno" },
      { value: "D", label: "Docente" },
      { value: "P", label: "Administrativo" },
    ],
    initialValue: defaults?.perfil ?? "A",
  });

  if (isCancel(perfil)) {
    cancel("Cancelado.");
    process.exit(0);
  }

  return {
    usuario: String(usuario).trim(),
    contrasena: String(contrasena),
    perfil: perfil as "A" | "D" | "P",
  };
}

export async function promptPat(): Promise<string> {
  const pat = await password({
    message: "Pega el Personal Access Token de Canvas",
    validate: (v) => (v.trim().length === 0 ? "Token requerido" : undefined),
  });

  if (isCancel(pat)) {
    cancel("Cancelado.");
    process.exit(0);
  }

  return String(pat).trim();
}
