import { x402Request, isError } from "./paytoll-client.js";
import { readFileSync } from "fs";

const input = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const result = await x402Request("https://api.paytoll.io/v1/ai/google/chat", "POST", input);

if (isError(result)) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result.body, null, 2));
