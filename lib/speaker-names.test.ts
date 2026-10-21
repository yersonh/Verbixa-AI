import { test } from "node:test";
import assert from "node:assert/strict";

import type { DiarizedSegment } from "./deepgram";
import {
  extractSelfIntroducedName,
  resolveSpeakerNamesFromIntroductions,
} from "./speaker-names";

function seg(speaker: string, text: string, startTime = 0): DiarizedSegment {
  return { speaker, text, startTime, endTime: startTime + 1 };
}

test("detecta presentaciones en español", () => {
  assert.equal(extractSelfIntroducedName("Hola a todos, me llamo Ana."), "Ana");
  assert.equal(extractSelfIntroducedName("Buenos días, soy Carlos Pérez y trabajo en ventas."), "Carlos Pérez");
  assert.equal(extractSelfIntroducedName("Mi nombre es Luis Hernández, de finanzas."), "Luis Hernández");
  assert.equal(extractSelfIntroducedName("Yo soy María de la Cruz."), "María de la Cruz");
  assert.equal(extractSelfIntroducedName("Qué tal, les habla Roberto."), "Roberto");
  assert.equal(extractSelfIntroducedName("Soy el ingeniero Jorge Treviño."), "Jorge Treviño");
  assert.equal(extractSelfIntroducedName("Hola, soy la doctora Sofía Garza"), "Sofía Garza");
});

test("acepta nombres en minúsculas solo tras frases fuertes", () => {
  assert.equal(extractSelfIntroducedName("hola me llamo juan y vengo de ventas"), "Juan");
  assert.equal(extractSelfIntroducedName("mi nombre es pedro, gracias"), "Pedro");
  assert.equal(extractSelfIntroducedName("hola soy juan"), null);
});

test("detecta presentaciones en inglés", () => {
  assert.equal(extractSelfIntroducedName("Hi everyone, my name is John Smith."), "John Smith");
  assert.equal(extractSelfIntroducedName("Hey, I'm Sarah from marketing."), "Sarah");
  assert.equal(extractSelfIntroducedName("Hey, I’m Sarah."), "Sarah");
});

test("no confunde otras frases con presentaciones", () => {
  assert.equal(extractSelfIntroducedName("Soy de Monterrey."), null);
  assert.equal(extractSelfIntroducedName("Yo soy el encargado del proyecto."), null);
  assert.equal(extractSelfIntroducedName("Soy responsable de la entrega."), null);
  assert.equal(extractSelfIntroducedName("Eso no lo sé, soy nuevo aquí."), null);
  assert.equal(extractSelfIntroducedName("I'm not sure about that."), null);
  assert.equal(extractSelfIntroducedName("Revisemos el presupuesto del trimestre."), null);
  assert.equal(extractSelfIntroducedName("Ensoy Pedro"), null);
});

test("reemplaza Speaker N por el nombre en todas sus intervenciones", () => {
  const result = resolveSpeakerNamesFromIntroductions([
    seg("Speaker 0", "Hola, buenos días, soy Ana Ruiz.", 0),
    seg("Speaker 1", "Qué tal, me llamo Carlos.", 5),
    seg("Speaker 0", "Empecemos con el primer punto.", 10),
    seg("Speaker 1", "De acuerdo.", 15),
  ]);
  assert.deepEqual(
    result.map((s) => s.speaker),
    ["Ana Ruiz", "Carlos", "Ana Ruiz", "Carlos"],
  );
});

test("deja Speaker N si la persona no se presenta", () => {
  const result = resolveSpeakerNamesFromIntroductions([
    seg("Speaker 0", "Hola, soy Ana.", 0),
    seg("Speaker 1", "Buenos días a todos.", 5),
  ]);
  assert.deepEqual(result.map((s) => s.speaker), ["Ana", "Speaker 1"]);
});

test("solo busca en las primeras intervenciones de cada hablante", () => {
  const result = resolveSpeakerNamesFromIntroductions([
    seg("Speaker 0", "Primer punto.", 0),
    seg("Speaker 0", "Segundo punto.", 1),
    seg("Speaker 0", "Tercer punto.", 2),
    seg("Speaker 0", "Como dije, soy Ana.", 3),
  ]);
  assert.ok(result.every((s) => s.speaker === "Speaker 0"));
});

test("no asigna el mismo nombre a dos hablantes distintos", () => {
  const result = resolveSpeakerNamesFromIntroductions([
    seg("Speaker 0", "Soy Ana.", 0),
    seg("Speaker 1", "Me llamo Ana también.", 5),
  ]);
  assert.deepEqual(result.map((s) => s.speaker), ["Ana", "Speaker 1"]);
});

test("respeta los nombres ya resueltos por el timeline de Recall", () => {
  const result = resolveSpeakerNamesFromIntroductions([
    seg("Laura Gómez", "Hola, soy Laura.", 0),
    seg("Speaker 1", "Hola, soy Laura Gómez.", 5),
    seg("Speaker 2", "Y yo soy Pablo.", 10),
  ]);
  assert.deepEqual(
    result.map((s) => s.speaker),
    ["Laura Gómez", "Speaker 1", "Pablo"],
  );
});
