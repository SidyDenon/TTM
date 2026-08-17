import assert from "node:assert/strict";
import { normalizePhone } from "../utils/sms.js";

for (const input of ["70000000", "22370000000", "0022370000000", "+22370000000", "70 00 00 00"]) {
  assert.equal(normalizePhone(input), "+22370000000");
}
assert.throws(() => normalizePhone("123"));
console.log("Normalisation SMS valide");
