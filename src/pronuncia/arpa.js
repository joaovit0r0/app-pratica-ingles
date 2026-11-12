// Converte a notação ARPAbet do dicionário CMU para o IPA usado pelo modelo (39 sons do TIMIT).
// "~" marca vogal átona (stress 0).
const ARPA = { AA: "ɑ", AE: "æ", AH: "ə", AO: "ɑ", AW: "aʊ", AY: "aɪ", B: "b", CH: "ʧ", D: "d", DH: "ð", EH: "ɛ", ER: "ɝ", EY: "eɪ", F: "f", G: "g", HH: "h", IH: "ɪ", IY: "i", JH: "ʤ", K: "k", L: "l", M: "m", N: "n", NG: "ŋ", OW: "oʊ", OY: "ɔɪ", P: "p", R: "ɹ", S: "s", SH: "ʃ", T: "t", TH: "θ", UH: "ʊ", UW: "u", V: "v", W: "w", Y: "j", Z: "z", ZH: "ʃ" };
export function deArpa(s) {
  return s.split(" ").map((p) => {
    const m = p.match(/^([A-Z]+)(\d)?$/);
    return (ARPA[m[1]] || "") + (m[2] === "0" ? "~" : "");
  }).join(" ");
}
