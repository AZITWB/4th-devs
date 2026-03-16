import type { DeclarationInput, ExtraWagonRule } from "./types.js";

const SHIPMENT = {
  senderId: "450202122",
  sourceStation: "Gdańsk",
  destinationStation: "Żarnowiec",
  weightKg: 2800,
  category: "A",
  contents: "kasety z paliwem do reaktora",
  fee: "0 PP",
  specialNotes: ""
} as const;

const formatToday = () => new Date().toISOString().slice(0, 10);

export const calculatePaidExtraWagons = (
  weightKg: number,
  extraWagonRule: ExtraWagonRule
) => {
  if (weightKg <= extraWagonRule.standardCapacityKg) {
    return 0;
  }

  return Math.ceil(
    (weightKg - extraWagonRule.standardCapacityKg) / extraWagonRule.wagonCapacityKg
  );
};

export const buildDeclarationInput = (
  routeCode: string,
  extraWagonRule: ExtraWagonRule
): DeclarationInput => ({
  date: formatToday(),
  senderId: SHIPMENT.senderId,
  sourceStation: SHIPMENT.sourceStation,
  destinationStation: SHIPMENT.destinationStation,
  weightKg: SHIPMENT.weightKg,
  category: SHIPMENT.category,
  contents: SHIPMENT.contents,
  fee: SHIPMENT.fee,
  routeCode,
  wdp: calculatePaidExtraWagons(SHIPMENT.weightKg, extraWagonRule),
  specialNotes: SHIPMENT.specialNotes
});

export const validateDeclarationInput = (input: DeclarationInput) => {
  if (!/^\d{9}$/.test(input.senderId)) {
    throw new Error("Identyfikator nadawcy musi mieć 9 cyfr.");
  }

  if (!/^[A-E]$/.test(input.category)) {
    throw new Error("Kategoria przesyłki musi być jedną z wartości A-E.");
  }

  if (!/^[A-Z]-\d{2}$/.test(input.routeCode)) {
    throw new Error("Kod trasy musi mieć format X-00, M-00, R-00 albo L-00.");
  }

  if (input.weightKg < 0.1 || input.weightKg > 4000) {
    throw new Error("Masa przesyłki jest poza zakresem dopuszczonym przez SPK.");
  }

  if (input.contents.length > 200) {
    throw new Error("Opis zawartości przekracza 200 znaków.");
  }

  if (!input.fee.endsWith("PP")) {
    throw new Error("Kwota musi być podana w punktach pracy (PP).");
  }
};