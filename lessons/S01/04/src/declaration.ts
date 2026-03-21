import type { DeclarationInput } from "./types.js";

const replaceLiteral = (template: string, from: string, to: string) => {
  if (!template.includes(from)) {
    throw new Error(`Nie znaleziono fragmentu \"${from}\" we wzorze deklaracji.`);
  }

  return template.replace(from, to);
};

export const renderDeclaration = (
  template: string,
  input: DeclarationInput
) => {
  let declaration = template;

  declaration = replaceLiteral(declaration, "[YYYY-MM-DD]", input.date);
  declaration = replaceLiteral(declaration, "[miasto nadania]", input.sourceStation);
  declaration = replaceLiteral(declaration, "[identyfikator płatnika]", input.senderId);
  declaration = replaceLiteral(declaration, "[miasto docelowe]", input.destinationStation);
  declaration = replaceLiteral(declaration, "[kod trasy]", input.routeCode);
  declaration = replaceLiteral(
    declaration,
    "KATEGORIA PRZESYŁKI: A/B/C/D/E",
    `KATEGORIA PRZESYŁKI: ${input.category}`
  );
  declaration = replaceLiteral(
    declaration,
    "OPIS ZAWARTOŚCI (max 200 znaków): [...]",
    `OPIS ZAWARTOŚCI (max 200 znaków): ${input.contents}`
  );
  declaration = replaceLiteral(
    declaration,
    "DEKLAROWANA MASA (kg): [...]",
    `DEKLAROWANA MASA (kg): ${input.weightKg}`
  );
  declaration = replaceLiteral(declaration, "WDP: [liczba]", `WDP: ${input.wdp}`);
  declaration = replaceLiteral(
    declaration,
    "UWAGI SPECJALNE: [...]",
    `UWAGI SPECJALNE: ${input.specialNotes}`
  );
  declaration = replaceLiteral(
    declaration,
    "KWOTA DO ZAPŁATY: [PP]",
    `KWOTA DO ZAPŁATY: ${input.fee}`
  );

  return declaration;
};