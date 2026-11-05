/* MACAN — quote request schema + WhatsApp message builder.
 * One source of truth: the dialog renders its questions from SERVICES / COMMON, and buildMessage() turns the
 * answers into the text that opens in WhatsApp. Pure functions, no DOM — unit tested in _dev/tests/. */

export const PHONE = '201120010487';

const DEFAULT_MESSAGE = 'أهلاً MACAN، عايز أعرف تفاصيل أكتر عن شغلكم';

const HOME_SIZES = { s: 'أقل من 100 م²', m: '100–150 م²', l: '150–200 م²', xl: 'أكتر من 200 م²' };
const OUTDOOR_SIZES = { s: 'أقل من 20 م²', m: '20–40 م²', l: '40–70 م²', xl: 'أكتر من 70 م²' };

/** Each field: key (answer name), q (question shown), msg (label in the message), type, options {value: label}. */
export const SERVICES = {
  finishing: {
    title: 'تشطيب كامل',
    hint: 'من المحارة لحد المفتاح',
    fields: [
      { key: 'unit', q: 'نوع المكان', msg: 'المكان', type: 'single', options: { apartment: 'شقة', duplex: 'دوبلكس', villa: 'فيلا' } },
      { key: 'stage', q: 'الوحدة دلوقتي على إيه؟', msg: 'الحالة', type: 'single', options: { brick: 'طوب أحمر', plaster: 'محارة', semi: 'نص تشطيب', unsure: 'مش متأكد' } },
      { key: 'size', q: 'المساحة التقريبية', msg: 'المساحة', type: 'single', options: HOME_SIZES },
    ],
  },
  pergola: {
    title: 'برجولة أو تجهيز سطح',
    hint: 'خشب، معدن، أو مظلة قماش',
    fields: [
      { key: 'kind', q: 'نوع البرجولة', msg: 'النوع', type: 'single', options: { wood: 'برجولة خشب', metal: 'برجولة معدن', fabric: 'مظلة قماش', advice: 'محتاج رأيكم' } },
      { key: 'place', q: 'هتتركب فين؟', msg: 'المكان', type: 'single', options: { roof: 'سطح', garden: 'جنينة', terrace: 'تراس أو بلكونة' } },
      { key: 'size', q: 'المساحة التقريبية', msg: 'المساحة', type: 'single', options: OUTDOOR_SIZES },
      { key: 'lighting', q: 'عايزها بإضاءة', msg: 'مع إضاءة', type: 'toggle' },
    ],
  },
  renovation: {
    title: 'تجديد شقة قديمة',
    hint: 'مطبخ، حمامات، أرضيات، وأكتر',
    fields: [
      { key: 'parts', q: 'عايز تجدد إيه؟', msg: 'عايز أجدد', type: 'multi', options: { kitchen: 'المطبخ', baths: 'الحمامات', floors: 'الأرضيات', paint: 'النقاشة', electric: 'الكهربا', plumbing: 'السباكة', whole: 'الشقة كلها' } },
      { key: 'size', q: 'المساحة التقريبية', msg: 'المساحة', type: 'single', options: HOME_SIZES },
    ],
  },
};

/** Questions asked for every service (step 3). */
export const COMMON = [
  { key: 'area', q: 'المنطقة', msg: 'المنطقة', type: 'text', max: 60 },
  { key: 'timing', q: 'عايز تبدأ إمتى؟', msg: 'الميعاد', type: 'single', options: { asap: 'في أسرع وقت', month: 'خلال شهر', quarter: 'خلال 2–3 شهور', exploring: 'لسه بستكشف' } },
  { key: 'name', q: 'اسمك', type: 'text', max: 40 },
];

/** One line, trimmed, whitespace collapsed, capped by characters (code points, so emoji never split). */
export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const flat = value.replace(/\s+/gu, ' ').trim();
  return Array.from(flat).slice(0, max).join('').trim();
}

function line(field, answers) {
  const v = answers[field.key];
  switch (field.type) {
    case 'single':
      return Object.hasOwn(field.options, v) ? `• ${field.msg}: ${field.options[v]}` : '';
    case 'multi': {
      const picked = Array.isArray(v) ? Object.keys(field.options).filter((k) => v.includes(k)) : [];
      return picked.length ? `• ${field.msg}: ${picked.map((k) => field.options[k]).join('، ')}` : '';
    }
    case 'toggle':
      return v === true ? `• ${field.msg}` : '';
    case 'text': {
      const t = cleanText(v, field.max);
      return t && field.msg ? `• ${field.msg}: ${t}` : '';
    }
    default:
      return '';
  }
}

export function buildMessage(answers) {
  const a = answers && typeof answers === 'object' ? answers : {};
  const service = Object.hasOwn(SERVICES, a.service) ? SERVICES[a.service] : null;
  if (!service) return DEFAULT_MESSAGE;

  const name = cleanText(a.name, COMMON.find((f) => f.key === 'name').max);
  const lines = [
    'أهلاً MACAN 👋',
    `عايز عرض سعر: ${service.title}`,
    ...service.fields.map((f) => line(f, a)),
    ...COMMON.filter((f) => f.key !== 'name').map((f) => line(f, a)),
    name ? `اسمي: ${name}` : '',
    '(من موقع MACAN)',
  ];
  return lines.filter(Boolean).join('\n');
}

export function buildWhatsAppUrl(answers, phone = PHONE) {
  // encodeURIComponent (not URLSearchParams): spaces become %20, never "+"
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(answers))}`;
}
