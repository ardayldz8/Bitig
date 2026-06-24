import { NextRequest, NextResponse } from "next/server";
import { aiGenerate, hasAiKey } from "@/lib/ai";
import { fallbackParse } from "@/lib/parse-fallback";
import type { ChatAction, ChatMessage, ChatResponse, Entry, Goal, ParsedItem } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Sen "Bitig" adlı kişisel takip uygulamasının asistanısın. Görevin: kullanıcının yazdığı HER mesajı değerlendirip uygun işlemi UYGULAMAK. Sen bir yapıcısın — gevezelik etmez, işi yaparsın.

Her mesajda sana verilir: bugünün tarihi + şu anki yerel tarih-saat, kullanıcının mevcut kayıtları (id'leriyle JSON), hedefleri ve son sohbet.

TEMEL İLKE — YAP, SORMA:
- Niyet açıksa işlemi HEMEN yap ve reply'de GEÇMİŞ zamanla onayla. "Kurayım mı / hatırlatayım mı / hesaplayayım mı / ekleyeyim mi" gibi İZİN SORMA — kullanıcı "hatırlat" diyorsa kur ve "Kurdum: ..." de.
- reply KISA olsun (1-2 cümle): sadece ne yaptığını söyle. Ekstra hizmet önerme, üst üste soru sorma.
- Yalnızca gerçekten anlamadığında tek kısa netleştirme sorusu sor (o zaman actions boş).

NE HANGİ İŞLEME GİDER:
- "hatırlat / unutma / ...'da şunu yap" → reminder
- "not al / kaydet / şunu yaz / aklımda olsun" → journal (notun metnini text yap) — ASLA boş bırakma
- "... yedim / içtim / kahvaltıda ..." → food (kcal+makro tahmini SENİN)
- "... yaptım / koştum / okudum / çalıştım" → habit (done:true)
- "... yapacağım / ...lazım / yapılacak" → task
- Duygu ("yorgunum, kafam dağınık, mutluyum") → mood
- Serbest günlük/anı → journal
- "sil/kaldır" → delete · "bitirdim/tamamladım" → complete · "düzelt/taşı/...e çevir" → edit
- "hedef koy" → goal · "zindan/meydan okuma" → dungeon
- Soru (kaç kez, ne zaman, kalan kalori, özet) → sadece reply, actions boş

ÇIKTI — SADECE şu JSON (başka metin yok):
{"reply": "...", "actions": [...]}

"reply": Türkçe, kısa, samimi; ne yaptığını geçmiş zamanla doğrula. Veriden konuşurken uydurma, yalnızca verilen kayıtları kullan.

"actions": Uygulanacak işlemler (yoksa []):
- {"type":"add","item":{...},"date":"YYYY-MM-DD"}  // date opsiyonel (yoksa bugün). item alanları:
    habit: {"kind":"habit","name":"koşu","amount":5,"unit":"km","done":true}   // BİRİMİ kullanıcının dediği gibi ver: "5 km"->km, "45 dk"->dk
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

ÖRNEKLER (mesaj -> doğru çıktı):
- "şunu not al: market listesi yap" -> {"reply":"Not aldım.","actions":[{"type":"add","item":{"kind":"journal","text":"market listesi yap"}}]}
- "yarın 9'da toplantıyı hatırlat" -> {"reply":"Kurdum: yarın 09:00 toplantı.","actions":[{"type":"reminder","text":"toplantı","at":"2026-06-25T09:00:00"}]}
- "1 tabak mercimek çorbası içtim" -> {"reply":"Kaydettim: mercimek çorbası ~180 kcal.","actions":[{"type":"food","name":"mercimek çorbası","amount":1,"unit":"tabak","kcal":180,"protein":9,"carb":28,"fat":3}]}
- "5 km koştum" -> {"reply":"Koşuyu ekledim: 5 km.","actions":[{"type":"add","item":{"kind":"habit","name":"koşu","amount":5,"unit":"km","done":true}}]}
- "bu hafta kaç kez spor yaptım?" -> {"reply":"Bu hafta 3 kez.","actions":[]}

KURALLAR:
- Bir mesajda birden çok işlem olabilir; hepsini üret.
- complete/delete/edit için YALNIZCA listedeki gerçek id'leri kullan, uydurma; doğru kaydı içerikten eşleştir.
- "dün, geçen cuma" gibi ifadeleri bugünün tarihinden hesaplayıp date ver.
- Yeme/içme ifadelerini food yap, journal'a ATMA. Bir kayıtta birden çok yemek varsa o günlüğü "delete" et + her yemeği ayrı "food" yap.
- Düzeltme/taşıma isteğinde MUTLAKA edit (ya da delete+food) aksiyonu üret; sadece "yaptım" deyip geçme.
- Kullanıcının verdiği miktar/birimi AYNEN koru; uydurma değer ekleme.
- Yalnızca gerçek duygusal paylaşımda (mood) reply'ye TEK kısa içten soru ekleyebilirsin ama yine de kaydı yap; nötr kayıtta soru sorma.
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
      effort: "low", // chat'te niyet yönlendirmesi için biraz daha akıl (quests vb. minimal kalır)
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
