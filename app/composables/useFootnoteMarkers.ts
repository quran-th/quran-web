import { computed, nextTick, type Ref } from "vue";

export interface FootnoteMarker {
  footnoteNumber: number;
  text: string;
}

export interface PreviewSegment {
  type: "text" | "footnote-ref";
  content: string;
  footnoteNumber?: number;
}

const MARKER_RE = /\(\*(\d+)\*\)/g;

export function parseMarkers(text: string): number[] {
  const nums: number[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(MARKER_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    nums.push(Number(match[1]));
  }
  return nums;
}

function getMarkersWithPositions(
  text: string,
): { position: number; oldNumber: number }[] {
  const markers: { position: number; oldNumber: number }[] = [];
  const re = /\(\*(\d+)\*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    markers.push({ position: match.index, oldNumber: Number(match[1]) });
  }
  return markers.sort((a, b) => a.position - b.position);
}

export function renumberFootnotesInOrder(
  text: string,
  footnotes: FootnoteMarker[],
): { text: string; footnotes: FootnoteMarker[]; changed: boolean } {
  const markersWithPositions = getMarkersWithPositions(text);

  if (markersWithPositions.length === 0) {
    return { text, footnotes, changed: false };
  }

  const oldToNew: Record<number, number> = {};
  markersWithPositions.forEach((marker, index) => {
    oldToNew[marker.oldNumber] = index + 1;
  });

  const needsRenumbering = markersWithPositions.some(
    (marker, index) => marker.oldNumber !== index + 1,
  );
  if (!needsRenumbering) {
    return { text, footnotes, changed: false };
  }

  let newText = text;
  for (let i = markersWithPositions.length - 1; i >= 0; i--) {
    const marker = markersWithPositions[i]!;
    const oldMarker = `(*${marker.oldNumber}*)`;
    const newMarker = `(*${oldToNew[marker.oldNumber]}*)`;
    newText =
      newText.slice(0, marker.position) +
      newMarker +
      newText.slice(marker.position + oldMarker.length);
  }

  const updatedFootnotes = footnotes.map((fn) => ({
    ...fn,
    footnoteNumber: oldToNew[fn.footnoteNumber] ?? fn.footnoteNumber,
  }));
  updatedFootnotes.sort((a, b) => a.footnoteNumber - b.footnoteNumber);

  return { text: newText, footnotes: updatedFootnotes, changed: true };
}

export function nextFootnoteNumber(
  text: string,
  footnotes: FootnoteMarker[],
): number {
  const markersInText = parseMarkers(text);
  const existingNums = footnotes.map((f) => f.footnoteNumber);
  const all = [...markersInText, ...existingNums];
  const max = all.length > 0 ? Math.max(...all) : 0;
  return max + 1;
}

export function useFootnoteValidation(
  proposalText: Ref<string>,
  footnotes: Ref<FootnoteMarker[]>,
) {
  const validationErrors = computed<string[]>(() => {
    const errors: string[] = [];
    const markers = parseMarkers(proposalText.value);
    const fnNums = new Set(footnotes.value.map((f) => f.footnoteNumber));

    const seen = new Set<number>();
    for (const n of markers) {
      if (seen.has(n)) {
        errors.push(`เชิงอรรถ (*${n}*) ซ้ำกันในเนื้อหา`);
      }
      seen.add(n);
    }

    const uniqueMarkers = new Set(markers);
    for (const n of uniqueMarkers) {
      if (!fnNums.has(n)) {
        errors.push(`เชิงอรรถ (*${n}*) ไม่มีเนื้อหา — กรุณาเพิ่มข้อความ`);
      }
    }

    for (const fn of footnotes.value) {
      if (uniqueMarkers.has(fn.footnoteNumber) && !fn.text.trim()) {
        errors.push(`เชิงอรรถ (*${fn.footnoteNumber}*) ยังไม่มีข้อความ`);
      }
    }

    for (const fn of footnotes.value) {
      if (!uniqueMarkers.has(fn.footnoteNumber)) {
        errors.push(`เชิงอรรถ (*${fn.footnoteNumber}*) ไม่ถูกใช้ในเนื้อหา`);
      }
    }

    return errors;
  });

  return { validationErrors };
}

export function useTranslationSegments(text: Ref<string>) {
  const segments = computed<PreviewSegment[]>(() => {
    const textValue = text.value;
    const result: PreviewSegment[] = [];
    let lastIndex = 0;
    const re = /\(\*(\d+)\*\)/g;
    let match: RegExpExecArray | null;

    while ((match = re.exec(textValue)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: "text",
          content: textValue.slice(lastIndex, match.index),
        });
      }
      result.push({
        type: "footnote-ref",
        content: match[0],
        footnoteNumber: Number(match[1]),
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < textValue.length) {
      result.push({ type: "text", content: textValue.slice(lastIndex) });
    }

    return result;
  });

  return { segments };
}

export async function insertFootnoteMarker(
  textareaEl: Ref<HTMLTextAreaElement | null>,
  proposalText: Ref<string>,
  footnotes: Ref<FootnoteMarker[]>,
) {
  const el = textareaEl.value;
  if (!el) return;

  const num = nextFootnoteNumber(proposalText.value, footnotes.value);
  const marker = `(*${num}*)`;
  const start = el.selectionStart;
  const end = el.selectionEnd;

  proposalText.value =
    proposalText.value.slice(0, start) +
    marker +
    proposalText.value.slice(end);

  const newFootnote: FootnoteMarker = { footnoteNumber: num, text: "" };
  footnotes.value = [...footnotes.value, newFootnote];

  const result = renumberFootnotesInOrder(
    proposalText.value,
    footnotes.value,
  );
  if (result.changed) {
    proposalText.value = result.text;
    footnotes.value = result.footnotes;
  }

  await nextTick();
  const renumberedText = proposalText.value;
  const matchAfterInsert = renumberedText.slice(start).match(/^\(\*\d+\*\)/);
  const newPos = matchAfterInsert
    ? start + matchAfterInsert[0].length
    : start + marker.length;
  el.focus();
  el.setSelectionRange(newPos, newPos);
}
