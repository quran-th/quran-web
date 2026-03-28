import { ref } from "vue";

const cachedFingerprint = ref<string | null>(null);

async function generateFingerprint(): Promise<string> {
  const components: string[] = [];

  // Screen dimensions
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Language
  components.push(navigator.language);

  // Platform
  components.push(navigator.platform);

  // Canvas fingerprint
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = '14px "Arial"';
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("Quran Report FP", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("Quran Report FP", 4, 17);
      components.push(canvas.toDataURL());
    }
  } catch {
    components.push("canvas-unavailable");
  }

  const raw = components.join("|");
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useFingerprint() {
  async function getFingerprint(): Promise<string> {
    if (cachedFingerprint.value) return cachedFingerprint.value;
    cachedFingerprint.value = await generateFingerprint();
    return cachedFingerprint.value;
  }

  return { getFingerprint, fingerprint: cachedFingerprint };
}
