import { NextRequest, NextResponse } from "next/server";
import { aiGenerate, hasAiKey } from "@/lib/ai";
import { fallbackParse } from "@/lib/parse-fallback";
import type { ChatAction, ChatMessage, ChatResponse, Entry, Goal, ParsedItem } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Sen "Bitig" adlı kişisel takip uygulamasının yapay zeka asistanısın. Kullanıcı seninle gündelik Türkçe sohbet eder; sen hem sıcak ve kısa cevap verirsin hem de gerekli veri işlemlerini yaparsın.

Her mesajda sana şunlar verilir: bugünün tarihi, kullanıcının mevcut kayıtları (id'leriyle JSON) ve son sohbet geçmişi.

Yapabileceklerin:
- Yeni kayıt ekleme (alışkanlık, görev, ruh hali, günlük).
- Var olan bir görevi/alışkanlığı tamamlandı/yapılmadı işaretleme.
- Var olan bir kaydı silme.
- Var olan bir kaydı düzeltme/yeniden kategorize etme (ör. yanlış 'günlük'e düşen yemeği beslenmeye taşımak, bir değeri düzeltmek).
- Kullanıcının verisiyle ilgili sorularını yanıtlama (kaç kez, ne zaman, özet, öneri, trend...).
- Belirli bir tarih/saate hatırlatma kurma (zamanı gelince telefona bildirim gönderilir).
- Hedef koyma ("haftada 3 spor", "günde 2 litre su") ve hedef ilerlemesiyle ilgili soruları yanıtlama.
- Yemek/içecek kaydı + kalori & makro tahmini (beslenme takibi); kalan kalori sorularını yanıtlama.
- Çok adımlı meydan okuma "zindan" (dungeon) oluşturma (Solo Leveling temalı; 3-5 adımlık görev zinciri).

ÇIKTI — SADECE şu JSON (başka metin yok):
{"reply": "...", "actions": [...]}

"reply": Kullanıcıya gösterilecek sohbet cevabın. Türkçe, kısa, samimi. Ne yaptığını doğrula veya soruyu yanıtla. Veriden konuşurken uydurma, yalnızca verilen kayıtları kullan.

"actions": Uygulanacak işlemler (yoksa []):
- {"type":"add","item":{...},"date":"YYYY-MM-DD"}  // date opsiyonel (yoksa bugün). item alanları:
    habit: {"kind":"habit","name":"koşu","amount":45,"unit":"dk","done":true}
    task:  {"kind":"task","title":"raporu bitir","done":false}
    mood:  {"kind":"mood","score":2,"label":"yorgun","note":"..."}   // score 1-5
    journal:{"kind":"journal","text":"..."}
- {"type":"complete","id":"<mevcut kayıt id>","done":true}   // done:false ile geri alınır
- {"type":"delete","id":"<mevcut kayıt id>"}
- {"type":"edit","id":"<mevcut kayıt id>","item":{...}}  // o kaydı item'daki YENİ içerikle değiştirir (tür değişebilir). item add'deki biçimde (food dahil). Yeniden kategorize için doğru "kind"ı ver.
- {"type":"reminder","text":"hatırlatılacak şey","at":"YYYY-MM-DDTHH:mm:ss"}  // at = YEREL tarih-saat; "şu anki yerel tarih-saat"ten hesapla (ör. "yarın 14:00'te X" -> yarının tarihi T14:00:00). Hatırlatma kurunca reply'de saatini teyit et.
- {"type":"goal","title":"Haftada 3 spor","habit":"spor","target":3,"period":"week","metric":"count","unit":""}  // "habit"=eşleşecek alışkanlık adı; sayı hedefi metric:"count"; miktar hedefi (ör. günde 2L su) metric:"amount"+unit. period: "day"|"week".
- {"type":"food","name":"döner","amount":1,"unit":"porsiyon","kcal":600,"protein":30,"carb":50,"fat":28}  // YEMEK/İÇECEK. kcal + makroları (protein/karbonhidrat/yağ, gram) porsiyona göre SEN tahmin et. Birden çok yiyecek varsa her biri ayrı food.
- {"type":"dungeon","name":"Demir İrade Zindanı","rank":"C","boss":"7 gün şekersiz hayatta kal","steps":["3 gün üst üste spor","her gün 2L su","1 hafta erken kalk"]}  // kullanıcı meydan okuma/zindan isterse. rank E-S; 3-5 SOMUT adım; temalı ad + kısa boss.

Kurallar:
- Sadece soru/sohbet varsa actions'ı boş bırak, cevabı reply'de ver.
- complete/delete için YALNIZCA sana verilen kayıt listesindeki gerçek id'leri kullan; id uydurma. Doğru kaydı içerikten eşleştir (ör. "raporu bitirdim" -> başlığı rapora benzeyen görev).
- "dün", "geçen cuma" gibi ifadeleri bugünün tarihinden hesaplayıp date ver.
- Yeme/içme ifadelerini ("... yedim/içtim", "kahvaltıda ...") food olarak kaydet; kcal + makroları makul biçimde SEN tahmin et; yemekleri journal'a ATMA.
- Kullanıcı bir kaydı düzeltmek/taşımak/yeniden kategorize etmek isterse MUTLAKA aksiyon üret — sadece reply'de "taşıdım/düzelttim" DEME, gerçekten aksiyonu ekle. Tek kaydı düzelt: {"type":"edit","id":"<listedeki id>","item":{...}} (beslenmeye taşırken item kind:"food" + kcal/makro tahmini; göreve çevir -> kind:"task"; vb.). Bir kayıtta BİRDEN ÇOK yemek varsa: o kaydı "delete" et ve her yemeği AYRI "food" aksiyonu olarak ekle.
- Bir mesajda birden çok işlem olabilir.
- Kullanıcı bir duygu paylaştığında ya da günlük tuttuğunda (mood/journal), reply'de onu düşünmeye davet eden TEK bir kısa, içten takip sorusu sor (ör. "Bunu en çok ne tetikledi?", "Gün içinde ne değiştirdi bunu?"). Bunu yalnızca duygusal/yansıtıcı paylaşımlarda yap; nötr görev/alışkanlık kaydında kısa onayla geç, soru sorma. Üst üste her mesajda soru sorma.
- Türkçe karakterleri koru. Çıktı yalnızca geçerli JSON olsun.`;

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.min(5, Math.max(1, v));
}

function normItem(o: unknown): ParsedItem | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  switch (r.kind) {
    case "habit":
      return typeof r.name === "string" && r.name.trim()
        ? {
            kind: "habit",
            name: r.name.trim(),
            amount: typeof r.amount === "number" ? r.amount : undefined,
            unit: typeof r.unit === "string" ? r.unit : undefined,
            done: typeof r.done === "boolean" ? r.done : true,
          }
        : null;
    case "task":
      return typeof r.title === "string" && r.title.trim()
        ? { kind: "task", title: r.title.trim(), done: typeof r.done === "boolean" ? r.done : false }
        : null;
    case "mood":
      return {
        kind: "mood",
        score: clampScore(r.score),
        label: typeof r.label === "string" ? r.label : undefined,
        note: typeof r.note === "string" ? r.note : undefined,
      };
    case "journal":
      return typeof r.text === "string" && r.text.trim() ? { kind: "journal", text: r.text.trim() } : null;
    case "food":
      return typeof r.name === "string" && r.name.trim() && typeof r.kcal === "number"
        ? {
            kind: "food",
            name: r.name.trim(),
            amount: typeof r.amount === "number" ? r.amount : undefined,
            unit: typeof r.unit === "string" ? r.unit : undefined,
            kcal: Math.max(0, Math.round(r.kcal)),
            protein: typeof r.protein === "number" ? Math.max(0, Math.round(r.protein)) : undefined,
            carb: typeof r.carb === "number" ? Math.max(0, Math.round(r.carb)) : undefined,
            fat: typeof r.fat === "number" ? Math.max(0, Math.round(r.fat)) : undefined,
          }
        : null;
    default:
      return null;
  }
}

function validateActions(raw: unknown): ChatAction[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatAction[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    if (o.type === "add") {
      const item = normItem(o.item);
      if (item) {
        const action: ChatAction = { type: "add", item };
        if (typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date)) action.date = o.date;
        out.push(action);
      }
    } else if (o.type === "complete" && typeof o.id === "string") {
      out.push({ type: "complete", id: o.id, done: o.done !== false });
    } else if (o.type === "delete" && typeof o.id === "string") {
      out.push({ type: "delete", id: o.id });
    } else if (o.type === "edit" && typeof o.id === "string") {
      const item = normItem(o.item);
      if (item) out.push({ type: "edit", id: o.id, item });
    } else if (
      o.type === "reminder" &&
      typeof o.text === "string" &&
      o.text.trim() &&
      typeof o.at === "string"
    ) {
      out.push({ type: "reminder", text: o.text.trim(), at: o.at });
    } else if (
      o.type === "goal" &&
      typeof o.title === "string" &&
      o.title.trim() &&
      typeof o.habit === "string" &&
      o.habit.trim() &&
      typeof o.target === "number" &&
      (o.period === "day" || o.period === "week")
    ) {
      out.push({
        type: "goal",
        title: o.title.trim(),
        habit: o.habit.trim(),
        target: o.target,
        period: o.period,
        metric: o.metric === "amount" ? "amount" : "count",
        unit: typeof o.unit === "string" && o.unit.trim() ? o.unit.trim() : undefined,
      });
    } else if (
      o.type === "food" &&
      typeof o.name === "string" &&
      o.name.trim() &&
      typeof o.kcal === "number"
    ) {
      const num = (v: unknown) => (typeof v === "number" ? Math.max(0, Math.round(v)) : undefined);
      out.push({
        type: "food",
        name: o.name.trim(),
        amount: typeof o.amount === "number" ? o.amount : undefined,
        unit: typeof o.unit === "string" ? o.unit : undefined,
        kcal: Math.max(0, Math.round(o.kcal)),
        protein: num(o.protein),
        carb: num(o.carb),
        fat: num(o.fat),
      });
    } else if (
      o.type === "dungeon" &&
      typeof o.name === "string" &&
      o.name.trim() &&
      Array.isArray(o.steps)
    ) {
      const steps = (o.steps as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
      if (steps.length) {
        out.push({
          type: "dungeon",
          name: o.name.trim(),
          rank: typeof o.rank === "string" ? o.rank : undefined,
          boss: typeof o.boss === "string" ? o.boss : undefined,
          steps,
        });
      }
    }
  }
  return out;
}

/** Kayıtları (id dahil) modele kompakt verir. */
function compact(entries: Entry[]) {
  return entries.slice(0, 150).map((e) => {
    switch (e.kind) {
      case "habit":
        return { id: e.id, date: e.date, kind: "habit", name: e.name, amount: e.amount, unit: e.unit, done: e.done };
      case "task":
        return { id: e.id, date: e.date, kind: "task", title: e.title, done: e.done };
      case "mood":
        return { id: e.id, date: e.date, kind: "mood", score: e.score, label: e.label };
      case "journal":
        return { id: e.id, date: e.date, kind: "journal", text: e.text.slice(0, 160) };
    }
  });
}

function buildUserContent(
  message: string,
  history: ChatMessage[],
  entries: Entry[],
  today: string,
  now: string,
  goalsList: Goal[],
  calorieTarget: number | null
) {
  const hist = (history || [])
    .slice(-8)
    .map((m) => (m.role === "user" ? "Kullanıcı: " : "Asistan: ") + m.text)
    .join("\n");
  return [
    `Bugünün tarihi: ${today}.${now ? ` Şu anki yerel tarih-saat: ${now}.` : ""}`,
    "",
    "Mevcut kayıtların (JSON, id dahil):",
    JSON.stringify(compact(entries)),
    "",
    "Kullanıcının hedefleri (JSON): " + JSON.stringify(goalsList ?? []),
    "(Hedef ilerlemesini kayıtlardan hesapla: period day=bugün, week=son 7 gün; metric count=eşleşen alışkanlık sayısı, amount=miktar toplamı.)",
    calorieTarget
      ? `Günlük kalori hedefi: ${calorieTarget} kcal (bugünkü 'food' kayıtlarının kcal toplamını çıkarıp kalanı belirtebilirsin).`
      : "",
    "",
    "Son sohbet:",
    hist || "(yok)",
    "",
    "Kullanıcının yeni mesajı: " + message,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  let message = "";
  let history: ChatMessage[] = [];
  let entries: Entry[] = [];
  let today = "";
  let now = "";
  let goalsList: Goal[] = [];
  let calorieTarget: number | null = null;
  try {
    const body = await req.json();
    message = String(body?.message ?? "");
    if (Array.isArray(body?.history)) history = body.history as ChatMessage[];
    if (Array.isArray(body?.entries)) entries = body.entries as Entry[];
    today = String(body?.today ?? "");
    now = String(body?.now ?? "");
    if (Array.isArray(body?.goals)) goalsList = body.goals as Goal[];
    if (typeof body?.calorieTarget === "number") calorieTarget = body.calorieTarget;
  } catch {
    // gövde okunamadı
  }

  if (!message.trim()) {
    return NextResponse.json({ reply: "", actions: [] } satisfies ChatResponse);
  }

  // AI yoksa: en azından yedek ayrıştırıcıyla kayıt ekle.
  if (!hasAiKey()) {
    const items = fallbackParse(message);
    return NextResponse.json({
      reply: items.length
        ? `${items.length} kayıt ekledim. (Yapay zeka şu an kapalı — sohbet sınırlı.)`
        : "Yapay zeka şu an kapalı, bu yüzden sohbet sınırlı. Yine de gününü yazarsan kaydedebilirim.",
      actions: items.map((item) => ({ type: "add", item }) as ChatAction),
    } satisfies ChatResponse);
  }

  try {
    const out = await aiGenerate({
      system: SYSTEM_PROMPT,
      user: buildUserContent(message, history, entries, today, now, goalsList, calorieTarget),
      json: true,
      temperature: 0.3,
    });
    if (!out) throw new Error("empty");
    const parsed = JSON.parse(out);
    const reply = typeof parsed?.reply === "string" && parsed.reply.trim() ? parsed.reply : "Tamam.";
    const actions = validateActions(parsed?.actions);
    return NextResponse.json({ reply, actions } satisfies ChatResponse);
  } catch {
    // Geçici hata: yedek ayrıştırıcıyla yine de ekle.
    const items = fallbackParse(message);
    return NextResponse.json({
      reply: items.length
        ? "Not aldım ama yapay zeka şu an meşgul — kalori/detaylı analiz yapılamadı. Birkaç saniye sonra tekrar yazarsan tam işlerim."
        : "Yapay zeka şu an yanıt veremedi, birkaç saniye sonra tekrar dener misin?",
      actions: items.map((item) => ({ type: "add", item }) as ChatAction),
    } satisfies ChatResponse);
  }
}
