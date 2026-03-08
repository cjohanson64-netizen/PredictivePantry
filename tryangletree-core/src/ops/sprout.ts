import { err } from "../runtime/errors.js";

function sproutCore({ input, args }) {
  const stride = args?.stride ?? args?.beatspermeasure;
  const selectorMap = args?.selectorMap ?? args?.selectormap ?? args?.degreemap;

  if (!input || typeof input !== "object") err("sprout/realize expects plan object");
  if (!Number.isInteger(stride) || stride <= 0) {
    err("sprout/realize requires stride > 0 (or beatspermeasure)");
  }
  if (!selectorMap || typeof selectorMap !== "object") {
    err("sprout/realize requires selectorMap object (or degreemap)");
  }

  const valueSets = input.valueSets ?? input.valuesets ?? input.chorddefs;
  const track = input.track ?? input.chords;
  const selectors = input.selectors ?? input.degrees;

  if (!valueSets || !track || !selectors) {
    err("sprout/realize: plan missing valueSets/track/selectors (or chorddefs/chords/degrees)");
  }
  if (!Array.isArray(track) || !Array.isArray(selectors)) {
    err("sprout/realize: track/selectors must be arrays");
  }

  const output = [];
  for (let i = 0; i < selectors.length; i++) {
    const trackIndex = Math.floor(i / stride);
    const setName = track[trackIndex];
    const setValues = valueSets[setName];
    if (!Array.isArray(setValues)) err(`sprout/realize: value set not found ${setName}`);

    const selector = selectors[i];
    const slotIndex = selectorMap["_" + selector] ?? selectorMap[String(selector)];
    if (slotIndex === undefined) err(`sprout/realize: selector not mapped ${selector}`);

    const value = setValues[slotIndex];
    if (value === undefined) {
      err(`sprout/realize: invalid index ${slotIndex} in value set ${setName}`);
    }
    output.push(value);
  }

  return output;
}

export { sproutCore };
