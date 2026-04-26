import { Command } from "commander";
import { registerRoot } from "./commands/_root.js";
import { registerHoy } from "./commands/hoy.js";
import { registerAhora } from "./commands/ahora.js";
import { registerSemana } from "./commands/semana.js";
import { registerNuevo } from "./commands/nuevo.js";
import { registerWatch } from "./commands/watch.js";

const program = new Command();

program
  .name("wiener")
  .description("CLI agent-first para portales de la Universidad Norbert Wiener")
  .version("0.1.0", "-v, --version");

registerRoot(program);
registerHoy(program);
registerAhora(program);
registerSemana(program);
registerNuevo(program);
registerWatch(program);

program.parseAsync(process.argv).catch((e: unknown) => {
  process.stderr.write(`Fatal: ${e}\n`);
  process.exit(1);
});
