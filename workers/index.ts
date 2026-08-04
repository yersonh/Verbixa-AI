/**
 * Punto de entrada de conveniencia para correr todos los workers en un solo
 * proceso/terminal durante desarrollo local. Cada módulo importado tiene
 * efectos de import (instancia su propio `Worker` de BullMQ y registra sus
 * listeners), así que basta con importarlos.
 *
 * Alternativa: correr cada worker en su propia terminal con
 * `npm run worker:transcription` / `npm run worker:summary` (más aislado:
 * si uno crashea o necesita reiniciarse, no afecta al otro).
 */
import "./transcription-worker";
import "./summary-worker";
