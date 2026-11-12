// Grava o microfone em 16 kHz, mono, só na memória. Para sozinho quando a pessoa termina de falar.
export type Gravacao = { parar: () => void; cancelar: () => void; promessa: Promise<{ audio: Float32Array; segundos: number }> };

export function microfoneDisponivel() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

export function gravar(opcoes: { aoVolume?: (v: number) => void; maxMs?: number } = {}): Gravacao {
  let parar = () => {};
  let cancelado = false;
  const promessa = new Promise<{ audio: Float32Array; segundos: number }>((resolve, reject) => {
    navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then((stream) => {
      if (cancelado) { stream.getTracks().forEach((t) => t.stop()); reject(new Error("Cancelado.")); return; }
      const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      let ctx: AudioContext;
      try { ctx = new Ctx({ sampleRate: 16000 }); } catch { ctx = new Ctx(); }
      const fonte = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const pedacos: Float32Array[] = [];
      let falou = false, silencioDesde = 0, terminou = false;
      const inicio = Date.now();
      proc.onaudioprocess = (ev) => {
        const d = ev.inputBuffer.getChannelData(0);
        pedacos.push(new Float32Array(d));
        let soma = 0; for (let i = 0; i < d.length; i++) soma += d[i] * d[i];
        const rms = Math.sqrt(soma / d.length);
        opcoes.aoVolume?.(Math.min(1, rms * 8));
        const agora = Date.now();
        if (rms > 0.02) { falou = true; silencioDesde = 0; }
        else if (falou) { if (!silencioDesde) silencioDesde = agora; if (agora - silencioDesde > 1300) fim(); }
        if (agora - inicio > (opcoes.maxMs || 12000)) fim();
        if (!falou && agora - inicio > 7000) fim();
      };
      fonte.connect(proc); proc.connect(ctx.destination);
      function fim() {
        if (terminou) return; terminou = true;
        proc.disconnect(); fonte.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        const total = pedacos.reduce((s, p) => s + p.length, 0);
        const audio = new Float32Array(total);
        let o = 0; for (const p of pedacos) { audio.set(p, o); o += p.length; }
        pedacos.length = 0;
        const taxa = ctx.sampleRate;
        ctx.close();
        if (cancelado) { reject(new Error("Cancelado.")); return; }
        if (!falou) { reject(new Error("Não ouvi nada. Fale logo depois de tocar no botão, perto do microfone.")); return; }
        resolve({ audio: cortarSilencio(taxa === 16000 ? audio : reamostrar(audio, taxa, 16000)), segundos: (Date.now() - inicio) / 1000 });
      }
      parar = fim;
    }).catch(() => reject(new Error("O navegador bloqueou o microfone. Libere o microfone para este site.")));
  });
  return { parar: () => parar(), cancelar: () => { cancelado = true; parar(); }, promessa };
}

function reamostrar(dados: Float32Array, de: number, para: number) {
  const fator = de / para, n = Math.floor(dados.length / fator), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ini = Math.floor(i * fator), fimI = Math.min(dados.length, Math.floor((i + 1) * fator));
    let s = 0; for (let k = ini; k < fimI; k++) s += dados[k];
    out[i] = s / Math.max(1, fimI - ini);
  }
  return out;
}
function cortarSilencio(audio: Float32Array) {
  const janela = 320; let ini = 0, fim = audio.length;
  const energia = (a: number) => { let s = 0; for (let k = a; k < Math.min(audio.length, a + janela); k++) s += audio[k] * audio[k]; return Math.sqrt(s / janela); };
  while (ini < audio.length && energia(ini) < 0.01) ini += janela;
  while (fim > ini && energia(fim - janela) < 0.01) fim -= janela;
  ini = Math.max(0, ini - 3200); fim = Math.min(audio.length, fim + 3200);
  return audio.slice(ini, fim);
}
