import { describe, expect, it } from "vitest";
import { paymentWarning } from "./rules";

describe("paymentWarning (P02-01)", () => {
  it.each([
    "Du kan betale her: https://vipps.example/abc",
    "Betal via lenken https://pay.example.com/x",
    "betal her før du henter",
    "Kan du sende meg BankID-koden?",
    "Please share the code you got by SMS",
    "Send meg koden fra SMS-en",
    "Pay here: www.bank-payment.example/123",
  ])("flags %j", (text) => expect(paymentWarning(text)).toBe(true));

  it.each([
    "Hei! Passer det å hente på lørdag kl. 10?",
    "Jeg betaler kontant når jeg henter, går det bra?",
    "Vipps er fint for meg, vi tar det når vi møtes.",
    "Takk for lånet!",
  ])("does not flag ordinary text %j", (text) => expect(paymentWarning(text)).toBe(false));
});
