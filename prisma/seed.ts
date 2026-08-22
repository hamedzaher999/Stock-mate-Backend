/**
 * =============================================================================
 * SEED SCRIPT - Red Crescent Hospital Pharmacy / Inventory Management System
 * =============================================================================
 *
 * Fills the database with a realistic, internally-consistent dataset:
 *   - Catalog first (units, categories, products, variants, suppliers)
 *   - Then org structure (departments, roles, users)
 *   - Then configuration (stock settings, variant suppliers)
 *   - Then ~6 months of historical operational data, generated in strict
 *     causal order so every foreign key refers to a row that was actually
 *     created earlier in this run (never a guessed/random UUID):
 *       purchase requests -> receipts -> batches -> batch stock (+ ledger)
 *       -> department refill requests -> deliveries (+ ledger)
 *       -> patients -> queue -> visits -> prescriptions -> dispensing (+ ledger)
 *       -> adjustments (+ ledger) -> stock counts -> disposal transfers
 *       -> disposal sales
 *
 * All human-facing text (names, notes, reasons) is in Arabic, matching the
 * app's existing conventions (see http-exception.filter.ts, notification
 * bodies, etc. in the codebase, which are all Arabic).
 *
 * Run with:  npx ts-node prisma/seed.ts
 * or wire into package.json:  "prisma": { "seed": "ts-node prisma/seed.ts" }
 * =============================================================================
 */

import {
    PrismaClient,
    DepartmentType,
    MaterialType,
    BatchType,
    TransactionType,
    AdjustmentType,
    ReferenceType,
    DisposalItemSource,
    DisposalTransferStatus,
    StockCountStatus,
    QueueStatus,
    VisitStatus,
    PrescriptionStatus,
    CycleStatus,
    FrequencyUnit,
    RefillRequestPriority,
    RefillRequestType,
    PurchaseReceiptStatus,
    DisposalSaleRequestStatus,
    RequestStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// -----------------------------------------------------------------------------
// Deterministic RNG (seeded) so re-running produces a stable, reviewable dataset
// -----------------------------------------------------------------------------
let rngState = 88172645463325252n;
function nextRandom(): number {
    // xorshift64* - deterministic, fast, good enough distribution for seed data
    rngState ^= rngState << 13n;
    rngState ^= rngState >> 7n;
    rngState ^= rngState << 17n;
    rngState &= 0xffffffffffffffffn;
    return Number(rngState % 1000000n) / 1000000;
}
function randInt(min: number, max: number): number {
    // inclusive of min and max
    return Math.floor(nextRandom() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, decimals = 2): number {
    const v = nextRandom() * (max - min) + min;
    const factor = Math.pow(10, decimals);
    return Math.round(v * factor) / factor;
}
function pick<T>(arr: readonly T[]): T {
    return arr[randInt(0, arr.length - 1)];
}
function pickMany<T>(arr: readonly T[], count: number): T[] {
    const pool = [...arr];
    const result: T[] = [];
    const n = Math.min(count, pool.length);
    for (let i = 0; i < n; i++) {
        const idx = randInt(0, pool.length - 1);
        result.push(pool[idx]);
        pool.splice(idx, 1);
    }
    return result;
}
function chance(probability: number): boolean {
    return nextRandom() < probability;
}
function shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(0, i);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// -----------------------------------------------------------------------------
// Date helpers - all historical data is anchored to "NOW" and walks backward
// -----------------------------------------------------------------------------
const NOW = new Date();
const SIX_MONTHS_AGO = addDays(NOW, -183);

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}
function addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}
function randomDateBetween(start: Date, end: Date): Date {
    const span = end.getTime() - start.getTime();
    return new Date(start.getTime() + nextRandom() * span);
}
function dateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
function generateRequestNumber(prefix: string, seq: number): string {
    const datePart = `${NOW.getFullYear()}${String(NOW.getMonth() + 1).padStart(2, '0')}${String(NOW.getDate()).padStart(2, '0')}`;
    return `${prefix}-${datePart}-${String(seq).padStart(5, '0')}`;
}

// -----------------------------------------------------------------------------
// Arabic name pools
// -----------------------------------------------------------------------------
const ARABIC_FIRST_NAMES_MALE = [
    'محمد',
    'أحمد',
    'علي',
    'حسين',
    'عمر',
    'خالد',
    'ياسر',
    'سامر',
    'فادي',
    'بشار',
    'مصطفى',
    'عبدالله',
    'كريم',
    'زياد',
    'وائل',
    'رامي',
    'إياد',
    'حسام',
    'طارق',
    'نبيل',
    'سليم',
    'جهاد',
    'عماد',
    'فراس',
    'باسل',
];
const ARABIC_FIRST_NAMES_FEMALE = [
    'فاطمة',
    'مريم',
    'سارة',
    'ليلى',
    'نور',
    'رنا',
    'هدى',
    'لمى',
    'دانا',
    'ياسمين',
    'رهف',
    'جنى',
    'ريم',
    'ديما',
    'غادة',
    'سلمى',
    'إيمان',
    'وفاء',
    'نغم',
    'سناء',
    'روان',
    'ميساء',
    'لينا',
    'هيا',
];
const ARABIC_LAST_NAMES = [
    'الأحمد',
    'الحسن',
    'الخطيب',
    'الشامي',
    'العلي',
    'حمدان',
    'دياب',
    'زيدان',
    'سلامة',
    'شاهين',
    'عبدو',
    'قاسم',
    'كنعان',
    'محفوظ',
    'ناصر',
    'نعمة',
    'يوسف',
    'الحلبي',
    'الدمشقي',
    'المصري',
    'حداد',
    'خوري',
    'رزق',
    'سمعان',
    'عيسى',
    'فارس',
    'قزق',
    'مراد',
    'وهبة',
];
function randomFullName(): string {
    const isMale = chance(0.55);
    const first = isMale
        ? pick(ARABIC_FIRST_NAMES_MALE)
        : pick(ARABIC_FIRST_NAMES_FEMALE);
    const last = pick(ARABIC_LAST_NAMES);
    return `${first} ${last}`;
}

const DOCTOR_SPECIALTIES = [
    'طب عام',
    'باطنية',
    'أطفال',
    'نسائية وتوليد',
    'عظمية',
    'جلدية',
    'أنف وأذن وحنجرة',
    'عيون',
    'قلبية',
    'صدرية',
    'مسالك بولية',
    'أعصاب',
];

const STANDARD_DEPARTMENT_NAMES = [
    'قسم الطب الباطني',
    'قسم طب الأطفال',
    'قسم النسائية والتوليد',
    'قسم العظمية',
    'قسم الجلدية',
    'قسم الأنف والأذن والحنجرة',
    'قسم العيون',
    'قسم القلبية',
    'قسم الطوارئ',
];

const CATEGORY_TREE: { name: string; children: string[] }[] = [
    {
        name: 'مسكنات ومضادات التهاب',
        children: ['مسكنات الألم', 'خافضات الحرارة'],
    },
    {
        name: 'مضادات حيوية',
        children: ['بنسلينات', 'سيفالوسبورينات', 'ماكروليدات'],
    },
    { name: 'أدوية القلب والأوعية', children: ['خافضات ضغط', 'مدرات بول'] },
    {
        name: 'أدوية الجهاز التنفسي',
        children: ['موسعات قصبية', 'أدوية السعال'],
    },
    {
        name: 'أدوية الجهاز الهضمي',
        children: ['مضادات الحموضة', 'مضادات التقيؤ'],
    },
    { name: 'فيتامينات ومكملات', children: [] },
    { name: 'مستلزمات طبية', children: ['قفازات وكمامات', 'شاش وضمادات'] },
    { name: 'أجهزة ومعدات', children: [] },
];

const UNITS: { name: string; abbreviation: string }[] = [
    { name: 'قرص', abbreviation: 'قرص' },
    { name: 'كبسولة', abbreviation: 'كبس' },
    { name: 'أمبولة', abbreviation: 'أمب' },
    { name: 'قارورة', abbreviation: 'قار' },
    { name: 'علبة', abbreviation: 'علبة' },
    { name: 'شريط', abbreviation: 'شريط' },
    { name: 'مل', abbreviation: 'مل' },
    { name: 'كيس', abbreviation: 'كيس' },
    { name: 'زوج', abbreviation: 'زوج' },
    { name: 'قطعة', abbreviation: 'قطعة' },
];

const PRODUCTS_SEED: {
    name: string;
    category: string;
    materialType: MaterialType;
    description: string;
    variants: { variantName: string; unit: string }[];
    nearExpiryDisposalDays?: number;
}[] = [
    {
        name: 'باراسيتامول',
        category: 'مسكنات الألم',
        materialType: MaterialType.consumable,
        description: 'خافض حرارة ومسكن ألم عام',
        nearExpiryDisposalDays: 30,
        variants: [
            { variantName: 'باراسيتامول 500 ملغ', unit: 'قرص' },
            { variantName: 'باراسيتامول شراب للأطفال', unit: 'قارورة' },
        ],
    },
    {
        name: 'إيبوبروفين',
        category: 'مسكنات الألم',
        materialType: MaterialType.consumable,
        description: 'مضاد التهاب غير ستيرويدي',
        nearExpiryDisposalDays: 30,
        variants: [{ variantName: 'إيبوبروفين 400 ملغ', unit: 'قرص' }],
    },
    {
        name: 'ديكلوفيناك',
        category: 'مسكنات الألم',
        materialType: MaterialType.consumable,
        description: 'مسكن للآلام العضلية والمفصلية',
        variants: [
            { variantName: 'ديكلوفيناك 75 ملغ حقن', unit: 'أمبولة' },
            { variantName: 'ديكلوفيناك جل موضعي', unit: 'أنبوب' },
        ],
    },
    {
        name: 'أموكسيسيلين',
        category: 'بنسلينات',
        materialType: MaterialType.consumable,
        description: 'مضاد حيوي واسع الطيف',
        nearExpiryDisposalDays: 45,
        variants: [
            { variantName: 'أموكسيسيلين 500 ملغ كبسولة', unit: 'كبسولة' },
            { variantName: 'أموكسيسيلين شراب للأطفال', unit: 'قارورة' },
        ],
    },
    {
        name: 'أموكسيسيلين-كلافولانيك',
        category: 'بنسلينات',
        materialType: MaterialType.consumable,
        description: 'مضاد حيوي مركب',
        variants: [{ variantName: 'أوغمنتين 1 غ قرص', unit: 'قرص' }],
    },
    {
        name: 'سيفترياكسون',
        category: 'سيفالوسبورينات',
        materialType: MaterialType.consumable,
        description: 'مضاد حيوي حقني واسع الطيف',
        nearExpiryDisposalDays: 45,
        variants: [
            { variantName: 'سيفترياكسون 1 غ حقن وريدي', unit: 'قارورة' },
        ],
    },
    {
        name: 'أزيثرومايسين',
        category: 'ماكروليدات',
        materialType: MaterialType.consumable,
        description: 'مضاد حيوي لالتهابات الجهاز التنفسي',
        variants: [{ variantName: 'أزيثرومايسين 500 ملغ', unit: 'قرص' }],
    },
    {
        name: 'أملوديبين',
        category: 'خافضات ضغط',
        materialType: MaterialType.consumable,
        description: 'خافض ضغط من فئة حاصرات الكالسيوم',
        variants: [
            { variantName: 'أملوديبين 5 ملغ', unit: 'قرص' },
            { variantName: 'أملوديبين 10 ملغ', unit: 'قرص' },
        ],
    },
    {
        name: 'ليزينوبريل',
        category: 'خافضات ضغط',
        materialType: MaterialType.consumable,
        description: 'مثبط الإنزيم المحول للأنجيوتنسين',
        variants: [{ variantName: 'ليزينوبريل 10 ملغ', unit: 'قرص' }],
    },
    {
        name: 'فوروسيميد',
        category: 'مدرات بول',
        materialType: MaterialType.consumable,
        description: 'مدر بول من فئة اللوب',
        variants: [
            { variantName: 'فوروسيميد 40 ملغ', unit: 'قرص' },
            { variantName: 'فوروسيميد حقن', unit: 'أمبولة' },
        ],
    },
    {
        name: 'سالبوتامول',
        category: 'موسعات قصبية',
        materialType: MaterialType.consumable,
        description: 'موسع قصبي للربو ونوبات الضيق التنفسي',
        nearExpiryDisposalDays: 30,
        variants: [{ variantName: 'بخاخ سالبوتامول', unit: 'علبة' }],
    },
    {
        name: 'ديكستروميثورفان',
        category: 'أدوية السعال',
        materialType: MaterialType.consumable,
        description: 'مضاد للسعال الجاف',
        variants: [{ variantName: 'شراب ديكستروميثورفان', unit: 'قارورة' }],
    },
    {
        name: 'أوميبرازول',
        category: 'مضادات الحموضة',
        materialType: MaterialType.consumable,
        description: 'مثبط مضخة البروتون',
        variants: [{ variantName: 'أوميبرازول 20 ملغ', unit: 'كبسولة' }],
    },
    {
        name: 'رانيتيدين',
        category: 'مضادات الحموضة',
        materialType: MaterialType.consumable,
        description: 'مضاد للحموضة من فئة حاصرات H2',
        variants: [{ variantName: 'رانيتيدين 150 ملغ', unit: 'قرص' }],
    },
    {
        name: 'أوندانسيترون',
        category: 'مضادات التقيؤ',
        materialType: MaterialType.consumable,
        description: 'مضاد للغثيان والتقيؤ',
        variants: [{ variantName: 'أوندانسيترون 4 ملغ حقن', unit: 'أمبولة' }],
    },
    {
        name: 'فيتامين سي',
        category: 'فيتامينات ومكملات',
        materialType: MaterialType.consumable,
        description: 'مكمل غذائي - فيتامين سي',
        variants: [{ variantName: 'فيتامين سي 1000 ملغ فوار', unit: 'شريط' }],
    },
    {
        name: 'فيتامين د3',
        category: 'فيتامينات ومكملات',
        materialType: MaterialType.consumable,
        description: 'مكمل غذائي - فيتامين د',
        variants: [{ variantName: 'فيتامين د3 50000 وحدة', unit: 'كبسولة' }],
    },
    {
        name: 'حديد وحمض فوليك',
        category: 'فيتامينات ومكملات',
        materialType: MaterialType.consumable,
        description: 'مكمل لعلاج فقر الدم',
        variants: [{ variantName: 'أقراص حديد وحمض فوليك', unit: 'قرص' }],
    },
    {
        name: 'قفازات فحص طبية',
        category: 'قفازات وكمامات',
        materialType: MaterialType.consumable,
        description: 'قفازات لاتكس للفحص الطبي - غير معقمة',
        variants: [
            { variantName: 'قفازات لاتكس مقاس صغير', unit: 'علبة' },
            { variantName: 'قفازات لاتكس مقاس متوسط', unit: 'علبة' },
            { variantName: 'قفازات لاتكس مقاس كبير', unit: 'علبة' },
        ],
    },
    {
        name: 'كمامات طبية',
        category: 'قفازات وكمامات',
        materialType: MaterialType.consumable,
        description: 'كمامات طبية ثلاثية الطبقات',
        variants: [{ variantName: 'كمامة طبية ثلاثية الطبقات', unit: 'علبة' }],
    },
    {
        name: 'شاش طبي معقم',
        category: 'شاش وضمادات',
        materialType: MaterialType.consumable,
        description: 'شاش معقم للتضميد',
        variants: [{ variantName: 'شاش معقم 10×10 سم', unit: 'كيس' }],
    },
    {
        name: 'ضمادات لاصقة',
        category: 'شاش وضمادات',
        materialType: MaterialType.consumable,
        description: 'ضمادات لاصقة للجروح السطحية',
        variants: [
            { variantName: 'ضمادات لاصقة متنوعة المقاسات', unit: 'علبة' },
        ],
    },
    {
        name: 'محاليل وريدية',
        category: 'مستلزمات طبية',
        materialType: MaterialType.consumable,
        description: 'محاليل للإماهة الوريدية',
        variants: [
            { variantName: 'محلول ملحي 0.9% 500 مل', unit: 'قارورة' },
            { variantName: 'محلول غلوكوز 5% 500 مل', unit: 'قارورة' },
        ],
    },
    {
        name: 'محاقن طبية',
        category: 'مستلزمات طبية',
        materialType: MaterialType.consumable,
        description: 'محاقن للاستخدام مرة واحدة',
        variants: [
            { variantName: 'محقنة 5 مل', unit: 'قطعة' },
            { variantName: 'محقنة 10 مل', unit: 'قطعة' },
        ],
    },
    {
        name: 'جهاز قياس الضغط',
        category: 'أجهزة ومعدات',
        materialType: MaterialType.fixed_asset,
        description: 'جهاز رقمي لقياس ضغط الدم',
        variants: [{ variantName: 'جهاز ضغط رقمي - ذراع', unit: 'قطعة' }],
    },
    {
        name: 'جهاز قياس السكر',
        category: 'أجهزة ومعدات',
        materialType: MaterialType.fixed_asset,
        description: 'جهاز قياس سكر الدم المنزلي',
        variants: [{ variantName: 'جهاز غلوكومتر', unit: 'قطعة' }],
    },
];

const SUPPLIER_NAMES = [
    'شركة الشفاء للأدوية',
    'مؤسسة الرحمة الطبية',
    'شركة دمشق للصناعات الدوائية',
    'شركة الأمل للمستلزمات الطبية',
    'مجموعة الهلال للتوريدات الطبية',
    'شركة النور الطبية',
    'مؤسسة الوفاء للأدوية',
    'شركة بردى للأدوية',
];

const DESTINATION_NAMES = [
    'مصنع إعادة التدوير الوطني',
    'جمعية البيئة الخضراء',
    'شركة التخلص الآمن للنفايات الطبية',
    'مركز جمع المواد القابلة لإعادة التدوير',
];

const VISIT_DIAGNOSES = [
    'التهاب الجهاز التنفسي العلوي',
    'ارتفاع ضغط الدم',
    'التهاب المعدة والأمعاء',
    'داء السكري النوع الثاني',
    'التهاب اللوزتين',
    'آلام أسفل الظهر',
    'التهاب الأذن الوسطى',
    'فقر الدم بعوز الحديد',
    'الربو القصبي',
    'التهاب المسالك البولية',
    'الصداع النصفي',
    'التهاب المفاصل',
];

const CLINICAL_NOTES_POOL = [
    'المريض يعاني من أعراض خفيفة، تم وصف العلاج المناسب مع متابعة بعد أسبوع.',
    'الحالة مستقرة، تم تعديل الجرعة السابقة بناءً على الفحص السريري.',
    'تم إجراء الفحص السريري الكامل، والنتائج ضمن الحدود المقبولة عموماً.',
    'المريض يشكو من الأعراض منذ ثلاثة أيام، لا توجد مضاعفات ظاهرة حالياً.',
    'تحسن ملحوظ مقارنة بالزيارة السابقة، الاستمرار على نفس الخطة العلاجية.',
    'تم تحويل المريض لإجراء تحاليل مخبرية إضافية لتأكيد التشخيص.',
];

const CANCEL_REASONS = [
    'طلب المريض إلغاء الموعد لظروف شخصية.',
    'تعارض في جدول الطبيب أدى إلى إلغاء الزيارة.',
    'تم تسجيل الزيارة عن طريق الخطأ.',
    'المريض لم يحضر في الوقت المحدد وتم إلغاء الإدخال.',
];

const REJECTION_REASONS = [
    'الكمية المطلوبة تتجاوز الحاجة الفعلية للقسم حالياً.',
    'يوجد مخزون كافٍ من هذا الصنف في القسم حالياً.',
    'الميزانية المخصصة لهذا الشهر مستنفدة، يرجى إعادة التقديم الشهر القادم.',
    'يرجى تدقيق الكميات المطلوبة وإعادة تقديم الطلب.',
    'المورد المقترح غير معتمد حالياً، يرجى اختيار مورد آخر.',
];

const ADJUSTMENT_NOTES: Record<AdjustmentType, string[]> = {
    damaged: [
        'تلف أثناء النقل من المستودع.',
        'تكسر العبوة أثناء التخزين.',
        'تلف بسبب سوء التخزين في القسم.',
    ],
    expired: [
        'تم اكتشاف انتهاء الصلاحية أثناء الجرد الدوري.',
        'انتهت الصلاحية قبل الاستهلاك الكامل للدفعة.',
    ],
    shrinkage: [
        'عجز في المخزون تم اكتشافه أثناء الجرد.',
        'فرق غير مفسر بين المخزون الدفتري والفعلي.',
    ],
    found: [
        'تم العثور على كمية إضافية أثناء الجرد لم تكن مسجلة.',
        'تصحيح لخطأ سابق في تسجيل الكمية المستلمة.',
    ],
};

const DISPOSAL_CANCEL_REASONS = [
    'تراجع القسم عن طلب التخلص بعد إعادة التقييم.',
    'تم تحديد أن بعض العناصر لا تزال صالحة للاستخدام.',
];

const DELIVERY_NOTES = [
    'تم الشحن حسب الكمية الموافق عليها بالكامل.',
    'تم شحن جزء من الكمية بسبب نقص في المخزون المتوفر بالمستودع.',
    'تم التحقق من تاريخ الصلاحية قبل الشحن.',
];

const RECEIPT_NOTES = [
    'تم استلام البضاعة بحالة جيدة ومطابقة للفاتورة.',
    'تم استلام الشحنة مع ملاحظة تأخر بسيط عن الموعد المتفق عليه.',
    'الكمية المستلمة مطابقة تماماً للكمية المطلوبة.',
];

// =============================================================================
// PERMISSIONS constant (mirrors src/common/constants/permissions.constants.ts)
// =============================================================================
const PERMISSIONS = {
    MANAGE_DEPARTMENTS: 'manage_departments',
    MANAGE_ACCOUNTS: 'manage_accounts',
    MANAGE_ROLES: 'manage_roles',
    MANAGE_USER_PERMISSIONS: 'manage_user_permissions',
    MANAGE_DOCTORS: 'manage_doctors',
    MANAGE_MATERIALS: 'manage_materials',
    MANAGE_DEPARTMENT_MATERIALS: 'manage_department_materials',
    MANAGE_UNITS: 'manage_units',
    MANAGE_CATEGORIES: 'manage_categories',
    MANAGE_SUPPLIERS: 'manage_suppliers',
    MANAGE_MATERIAL_SUPPLIERS: 'manage_material_suppliers',
    CREATE_PURCHASE_REQUEST: 'create_purchase_request',
    APPROVE_PURCHASE_REQUEST_HOSPITAL: 'approve_purchase_request_hospital',
    APPROVE_PURCHASE_REQUEST_MANAGER: 'approve_purchase_request_manager',
    RECEIVE_PURCHASE: 'receive_purchase',
    CONFIRM_PURCHASE_RECEIPT: 'confirm_purchase_receipt',
    VIEW_PURCHASING_HISTORY: 'view_purchasing_history',
    VIEW_PURCHASING_REPORTS: 'view_purchasing_reports',
    CREATE_DEPARTMENT_REFILL_REQUEST: 'create_department_refill_request',
    APPROVE_DEPARTMENT_REFILL_REQUEST_HOSPITAL:
        'approve_department_refill_request_hospital',
    APPROVE_DEPARTMENT_REFILL_REQUEST_MANAGER:
        'approve_department_refill_request_manager',
    PREPARE_DEPARTMENT_REFILL: 'prepare_department_refill',
    CONFIRM_DEPARTMENT_DELIVERY: 'confirm_department_delivery',
    VIEW_INVENTORY: 'view_inventory',
    TRANSFER_INVENTORY: 'transfer_inventory',
    PERFORM_INVENTORY_ADJUSTMENT: 'perform_inventory_adjustment',
    PERFORM_STOCK_COUNT: 'perform_stock_count',
    RECORD_DEPARTMENT_CONSUMPTION: 'record_department_consumption',
    ADD_PATIENT: 'add_patient',
    VIEW_PATIENTS: 'view_patients',
    VIEW_PATIENT_HISTORY: 'view_patient_history',
    MANAGE_DEPARTMENT_QUEUE: 'manage_department_queue',
    CANCEL_VISIT: 'cancel_visit',
    START_CONSULTATION: 'start_consultation',
    CREATE_PRESCRIPTION: 'create_prescription',
    RENEW_PRESCRIPTION: 'renew_prescription',
    CANCEL_PRESCRIPTION: 'cancel_prescription',
    MANAGE_ALL_PRESCRIPTIONS: 'manage_all_prescriptions',
    DISPENSE_PRESCRIPTION: 'dispense_prescription',
    VIEW_REPORTS: 'view_reports',
    MANAGE_PERIODIC_REFILL_SCHEDULES: 'manage_periodic_refill_schedules',
    VIEW_DISPOSAL: 'view_disposal',
    MANAGE_DISPOSAL_TRANSFERS: 'manage_disposal_transfers',
    MANAGE_DESTINATIONS: 'manage_destinations',
    CREATE_DISPOSAL_SALE_REQUEST: 'create_disposal_sale_request',
    APPROVE_DISPOSAL_SALE_REQUEST: 'approve_disposal_sale_request',
} as const;

const PERMISSION_META: { code: string; name: string; category: string }[] = [
    {
        code: PERMISSIONS.MANAGE_DEPARTMENTS,
        name: 'إدارة الأقسام',
        category: 'الإدارة العامة',
    },
    {
        code: PERMISSIONS.MANAGE_ACCOUNTS,
        name: 'إدارة الحسابات',
        category: 'الإدارة العامة',
    },
    {
        code: PERMISSIONS.MANAGE_ROLES,
        name: 'إدارة الأدوار',
        category: 'الإدارة العامة',
    },
    {
        code: PERMISSIONS.MANAGE_USER_PERMISSIONS,
        name: 'إدارة صلاحيات المستخدمين',
        category: 'الإدارة العامة',
    },
    {
        code: PERMISSIONS.MANAGE_DOCTORS,
        name: 'إدارة الأطباء',
        category: 'الإدارة العامة',
    },
    {
        code: PERMISSIONS.MANAGE_MATERIALS,
        name: 'إدارة المواد',
        category: 'الكتالوج',
    },
    {
        code: PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS,
        name: 'إدارة مواد القسم',
        category: 'الكتالوج',
    },
    {
        code: PERMISSIONS.MANAGE_UNITS,
        name: 'إدارة الوحدات',
        category: 'الكتالوج',
    },
    {
        code: PERMISSIONS.MANAGE_CATEGORIES,
        name: 'إدارة الفئات',
        category: 'الكتالوج',
    },
    {
        code: PERMISSIONS.MANAGE_SUPPLIERS,
        name: 'إدارة الموردين',
        category: 'الكتالوج',
    },
    {
        code: PERMISSIONS.MANAGE_MATERIAL_SUPPLIERS,
        name: 'إدارة موردي المواد',
        category: 'الكتالوج',
    },
    {
        code: PERMISSIONS.CREATE_PURCHASE_REQUEST,
        name: 'إنشاء طلب شراء',
        category: 'المشتريات',
    },
    {
        code: PERMISSIONS.APPROVE_PURCHASE_REQUEST_HOSPITAL,
        name: 'موافقة المستشفى على طلب الشراء',
        category: 'المشتريات',
    },
    {
        code: PERMISSIONS.APPROVE_PURCHASE_REQUEST_MANAGER,
        name: 'موافقة المدير على طلب الشراء',
        category: 'المشتريات',
    },
    {
        code: PERMISSIONS.RECEIVE_PURCHASE,
        name: 'استلام المشتريات',
        category: 'المشتريات',
    },
    {
        code: PERMISSIONS.CONFIRM_PURCHASE_RECEIPT,
        name: 'تأكيد إيصال الشراء',
        category: 'المشتريات',
    },
    {
        code: PERMISSIONS.VIEW_PURCHASING_HISTORY,
        name: 'عرض سجل المشتريات',
        category: 'المشتريات',
    },
    {
        code: PERMISSIONS.VIEW_PURCHASING_REPORTS,
        name: 'عرض تقارير المشتريات',
        category: 'المشتريات',
    },
    {
        code: PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST,
        name: 'إنشاء طلب تزويد قسم',
        category: 'تزويد الأقسام',
    },
    {
        code: PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_HOSPITAL,
        name: 'موافقة المستشفى على طلب التزويد',
        category: 'تزويد الأقسام',
    },
    {
        code: PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_MANAGER,
        name: 'موافقة المدير على طلب التزويد',
        category: 'تزويد الأقسام',
    },
    {
        code: PERMISSIONS.PREPARE_DEPARTMENT_REFILL,
        name: 'تجهيز تزويد القسم',
        category: 'تزويد الأقسام',
    },
    {
        code: PERMISSIONS.CONFIRM_DEPARTMENT_DELIVERY,
        name: 'تأكيد استلام التزويد',
        category: 'تزويد الأقسام',
    },
    {
        code: PERMISSIONS.VIEW_INVENTORY,
        name: 'عرض المخزون',
        category: 'المخزون',
    },
    {
        code: PERMISSIONS.TRANSFER_INVENTORY,
        name: 'تحويل المخزون',
        category: 'المخزون',
    },
    {
        code: PERMISSIONS.PERFORM_INVENTORY_ADJUSTMENT,
        name: 'إجراء تسوية مخزون',
        category: 'المخزون',
    },
    {
        code: PERMISSIONS.PERFORM_STOCK_COUNT,
        name: 'إجراء جرد مخزون',
        category: 'المخزون',
    },
    {
        code: PERMISSIONS.RECORD_DEPARTMENT_CONSUMPTION,
        name: 'تسجيل استهلاك القسم',
        category: 'المخزون',
    },
    { code: PERMISSIONS.ADD_PATIENT, name: 'إضافة مريض', category: 'المرضى' },
    { code: PERMISSIONS.VIEW_PATIENTS, name: 'عرض المرضى', category: 'المرضى' },
    {
        code: PERMISSIONS.VIEW_PATIENT_HISTORY,
        name: 'عرض السجل الطبي للمريض',
        category: 'المرضى',
    },
    {
        code: PERMISSIONS.MANAGE_DEPARTMENT_QUEUE,
        name: 'إدارة قائمة انتظار القسم',
        category: 'المرضى',
    },
    {
        code: PERMISSIONS.CANCEL_VISIT,
        name: 'إلغاء زيارة طبية',
        category: 'المرضى',
    },
    {
        code: PERMISSIONS.START_CONSULTATION,
        name: 'بدء استشارة طبية',
        category: 'الاستشارات',
    },
    {
        code: PERMISSIONS.CREATE_PRESCRIPTION,
        name: 'إنشاء وصفة طبية',
        category: 'الاستشارات',
    },
    {
        code: PERMISSIONS.RENEW_PRESCRIPTION,
        name: 'تجديد وصفة طبية',
        category: 'الاستشارات',
    },
    {
        code: PERMISSIONS.CANCEL_PRESCRIPTION,
        name: 'إلغاء وصفة طبية',
        category: 'الاستشارات',
    },
    {
        code: PERMISSIONS.MANAGE_ALL_PRESCRIPTIONS,
        name: 'إدارة جميع الوصفات الطبية',
        category: 'الاستشارات',
    },
    {
        code: PERMISSIONS.DISPENSE_PRESCRIPTION,
        name: 'صرف وصفة طبية',
        category: 'الصيدلية',
    },
    {
        code: PERMISSIONS.VIEW_REPORTS,
        name: 'عرض التقارير',
        category: 'التقارير',
    },
    {
        code: PERMISSIONS.MANAGE_PERIODIC_REFILL_SCHEDULES,
        name: 'إدارة جداول التزويد المتكرر',
        category: 'تزويد الأقسام',
    },
    {
        code: PERMISSIONS.VIEW_DISPOSAL,
        name: 'عرض عمليات التخلص من الهالك',
        category: 'الهالك',
    },
    {
        code: PERMISSIONS.MANAGE_DISPOSAL_TRANSFERS,
        name: 'إدارة نقل الهالك',
        category: 'الهالك',
    },
    {
        code: PERMISSIONS.MANAGE_DESTINATIONS,
        name: 'إدارة جهات الوجهة',
        category: 'الهالك',
    },
    {
        code: PERMISSIONS.CREATE_DISPOSAL_SALE_REQUEST,
        name: 'إنشاء طلب بيع هالك',
        category: 'الهالك',
    },
    {
        code: PERMISSIONS.APPROVE_DISPOSAL_SALE_REQUEST,
        name: 'الموافقة على طلب بيع هالك',
        category: 'الهالك',
    },
];

// Role constants (mirrors src/common/constants/roles.constants.ts)
const HOSPITAL_MANAGER_ROLE_NAME = 'hospital_manager';
const WAREHOUSE_MANAGER_ROLE_NAME = 'warehouse_manager';
const PURCHASING_MANAGER_ROLE_NAME = 'purchasing_manager';
const RECEPTION_STAFF_ROLE_NAME = 'reception_staff';
const DOCTOR_ROLE_NAME = 'doctor';
const DISPOSAL_MANAGER_ROLE_NAME = 'disposal_manager';
const PHARMACIST_ROLE_NAME = 'pharmacy_staff';
// Extra role, not in the app's original roles.constants.ts, added specifically
// to host the "department_manager" quick-login account: a named business role
// that manages one standard department (same dual-check pattern as
// warehouse_manager/disposal_manager - department-boundary scoping, not a
// super-admin bypass).
const DEPARTMENT_MANAGER_ROLE_NAME = 'department_manager';

// -----------------------------------------------------------------------------
// Quick-login accounts: fixed emails the frontend/test tooling expects to be
// able to log into. These are wired onto real seeded users of the matching
// role below (never as throwaway placeholder users).
// -----------------------------------------------------------------------------
const QUICK_LOGIN_ACCOUNTS = [
    { role: 'hospital_manager', email: 'hassanmohammad0010@gmail.com' },
    { role: 'warehouse_manager', email: 'warehouse_manager@example.com' },
    { role: 'purchasing_manager', email: 'purchasing_manager@example.com' },
    { role: 'reception_staff', email: 'reception_staff@example.com' },
    { role: 'doctor', email: 'doctor@example.com' },
    { role: 'department_manager', email: 'department_manager@example.com' },
    { role: 'pharmacy_staff', email: 'basharman2003@gmail.com' },
    { role: 'disposal_manager', email: 'disposal.manager@example.com' },
    { role: 'super_admin', email: 'super_admin@example.com' },
] as const;
function quickLoginEmail(
    role: (typeof QUICK_LOGIN_ACCOUNTS)[number]['role'],
): string {
    return QUICK_LOGIN_ACCOUNTS.find((a) => a.role === role)!.email;
}

const ALL_PERMISSION_CODES = PERMISSION_META.map((p) => p.code);

// Role -> permission codes mapping (business-realistic subsets; superAdmin gets all
// permissions implicitly via isSuperAdmin, so it is not listed here explicitly)
const ROLE_PERMISSIONS: Record<string, string[]> = {
    [HOSPITAL_MANAGER_ROLE_NAME]: ALL_PERMISSION_CODES, // hospital manager: broad oversight role
    [WAREHOUSE_MANAGER_ROLE_NAME]: [
        PERMISSIONS.VIEW_INVENTORY,
        PERMISSIONS.TRANSFER_INVENTORY,
        PERMISSIONS.PERFORM_INVENTORY_ADJUSTMENT,
        PERMISSIONS.PERFORM_STOCK_COUNT,
        PERMISSIONS.RECEIVE_PURCHASE,
        PERMISSIONS.CONFIRM_PURCHASE_RECEIPT,
        PERMISSIONS.VIEW_PURCHASING_HISTORY,
        PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_MANAGER,
        PERMISSIONS.PREPARE_DEPARTMENT_REFILL,
        PERMISSIONS.MANAGE_PERIODIC_REFILL_SCHEDULES,
        PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS,
        PERMISSIONS.VIEW_REPORTS,
    ],
    [PURCHASING_MANAGER_ROLE_NAME]: [
        PERMISSIONS.CREATE_PURCHASE_REQUEST,
        PERMISSIONS.APPROVE_PURCHASE_REQUEST_MANAGER,
        PERMISSIONS.VIEW_PURCHASING_HISTORY,
        PERMISSIONS.VIEW_PURCHASING_REPORTS,
        PERMISSIONS.MANAGE_SUPPLIERS,
        PERMISSIONS.MANAGE_MATERIAL_SUPPLIERS,
        PERMISSIONS.VIEW_INVENTORY,
        PERMISSIONS.VIEW_REPORTS,
    ],
    [RECEPTION_STAFF_ROLE_NAME]: [
        PERMISSIONS.ADD_PATIENT,
        PERMISSIONS.VIEW_PATIENTS,
        PERMISSIONS.MANAGE_DEPARTMENT_QUEUE,
    ],
    [DOCTOR_ROLE_NAME]: [
        PERMISSIONS.START_CONSULTATION,
        PERMISSIONS.CREATE_PRESCRIPTION,
        PERMISSIONS.RENEW_PRESCRIPTION,
        PERMISSIONS.CANCEL_PRESCRIPTION,
        PERMISSIONS.VIEW_PATIENTS,
        PERMISSIONS.VIEW_PATIENT_HISTORY,
        PERMISSIONS.CANCEL_VISIT,
    ],
    [DISPOSAL_MANAGER_ROLE_NAME]: [
        PERMISSIONS.VIEW_DISPOSAL,
        PERMISSIONS.MANAGE_DISPOSAL_TRANSFERS,
        PERMISSIONS.MANAGE_DESTINATIONS,
        PERMISSIONS.CREATE_DISPOSAL_SALE_REQUEST,
        PERMISSIONS.APPROVE_DISPOSAL_SALE_REQUEST,
        PERMISSIONS.VIEW_INVENTORY,
    ],
    [DEPARTMENT_MANAGER_ROLE_NAME]: [
        PERMISSIONS.VIEW_INVENTORY,
        PERMISSIONS.RECORD_DEPARTMENT_CONSUMPTION,
        PERMISSIONS.PERFORM_INVENTORY_ADJUSTMENT,
        PERMISSIONS.PERFORM_STOCK_COUNT,
        PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST,
        PERMISSIONS.CONFIRM_DEPARTMENT_DELIVERY,
        PERMISSIONS.MANAGE_DEPARTMENT_QUEUE,
        PERMISSIONS.VIEW_PATIENTS,
        PERMISSIONS.VIEW_REPORTS,
    ],
    [PHARMACIST_ROLE_NAME]: [
        PERMISSIONS.DISPENSE_PRESCRIPTION,
        PERMISSIONS.VIEW_INVENTORY,
        PERMISSIONS.VIEW_PATIENTS,
        PERMISSIONS.PERFORM_INVENTORY_ADJUSTMENT,
        PERMISSIONS.PERFORM_STOCK_COUNT,
        PERMISSIONS.RECORD_DEPARTMENT_CONSUMPTION,
        PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST,
    ],
};

// =============================================================================
// MAIN
// =============================================================================
async function main() {
    console.log('🌱 Starting seed...');

    // ---------------------------------------------------------------------------
    // STEP 1: Permissions
    // ---------------------------------------------------------------------------
    console.log('\n[1/13] Seeding permissions...');
    const permissionByCode = new Map<string, { id: string }>();
    for (const meta of PERMISSION_META) {
        const permission = await prisma.permission.upsert({
            where: { code: meta.code },
            update: { name: meta.name, category: meta.category },
            create: {
                code: meta.code,
                name: meta.name,
                category: meta.category,
            },
        });
        permissionByCode.set(meta.code, permission);
    }
    console.log(`   ✓ ${permissionByCode.size} permissions ready.`);

    // ---------------------------------------------------------------------------
    // STEP 2: Roles (system roles first, super admin included)
    // ---------------------------------------------------------------------------
    console.log('\n[2/13] Seeding roles...');

    const superAdminRole = await prisma.role.upsert({
        where: { name: 'super_admin' },
        update: {},
        create: {
            name: 'super_admin',
            description:
                'مدير النظام - صلاحية كاملة على جميع أجزاء النظام (تجاوز نظام الصلاحيات)',
            isSystem: true,
            isSuperAdmin: true,
        },
    });

    const roleDefs: { name: string; description: string }[] = [
        {
            name: HOSPITAL_MANAGER_ROLE_NAME,
            description:
                'مدير المستشفى - يشرف على جميع العمليات والموافقات على مستوى المستشفى',
        },
        {
            name: WAREHOUSE_MANAGER_ROLE_NAME,
            description:
                'مدير المستودع المركزي - يدير المخزون والتزويد للأقسام',
        },
        {
            name: PURCHASING_MANAGER_ROLE_NAME,
            description: 'مدير المشتريات - يدير طلبات الشراء والموردين',
        },
        {
            name: RECEPTION_STAFF_ROLE_NAME,
            description: 'موظف استقبال - يدير تسجيل المرضى وقوائم الانتظار',
        },
        {
            name: DOCTOR_ROLE_NAME,
            description: 'طبيب - يجري الاستشارات ويكتب الوصفات الطبية',
        },
        {
            name: DISPOSAL_MANAGER_ROLE_NAME,
            description:
                'مدير الهالك - يدير عمليات نقل والتخلص من المواد التالفة والمنتهية',
        },
        {
            name: PHARMACIST_ROLE_NAME,
            description: 'صيدلاني - يدير صرف الوصفات الطبية من الصيدلية',
        },
        {
            name: DEPARTMENT_MANAGER_ROLE_NAME,
            description: 'مدير قسم - يدير مخزون وعمليات قسم سريري واحد',
        },
    ];

    const roleByName = new Map<string, { id: string; name: string }>();
    roleByName.set(superAdminRole.name, superAdminRole);

    for (const def of roleDefs) {
        const role = await prisma.role.upsert({
            where: { name: def.name },
            update: { description: def.description },
            create: {
                name: def.name,
                description: def.description,
                isSystem: true,
                isSuperAdmin: false,
            },
        });
        roleByName.set(role.name, role);

        const permissionCodes = ROLE_PERMISSIONS[def.name] ?? [];
        for (const code of permissionCodes) {
            const permission = permissionByCode.get(code)!;
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: permission.id,
                    },
                },
                update: {},
                create: { roleId: role.id, permissionId: permission.id },
            });
        }
    }
    console.log(`   ✓ ${roleByName.size} roles ready (incl. super_admin).`);

    // ---------------------------------------------------------------------------
    // STEP 3: Bootstrap super-admin user (createdById nullable on User, so this
    // is the one row allowed to have no creator).
    // ---------------------------------------------------------------------------
    console.log('\n[3/13] Seeding bootstrap super-admin user...');
    const superAdminUser = await prisma.user.upsert({
        where: { phone: '+963911000001' },
        update: {},
        create: {
            fullName: 'مدير النظام الرئيسي',
            phone: '+963911000001',
            email: 'admin@redcrescent-hospital.sy',
            roleId: superAdminRole.id,
            status: 'active',
        },
    });
    console.log(`   ✓ super-admin user: ${superAdminUser.fullName}`);

    // Dedicated quick-login super-admin account (distinct from the internal
    // bootstrap super-admin above, which exists only to be the createdById
    // for every other seeded row).
    const quickLoginSuperAdmin = await prisma.user.upsert({
        where: { email: quickLoginEmail('super_admin') },
        update: {},
        create: {
            fullName: 'حساب الدخول السريع - مدير النظام',
            email: quickLoginEmail('super_admin'),
            roleId: superAdminRole.id,
            status: 'active',
            createdById: superAdminUser.id,
        },
    });
    console.log(`   ✓ quick-login super-admin: ${quickLoginSuperAdmin.email}`);

    // ---------------------------------------------------------------------------
    // STEP 4: Departments (singletons first with no manager, then standard depts)
    // ---------------------------------------------------------------------------
    console.log('\n[4/13] Seeding departments...');

    const centralWarehouse = await prisma.department.upsert({
        where: { name: 'المستودع المركزي' },
        update: {},
        create: {
            name: 'المستودع المركزي',
            type: DepartmentType.central_warehouse,
            tracksInventory: true,
            hasQueue: false,
            isActive: true,
        },
    });

    const pharmacyDept = await prisma.department.upsert({
        where: { name: 'الصيدلية' },
        update: {},
        create: {
            name: 'الصيدلية',
            type: DepartmentType.pharmacy,
            tracksInventory: true,
            hasQueue: false,
            isActive: true,
        },
    });

    const disposalWarehouse = await prisma.department.upsert({
        where: { name: 'مستودع الهالك' },
        update: {},
        create: {
            name: 'مستودع الهالك',
            type: DepartmentType.disposal_warehouse,
            tracksInventory: true,
            hasQueue: false,
            isActive: true,
        },
    });

    const standardDepartments: {
        id: string;
        name: string;
        type: DepartmentType;
    }[] = [];
    for (const name of STANDARD_DEPARTMENT_NAMES) {
        const dept = await prisma.department.upsert({
            where: { name },
            update: {},
            create: {
                name,
                type: DepartmentType.standard,
                tracksInventory: true,
                hasQueue: true,
                isActive: true,
            },
        });
        standardDepartments.push(dept);
    }
    console.log(
        `   ✓ 3 singleton departments + ${standardDepartments.length} standard departments.`,
    );

    // ---------------------------------------------------------------------------
    // STEP 5: Users - department managers, reception, doctors, pharmacists.
    // Every user needs createdById -> use superAdminUser for all of these.
    // Managers are created pointed at their department, then the department's
    // managerId is patched (mirrors departments.service.ts assignManager flow).
    // ---------------------------------------------------------------------------
    console.log('\n[5/13] Seeding users...');

    // phoneSeq starts at 10 (not 2) to stay clear of the two hardcoded phone
    // numbers used above: superAdminUser ("...000001") and hospitalManager
    // ("...000002"). Starting low here previously caused an exact collision
    // with hospitalManager's phone on the very first nextPhone() call.
    let phoneSeq = 10;
    function nextPhone(): string {
        return `+96391${String(1000000 + phoneSeq++).slice(-7)}`;
    }
    function nextEmail(role: string, idx: number): string {
        return `${role}${idx}@redcrescent-hospital.sy`;
    }

    const hospitalManagerRole = roleByName.get(HOSPITAL_MANAGER_ROLE_NAME)!;
    const warehouseManagerRole = roleByName.get(WAREHOUSE_MANAGER_ROLE_NAME)!;
    const purchasingManagerRole = roleByName.get(PURCHASING_MANAGER_ROLE_NAME)!;
    const receptionRole = roleByName.get(RECEPTION_STAFF_ROLE_NAME)!;
    const doctorRole = roleByName.get(DOCTOR_ROLE_NAME)!;
    const disposalManagerRole = roleByName.get(DISPOSAL_MANAGER_ROLE_NAME)!;
    const pharmacistRole = roleByName.get(PHARMACIST_ROLE_NAME)!;
    const departmentManagerRole = roleByName.get(DEPARTMENT_MANAGER_ROLE_NAME)!;

    // Hospital manager: unique fixed role, no department of their own required.
    // Uses the quick-login email so it's directly usable for testing.
    const hospitalManager = await prisma.user.upsert({
        where: { email: quickLoginEmail('hospital_manager') },
        update: {},
        create: {
            fullName: randomFullName(),
            phone: '+963911000002',
            email: quickLoginEmail('hospital_manager'),
            roleId: hospitalManagerRole.id,
            status: 'active',
            createdById: superAdminUser.id,
        },
    });

    // Warehouse manager -> manages central warehouse. Uses quick-login email.
    const warehouseManagerUser = await prisma.user.upsert({
        where: { email: quickLoginEmail('warehouse_manager') },
        update: {},
        create: {
            fullName: randomFullName(),
            phone: nextPhone(),
            email: quickLoginEmail('warehouse_manager'),
            roleId: warehouseManagerRole.id,
            departmentId: centralWarehouse.id,
            status: 'active',
            createdById: superAdminUser.id,
        },
    });
    await prisma.department.update({
        where: { id: centralWarehouse.id },
        data: { managerId: warehouseManagerUser.id },
    });

    // Purchasing manager -> not tied to a specific department (works hospital-wide).
    // Uses quick-login email.
    const purchasingManagerUser = await prisma.user.upsert({
        where: { email: quickLoginEmail('purchasing_manager') },
        update: {},
        create: {
            fullName: randomFullName(),
            phone: nextPhone(),
            email: quickLoginEmail('purchasing_manager'),
            roleId: purchasingManagerRole.id,
            status: 'active',
            createdById: superAdminUser.id,
        },
    });

    // Pharmacist(s) -> manage the pharmacy department, one is assigned as
    // department manager. The first one uses the quick-login "pharmacy_staff" email.
    const pharmacistUsers: { id: string; fullName: string }[] = [];
    for (let i = 0; i < 3; i++) {
        const isQuickLogin = i === 0;
        const pharmacist = await prisma.user.upsert({
            where: {
                email: isQuickLogin
                    ? quickLoginEmail('pharmacy_staff')
                    : nextEmail('pharmacist', i + 1),
            },
            update: {},
            create: {
                fullName: randomFullName(),
                phone: nextPhone(),
                email: isQuickLogin
                    ? quickLoginEmail('pharmacy_staff')
                    : nextEmail('pharmacist', i + 1),
                roleId: pharmacistRole.id,
                departmentId: pharmacyDept.id,
                status: 'active',
                createdById: superAdminUser.id,
            },
        });
        pharmacistUsers.push(pharmacist);
    }
    await prisma.department.update({
        where: { id: pharmacyDept.id },
        data: { managerId: pharmacistUsers[0].id },
    });

    // Disposal manager -> manages disposal warehouse. Uses quick-login email.
    const disposalManagerUser = await prisma.user.upsert({
        where: { email: quickLoginEmail('disposal_manager') },
        update: {},
        create: {
            fullName: randomFullName(),
            phone: nextPhone(),
            email: quickLoginEmail('disposal_manager'),
            roleId: disposalManagerRole.id,
            departmentId: disposalWarehouse.id,
            status: 'active',
            createdById: superAdminUser.id,
        },
    });
    await prisma.department.update({
        where: { id: disposalWarehouse.id },
        data: { managerId: disposalManagerUser.id },
    });

    // Reception staff -> two general reception staff (not department-scoped;
    // reception is treated as unrestricted across standard departments per
    // department-queue.service.ts UNRESTRICTED_ROLES). The first uses the
    // quick-login email.
    const receptionUsers: { id: string; fullName: string }[] = [];
    for (let i = 0; i < 2; i++) {
        const isQuickLogin = i === 0;
        const staff = await prisma.user.upsert({
            where: {
                email: isQuickLogin
                    ? quickLoginEmail('reception_staff')
                    : nextEmail('reception', i + 1),
            },
            update: {},
            create: {
                fullName: randomFullName(),
                phone: nextPhone(),
                email: isQuickLogin
                    ? quickLoginEmail('reception_staff')
                    : nextEmail('reception', i + 1),
                roleId: receptionRole.id,
                status: 'active',
                createdById: superAdminUser.id,
            },
        });
        receptionUsers.push(staff);
    }

    // Doctors: 1-4 per standard department, each doctor tied to exactly one
    // department + a specialty (required by users.service.ts validation).
    // The very first doctor created overall uses the quick-login email.
    const doctorsByDepartment = new Map<
        string,
        { id: string; fullName: string; specialty: string }[]
    >();
    const allDoctors: {
        id: string;
        fullName: string;
        specialty: string;
        departmentId: string;
    }[] = [];

    for (const dept of standardDepartments) {
        const docCount = randInt(1, 4);
        const specialty = pick(DOCTOR_SPECIALTIES);
        const deptDoctors: {
            id: string;
            fullName: string;
            specialty: string;
        }[] = [];
        for (let i = 0; i < docCount; i++) {
            const isQuickLogin = allDoctors.length === 0;
            const doctor = await prisma.user.upsert({
                where: {
                    email: isQuickLogin
                        ? quickLoginEmail('doctor')
                        : nextEmail('doctor', allDoctors.length + 1),
                },
                update: {},
                create: {
                    fullName: `د. ${randomFullName()}`,
                    phone: nextPhone(),
                    email: isQuickLogin
                        ? quickLoginEmail('doctor')
                        : nextEmail('doctor', allDoctors.length + 1),
                    roleId: doctorRole.id,
                    departmentId: dept.id,
                    specialty,
                    status: 'active',
                    createdById: superAdminUser.id,
                },
            });
            deptDoctors.push({
                id: doctor.id,
                fullName: doctor.fullName,
                specialty,
            });
            allDoctors.push({
                id: doctor.id,
                fullName: doctor.fullName,
                specialty,
                departmentId: dept.id,
            });
        }
        doctorsByDepartment.set(dept.id, deptDoctors);
    }

    // Department manager (quick-login only): a dedicated user with the
    // department_manager role, assigned to manage the first standard
    // department (dual-check pattern - named role + department-boundary scope,
    // same shape as warehouse_manager/disposal_manager for their departments).
    const firstStandardDept = standardDepartments[0];
    const departmentManagerUser = await prisma.user.upsert({
        where: { email: quickLoginEmail('department_manager') },
        update: {},
        create: {
            fullName: randomFullName(),
            phone: nextPhone(),
            email: quickLoginEmail('department_manager'),
            roleId: departmentManagerRole.id,
            departmentId: firstStandardDept.id,
            status: 'active',
            createdById: superAdminUser.id,
        },
    });
    await prisma.department.update({
        where: { id: firstStandardDept.id },
        data: { managerId: departmentManagerUser.id },
    });

    console.log(
        `   ✓ users: 1 hospital manager, 1 warehouse manager, 1 purchasing manager, ` +
            `${pharmacistUsers.length} pharmacists, 1 disposal manager, 1 department manager, ${receptionUsers.length} reception staff, ${allDoctors.length} doctors.`,
    );

    console.log(
        '\n✅ Phase 1 complete (permissions, roles, super-admin, departments, users). Continuing...',
    );

    // ---------------------------------------------------------------------------
    // STEP 6: Catalog - units, categories (with subcategories), products, variants
    // ---------------------------------------------------------------------------
    console.log(
        '\n[6/13] Seeding catalog (units, categories, products, variants)...',
    );

    const unitByName = new Map<string, { id: string; name: string }>();
    for (const u of UNITS) {
        const unit = await prisma.unit.upsert({
            where: { name: u.name },
            update: { abbreviation: u.abbreviation },
            create: { name: u.name, abbreviation: u.abbreviation },
        });
        unitByName.set(u.name, unit);
    }
    // 'أنبوب' (tube) used by one product variant but not in the base UNITS list; ensure it exists
    const tubeUnit = await prisma.unit.upsert({
        where: { name: 'أنبوب' },
        update: {},
        create: { name: 'أنبوب', abbreviation: 'أنبوب' },
    });
    unitByName.set('أنبوب', tubeUnit);

    const categoryByName = new Map<string, { id: string; name: string }>();
    for (const parent of CATEGORY_TREE) {
        // Top-level categories have parentCategoryId = null. The composite unique
        // index @@unique([name, parentCategoryId]) can't be targeted with a null
        // value through Prisma's generated `where` input, so we find-or-create
        // instead of upsert here.
        const existingParent = await prisma.category.findFirst({
            where: { name: parent.name, parentCategoryId: null },
        });
        const parentCategory =
            existingParent ??
            (await prisma.category.create({ data: { name: parent.name } }));
        categoryByName.set(parent.name, parentCategory);

        for (const childName of parent.children) {
            const existingChild = await prisma.category.findFirst({
                where: { name: childName, parentCategoryId: parentCategory.id },
            });
            const child =
                existingChild ??
                (await prisma.category.create({
                    data: {
                        name: childName,
                        parentCategoryId: parentCategory.id,
                    },
                }));
            categoryByName.set(childName, child);
        }
    }
    console.log(
        `   ✓ ${unitByName.size} units, ${categoryByName.size} categories.`,
    );

    interface SeededVariant {
        id: string;
        variantName: string;
        sku: string;
        unitId: string;
        productId: string;
        materialType: MaterialType;
        nearExpiryDisposalDays?: number;
    }
    const allVariants: SeededVariant[] = [];
    let skuSeq = 1000;

    for (const p of PRODUCTS_SEED) {
        const category = categoryByName.get(p.category);
        const product = await prisma.product.create({
            data: {
                name: p.name,
                categoryId: category?.id,
                materialType: p.materialType,
                description: p.description,
                nearExpiryDisposalDays: p.nearExpiryDisposalDays,
                isActive: true,
                createdById: superAdminUser.id,
            },
        });

        for (const v of p.variants) {
            skuSeq += 1;
            const unit = unitByName.get(v.unit);
            if (!unit) throw new Error(`Unit not found: ${v.unit}`);
            const variant = await prisma.productVariant.create({
                data: {
                    productId: product.id,
                    variantName: v.variantName,
                    sku: `SKU-${skuSeq}`,
                    unitId: unit.id,
                    isActive: true,
                    createdById: superAdminUser.id,
                },
            });
            allVariants.push({
                id: variant.id,
                variantName: variant.variantName,
                sku: variant.sku,
                unitId: variant.unitId,
                productId: product.id,
                materialType: p.materialType,
                nearExpiryDisposalDays: p.nearExpiryDisposalDays,
            });
        }
    }
    console.log(
        `   ✓ ${PRODUCTS_SEED.length} products, ${allVariants.length} variants.`,
    );

    // ---------------------------------------------------------------------------
    // STEP 7: Suppliers, Destinations, VariantSupplier links
    // ---------------------------------------------------------------------------
    console.log(
        '\n[7/13] Seeding suppliers, destinations, and variant-supplier links...',
    );

    const suppliers: { id: string; name: string }[] = [];
    const SUPPLIER_EMAIL_SLUGS = [
        'alshifa',
        'alrahma',
        'dimashq',
        'alamal',
        'alhilal',
        'alnoor',
        'alwafaa',
        'barada',
    ];
    for (let i = 0; i < SUPPLIER_NAMES.length; i++) {
        const name = SUPPLIER_NAMES[i];
        const supplier = await prisma.supplier.create({
            data: {
                name,
                phone: nextPhone(),
                email: `${SUPPLIER_EMAIL_SLUGS[i] ?? `supplier${i + 1}`}@suppliers.sy`,
                address: `${pick(['دمشق', 'حلب', 'حمص', 'اللاذقية', 'طرطوس'])} - سوريا`,
                isActive: true,
            },
        });
        suppliers.push(supplier);
    }

    const destinations: { id: string; name: string }[] = [];
    for (const name of DESTINATION_NAMES) {
        const destination = await prisma.destination.create({
            data: {
                name,
                phone: nextPhone(),
                address: `${pick(['دمشق', 'حلب', 'حمص'])} - سوريا`,
                isActive: true,
            },
        });
        destinations.push(destination);
    }

    // Link each variant with 1-3 suppliers, one marked preferred
    const variantSuppliersByVariant = new Map<string, string[]>(); // variantId -> supplierIds
    for (const variant of allVariants) {
        const linkedSuppliers = pickMany(suppliers, randInt(1, 3));
        variantSuppliersByVariant.set(
            variant.id,
            linkedSuppliers.map((s) => s.id),
        );
        for (let i = 0; i < linkedSuppliers.length; i++) {
            await prisma.variantSupplier.create({
                data: {
                    variantId: variant.id,
                    supplierId: linkedSuppliers[i].id,
                    expectedPurchasePrice: randFloat(500, 25000, 0),
                    isPreferred: i === 0,
                },
            });
        }
    }
    console.log(
        `   ✓ ${suppliers.length} suppliers, ${destinations.length} destinations, variant-supplier links created.`,
    );

    // ---------------------------------------------------------------------------
    // STEP 8: Stock settings - configure every variant for the central warehouse,
    // pharmacy, and a subset of standard departments (variants must be
    // "configured" before consumption/adjustment/refill flows accept them, per
    // the service-layer assertVariantsConfiguredForDepartment checks).
    // ---------------------------------------------------------------------------
    console.log('\n[8/13] Seeding department stock settings...');

    const stockConfiguredDepartments = [
        centralWarehouse,
        pharmacyDept,
        disposalWarehouse,
        ...standardDepartments,
    ];
    const configuredVariantIdsByDept = new Map<string, Set<string>>();

    for (const dept of stockConfiguredDepartments) {
        const configuredSet = new Set<string>();
        // Central warehouse and pharmacy stock every variant; standard departments
        // stock a realistic random subset (60-90%) since not every department
        // needs every medicine.
        const variantsForDept =
            dept.id === centralWarehouse.id ||
            dept.id === pharmacyDept.id ||
            dept.id === disposalWarehouse.id
                ? allVariants
                : shuffle(allVariants).slice(
                      0,
                      Math.ceil(allVariants.length * randFloat(0.6, 0.9, 2)),
                  );

        for (const variant of variantsForDept) {
            const minimumStock = randInt(20, 60);
            const maximumStock = minimumStock + randInt(150, 400);
            await prisma.departmentStockSetting.create({
                data: {
                    variantId: variant.id,
                    departmentId: dept.id,
                    storageLocation: `رف ${pick(['A', 'B', 'C', 'D'])}${randInt(1, 12)}`,
                    minimumStock,
                    maximumStock,
                    isActive: true,
                    createdById: superAdminUser.id,
                },
            });
            configuredSet.add(variant.id);
        }
        configuredVariantIdsByDept.set(dept.id, configuredSet);
    }
    console.log(
        `   ✓ stock settings configured for ${stockConfiguredDepartments.length} departments.`,
    );

    console.log(
        '\n✅ Phase 2 complete (catalog, suppliers, destinations, stock settings). Continuing to historical data...',
    );

    // =============================================================================
    // PHASE 3: HISTORICAL OPERATIONAL DATA (~6 months back to now)
    // =============================================================================

    // Running balance tracker for batch_stock, kept in memory so every
    // InventoryTransaction.balanceAfter we write is actually correct, and so
    // later steps (consumption, dispensing, adjustments) never oversell stock.
    // Structure: batchStockBalance.get(`${batchId}:${departmentId}`) -> number
    const batchStockBalance = new Map<string, number>();
    function stockKey(batchId: string, departmentId: string) {
        return `${batchId}:${departmentId}`;
    }
    function getStock(batchId: string, departmentId: string): number {
        return batchStockBalance.get(stockKey(batchId, departmentId)) ?? 0;
    }
    async function adjustStock(
        batchId: string,
        departmentId: string,
        delta: number,
    ): Promise<number> {
        const key = stockKey(batchId, departmentId);
        const current = batchStockBalance.get(key) ?? 0;
        const next = current + delta;
        batchStockBalance.set(key, next);
        await prisma.batchStock.upsert({
            where: { batchId_departmentId: { batchId, departmentId } },
            update: { quantity: next },
            create: { batchId, departmentId, quantity: next },
        });
        return next;
    }
    async function recordTransaction(params: {
        transactionType: TransactionType;
        variantId: string;
        batchId: string;
        departmentId: string;
        quantity: number;
        balanceAfter: number;
        referenceType?: ReferenceType;
        referenceId?: string;
        performedById: string;
        transactionDate: Date;
        notes?: string;
    }) {
        await prisma.inventoryTransaction.create({
            data: {
                transactionType: params.transactionType,
                variantId: params.variantId,
                batchId: params.batchId,
                departmentId: params.departmentId,
                quantity: params.quantity,
                balanceAfter: params.balanceAfter,
                referenceType: params.referenceType,
                referenceId: params.referenceId,
                performedById: params.performedById,
                transactionDate: params.transactionDate,
                notes: params.notes,
            },
        });
    }

    // ---------------------------------------------------------------------------
    // STEP 9: Purchasing history - purchase requests -> receipts -> batches
    // Spread over the last 6 months, landing stock into the central warehouse.
    // ---------------------------------------------------------------------------
    console.log(
        '\n[9/13] Seeding purchasing history (requests, receipts, batches)...',
    );

    interface SeededBatch {
        id: string;
        variantId: string;
        batchNumber: string;
        expirationDate: Date | null;
        receivingDate: Date;
    }
    const allBatches: SeededBatch[] = [];

    const purchaseRequestCount = 26; // roughly one per week over 6 months
    let prSeq = 1;
    let batchNumberSeq = 1;

    for (let i = 0; i < purchaseRequestCount; i++) {
        const createdAt = randomDateBetween(SIX_MONTHS_AGO, addDays(NOW, -7));
        const itemVariants = pickMany(allVariants, randInt(3, 8));

        const purchaseRequest = await prisma.purchaseRequest.create({
            data: {
                requestNumber: generateRequestNumber('PR', prSeq++),
                requestedById: purchasingManagerUser.id,
                status: RequestStatus.draft, // will be advanced below via updates, mirroring real flow
                priority: chance(0.2)
                    ? RefillRequestPriority.urgent
                    : RefillRequestPriority.normal,
                notes: chance(0.4)
                    ? 'طلب دوري لتجديد مخزون المستودع المركزي.'
                    : undefined,
                createdAt,
                items: {
                    create: itemVariants.map((v) => ({
                        variantId: v.id,
                        requestedQuantity: randInt(50, 400),
                        estimatedPrice: randFloat(500, 20000, 0),
                    })),
                },
            },
            include: { items: true },
        });

        // Advance through the approval lifecycle for realism (draft -> submitted
        // -> hospital approved -> manager approved/"preparing")
        const submittedAt = addDays(createdAt, 1);
        const hospitalApprovedAt = addDays(submittedAt, randInt(1, 2));
        const managerApprovedAt = addDays(hospitalApprovedAt, randInt(1, 2));

        const isRejectedByHospital = chance(0.05);
        if (isRejectedByHospital) {
            await prisma.purchaseRequest.update({
                where: { id: purchaseRequest.id },
                data: {
                    status: RequestStatus.hospital_rejected,
                    hospitalApprovedById: hospitalManager.id,
                    hospitalRejectionReason: pick(REJECTION_REASONS),
                    updatedAt: hospitalApprovedAt,
                },
            });
            continue; // no receipts for a rejected request
        }

        const approvedItems = purchaseRequest.items.map((item) => ({
            id: item.id,
            approvedQuantity: Math.round(
                Number(item.requestedQuantity) * randFloat(0.8, 1.0, 2),
            ),
        }));

        const isRejectedByManager = chance(0.05);
        await prisma.purchaseRequest.update({
            where: { id: purchaseRequest.id },
            data: {
                status: isRejectedByManager
                    ? RequestStatus.manager_rejected
                    : RequestStatus.preparing,
                hospitalApprovedById: hospitalManager.id,
                hospitalApprovedAt,
                approvedById: isRejectedByManager
                    ? undefined
                    : purchasingManagerUser.id,
                approvedAt: isRejectedByManager ? undefined : managerApprovedAt,
                rejectionReason: isRejectedByManager
                    ? pick(REJECTION_REASONS)
                    : undefined,
            },
        });
        for (const item of approvedItems) {
            await prisma.purchaseRequestItem.update({
                where: { id: item.id },
                data: {
                    approvedQuantity: item.approvedQuantity,
                    quantityDiscrepancy: item.approvedQuantity,
                },
            });
        }
        if (isRejectedByManager) continue;

        // Create + confirm a purchase receipt (single delivery, fully confirmed)
        const receivingDate = addDays(managerApprovedAt, randInt(2, 6));
        const supplier = pick(suppliers);

        const receiptItemsData = purchaseRequest.items.map((item) => {
            const approved = approvedItems.find((a) => a.id === item.id)!;
            const quantity = approved.approvedQuantity;
            const manufacturingDate = addDays(receivingDate, -randInt(30, 200));
            const shelfLifeDays = randInt(180, 730);
            const expirationDate = addDays(manufacturingDate, shelfLifeDays);
            return {
                purchaseRequestItemId: item.id,
                variantId: item.variantId,
                expectedQuantity: quantity,
                quantity,
                batchNumber: `BATCH-${String(batchNumberSeq++).padStart(6, '0')}`,
                manufacturingDate,
                expirationDate,
                purchasePrice: randFloat(500, 20000, 0),
            };
        });

        const receipt = await prisma.purchaseReceipt.create({
            data: {
                purchaseRequestId: purchaseRequest.id,
                supplierId: supplier.id,
                receivedById: warehouseManagerUser.id,
                receivingDate,
                type: BatchType.final_batch,
                status: PurchaseReceiptStatus.pending_confirmation,
                notes: pick(RECEIPT_NOTES),
                createdAt: receivingDate,
                items: { create: receiptItemsData },
            },
            include: { items: true },
        });

        // Confirm receipt: create batches, batch stock, ledger entries
        const confirmedAt = addDays(receivingDate, randInt(0, 2));
        await prisma.purchaseReceipt.update({
            where: { id: receipt.id },
            data: {
                status: PurchaseReceiptStatus.confirmed,
                confirmedById: purchasingManagerUser.id,
                confirmedAt,
            },
        });

        for (const receiptItem of receipt.items) {
            const confirmedQuantity = Number(receiptItem.quantity); // fully confirmed as declared
            await prisma.purchaseReceiptItem.update({
                where: { id: receiptItem.id },
                data: { confirmedQuantity, confirmedQuantityDiscrepancy: 0 },
            });

            const batch = await prisma.batch.create({
                data: {
                    purchaseReceiptItemId: receiptItem.id,
                    variantId: receiptItem.variantId,
                    supplierId: supplier.id,
                    batchNumber: receiptItem.batchNumber,
                    quantityReceived: confirmedQuantity,
                    purchasePrice: receiptItem.purchasePrice ?? undefined,
                    manufacturingDate:
                        receiptItem.manufacturingDate ?? undefined,
                    expirationDate: receiptItem.expirationDate ?? undefined,
                    receivingDate,
                    createdById: warehouseManagerUser.id,
                    createdAt: confirmedAt,
                },
            });
            allBatches.push({
                id: batch.id,
                variantId: batch.variantId,
                batchNumber: batch.batchNumber,
                expirationDate: batch.expirationDate,
                receivingDate: batch.receivingDate,
            });

            const balanceAfter = await adjustStock(
                batch.id,
                centralWarehouse.id,
                confirmedQuantity,
            );
            await recordTransaction({
                transactionType: TransactionType.purchase_receipt,
                variantId: receiptItem.variantId,
                batchId: batch.id,
                departmentId: centralWarehouse.id,
                quantity: confirmedQuantity,
                balanceAfter,
                referenceType: ReferenceType.purchase_receipt,
                referenceId: receipt.id,
                performedById: purchasingManagerUser.id,
                transactionDate: confirmedAt,
            });
        }

        // Purchase request items received/discrepancy + completion status
        for (const item of purchaseRequest.items) {
            const approved = approvedItems.find((a) => a.id === item.id)!;
            await prisma.purchaseRequestItem.update({
                where: { id: item.id },
                data: {
                    receivedQuantity: approved.approvedQuantity,
                    quantityDiscrepancy: 0,
                },
            });
        }
        await prisma.purchaseRequest.update({
            where: { id: purchaseRequest.id },
            data: { status: RequestStatus.complete },
        });
    }
    console.log(
        `   ✓ ${purchaseRequestCount} purchase requests processed, ${allBatches.length} batches received into central warehouse.`,
    );

    // ---------------------------------------------------------------------------
    // STEP 10: Department refill requests -> deliveries -> confirmations.
    // Moves stock from central warehouse into standard departments + pharmacy,
    // using FEFO-ish selection (earliest expiration batches with available
    // central-warehouse stock).
    // ---------------------------------------------------------------------------
    console.log('\n[10/13] Seeding department refill requests + deliveries...');

    function findAvailableBatchesForVariant(
        variantId: string,
        departmentId: string,
    ): SeededBatch[] {
        return allBatches
            .filter(
                (b) =>
                    b.variantId === variantId &&
                    getStock(b.id, departmentId) > 0,
            )
            .sort((a, b) => {
                if (!a.expirationDate && !b.expirationDate) return 0;
                if (!a.expirationDate) return 1;
                if (!b.expirationDate) return -1;
                return a.expirationDate.getTime() - b.expirationDate.getTime();
            });
    }

    const refillReceivingDepartments = [...standardDepartments, pharmacyDept];
    let drfSeq = 1;
    let refillRequestsCreated = 0;
    let refillDeliveriesCreated = 0;

    for (const dept of refillReceivingDepartments) {
        const configuredVariants = [
            ...(configuredVariantIdsByDept.get(dept.id) ?? []),
        ];
        if (configuredVariants.length === 0) continue;

        const requestCount = randInt(4, 8); // several refills across the 6 months per department
        const requesterId =
            dept.id === pharmacyDept.id
                ? pharmacistUsers[0].id
                : (doctorsByDepartment.get(dept.id)?.[0]?.id ??
                  warehouseManagerUser.id);

        for (let r = 0; r < requestCount; r++) {
            const createdAt = randomDateBetween(
                SIX_MONTHS_AGO,
                addDays(NOW, -10),
            );
            const itemVariantIds = pickMany(configuredVariants, randInt(3, 6));

            const refillRequest = await prisma.departmentRefillRequest.create({
                data: {
                    requestNumber: generateRequestNumber('DRF', drfSeq++),
                    departmentId: dept.id,
                    requestedById: requesterId,
                    status: RequestStatus.draft,
                    priority: chance(0.15)
                        ? RefillRequestPriority.urgent
                        : RefillRequestPriority.normal,
                    requestType: RefillRequestType.normal,
                    notes: chance(0.3)
                        ? 'طلب تزويد اعتيادي بناءً على مستويات المخزون الحالية.'
                        : undefined,
                    createdAt,
                    items: {
                        create: itemVariantIds.map((variantId) => ({
                            variantId,
                            requestedQuantity: randInt(20, 150),
                        })),
                    },
                },
                include: { items: true },
            });
            refillRequestsCreated++;

            const submittedAt = addDays(createdAt, 1);
            const hospitalApprovedAt = addDays(submittedAt, randInt(1, 2));
            const managerApprovedAt = addDays(
                hospitalApprovedAt,
                randInt(1, 2),
            );

            if (chance(0.08)) {
                // hospital-rejected branch
                await prisma.departmentRefillRequest.update({
                    where: { id: refillRequest.id },
                    data: {
                        status: RequestStatus.hospital_rejected,
                        hospitalApprovedById: hospitalManager.id,
                        hospitalRejectionReason: pick(REJECTION_REASONS),
                    },
                });
                continue;
            }

            const approvedItems = refillRequest.items.map((item) => ({
                id: item.id,
                variantId: item.variantId,
                approvedQuantity: Math.round(
                    Number(item.requestedQuantity) * randFloat(0.7, 1.0, 2),
                ),
            }));

            if (chance(0.08)) {
                await prisma.departmentRefillRequest.update({
                    where: { id: refillRequest.id },
                    data: {
                        status: RequestStatus.manager_rejected,
                        hospitalApprovedById: hospitalManager.id,
                        hospitalApprovedAt,
                        rejectionReason: pick(REJECTION_REASONS),
                    },
                });
                continue;
            }

            await prisma.departmentRefillRequest.update({
                where: { id: refillRequest.id },
                data: {
                    status: RequestStatus.preparing,
                    hospitalApprovedById: hospitalManager.id,
                    hospitalApprovedAt,
                    approvedById: warehouseManagerUser.id,
                    approvedAt: managerApprovedAt,
                },
            });
            for (const item of approvedItems) {
                await prisma.departmentRefillItem.update({
                    where: { id: item.id },
                    data: {
                        approvedQuantity: item.approvedQuantity,
                        quantityDiscrepancy: item.approvedQuantity,
                    },
                });
            }

            // Build delivery lines using FEFO batches with real available stock in
            // the central warehouse; skip items with no stock (realistic partial
            // fulfillment scenario handled by resolveRequestCompletion logic).
            const deliveredAt = addDays(managerApprovedAt, randInt(1, 4));
            const deliveryLines: {
                refillItemId: string;
                batchId: string;
                shippedQuantity: number;
                variantId: string;
            }[] = [];

            for (const item of approvedItems) {
                let remaining = item.approvedQuantity;
                const batches = findAvailableBatchesForVariant(
                    item.variantId,
                    centralWarehouse.id,
                );
                for (const batch of batches) {
                    if (remaining <= 0) break;
                    const available = getStock(batch.id, centralWarehouse.id);
                    const take = Math.min(available, remaining);
                    if (take <= 0) continue;
                    deliveryLines.push({
                        refillItemId: item.id,
                        batchId: batch.id,
                        shippedQuantity: take,
                        variantId: item.variantId,
                    });
                    remaining -= take;
                }
            }

            if (deliveryLines.length === 0) {
                // Nothing shippable right now (unlikely but possible) - leave as preparing
                continue;
            }

            const delivery = await prisma.departmentRefillDelivery.create({
                data: {
                    refillRequestId: refillRequest.id,
                    deliveredById: warehouseManagerUser.id,
                    deliveredAt,
                    type: BatchType.batch,
                    notes: pick(DELIVERY_NOTES),
                },
            });
            refillDeliveriesCreated++;

            for (const line of deliveryLines) {
                await prisma.departmentRefillDeliveryItem.create({
                    data: {
                        deliveryId: delivery.id,
                        refillItemId: line.refillItemId,
                        batchId: line.batchId,
                        shippedQuantity: line.shippedQuantity,
                    },
                });

                // outbound from central warehouse
                const outBalance = await adjustStock(
                    line.batchId,
                    centralWarehouse.id,
                    -line.shippedQuantity,
                );
                await recordTransaction({
                    transactionType: TransactionType.department_transfer_out,
                    variantId: line.variantId,
                    batchId: line.batchId,
                    departmentId: centralWarehouse.id,
                    quantity: -line.shippedQuantity,
                    balanceAfter: outBalance,
                    referenceType: ReferenceType.refill_request,
                    referenceId: refillRequest.id,
                    performedById: warehouseManagerUser.id,
                    transactionDate: deliveredAt,
                });
            }

            // Confirm the delivery shortly after (receiving department confirms
            // receipt, mostly matching shipped quantity with small discrepancies)
            const confirmedAt = addDays(deliveredAt, randInt(0, 2));
            const confirmingUserId =
                dept.id === pharmacyDept.id
                    ? pharmacistUsers[0].id
                    : requesterId;

            await prisma.departmentRefillDelivery.update({
                where: { id: delivery.id },
                data: {
                    receivedById: confirmingUserId,
                    confirmedAt,
                    notes: pick(DELIVERY_NOTES),
                },
            });

            const cumulativeReceivedByItem = new Map<string, number>();
            for (const line of deliveryLines) {
                const receivedQuantity = chance(0.85)
                    ? line.shippedQuantity
                    : Math.max(0, line.shippedQuantity - randInt(1, 5));

                const deliveryItem =
                    await prisma.departmentRefillDeliveryItem.findFirstOrThrow({
                        where: {
                            deliveryId: delivery.id,
                            batchId: line.batchId,
                            refillItemId: line.refillItemId,
                        },
                    });
                await prisma.departmentRefillDeliveryItem.update({
                    where: { id: deliveryItem.id },
                    data: {
                        receivedQuantity,
                        quantityDiscrepancy:
                            line.shippedQuantity - receivedQuantity,
                    },
                });

                const inBalance = await adjustStock(
                    line.batchId,
                    dept.id,
                    receivedQuantity,
                );
                await recordTransaction({
                    transactionType: TransactionType.department_transfer_in,
                    variantId: line.variantId,
                    batchId: line.batchId,
                    departmentId: dept.id,
                    quantity: receivedQuantity,
                    balanceAfter: inBalance,
                    referenceType:
                        ReferenceType.department_refill_delivery_item,
                    referenceId: deliveryItem.id,
                    performedById: confirmingUserId,
                    transactionDate: confirmedAt,
                });

                cumulativeReceivedByItem.set(
                    line.refillItemId,
                    (cumulativeReceivedByItem.get(line.refillItemId) ?? 0) +
                        receivedQuantity,
                );
            }

            for (const [refillItemId, cumulative] of cumulativeReceivedByItem) {
                const item = approvedItems.find((a) => a.id === refillItemId)!;
                await prisma.departmentRefillItem.update({
                    where: { id: refillItemId },
                    data: {
                        deliveredQuantity: cumulative,
                        quantityDiscrepancy: item.approvedQuantity - cumulative,
                    },
                });
            }

            const allFullyMet = approvedItems.every(
                (item) =>
                    (cumulativeReceivedByItem.get(item.id) ?? 0) >=
                    item.approvedQuantity,
            );
            await prisma.departmentRefillRequest.update({
                where: { id: refillRequest.id },
                data: {
                    status: allFullyMet
                        ? RequestStatus.complete
                        : RequestStatus.partially_complete,
                },
            });
        }
    }
    console.log(
        `   ✓ ${refillRequestsCreated} refill requests, ${refillDeliveriesCreated} deliveries processed.`,
    );

    // ---------------------------------------------------------------------------
    // STEP 11: Patients, queue history, medical visits, prescriptions, dispensing.
    // This is the largest chunk: for each standard department we simulate a
    // realistic stream of patient visits across the 6-month window, some of
    // which produce prescriptions that pharmacy then dispenses (partially or
    // fully) out of the pharmacy department's stock.
    // ---------------------------------------------------------------------------
    console.log(
        '\n[11/13] Seeding patients, visits, prescriptions, dispensing...',
    );

    const PATIENT_COUNT = 90;
    const patients: {
        id: string;
        fullName: string;
        nationalId: string | null;
        familyBookNumber: string | null;
    }[] = [];
    let nationalIdSeq = 1;
    let familyBookSeq = 1;

    for (let i = 0; i < PATIENT_COUNT; i++) {
        const hasNationalId = chance(0.75);
        const hasFamilyBook = !hasNationalId || chance(0.4);
        const nationalId = hasNationalId
            ? String(2000000000 + nationalIdSeq++).padStart(11, '0')
            : undefined;
        const familyBookNumber = hasFamilyBook
            ? String(500000 + familyBookSeq++)
            : undefined;

        const patient = await prisma.patient.create({
            data: {
                fullName: randomFullName(),
                nationalId,
                familyBookNumber,
                patientId:
                    !nationalId && !familyBookNumber
                        ? generateRequestNumberPT(i + 1)
                        : undefined,
                registeredById: pick(receptionUsers).id,
                createdAt: randomDateBetween(SIX_MONTHS_AGO, NOW),
            },
        });
        patients.push({
            id: patient.id,
            fullName: patient.fullName,
            nationalId: patient.nationalId,
            familyBookNumber: patient.familyBookNumber,
        });
    }
    console.log(`   ✓ ${patients.length} patients registered.`);

    function generateRequestNumberPT(seq: number): string {
        return `PT-${String(seq).padStart(6, '0')}`;
    }

    // Pharmacy stock cannot be dispensed from until it has batches - so before
    // simulating visits/prescriptions, make sure pharmacy already received some
    // refill deliveries (handled in STEP 10 above since pharmacyDept was part
    // of refillReceivingDepartments). We only prescribe variants that actually
    // have a positive live balance in the pharmacy department right now.

    function pharmacyVariantsWithStock(): {
        variantId: string;
        batches: SeededBatch[];
    }[] {
        const byVariant = new Map<string, SeededBatch[]>();
        for (const batch of allBatches) {
            if (getStock(batch.id, pharmacyDept.id) > 0) {
                const list = byVariant.get(batch.variantId) ?? [];
                list.push(batch);
                byVariant.set(batch.variantId, list);
            }
        }
        return [...byVariant.entries()].map(([variantId, batches]) => ({
            variantId,
            batches,
        }));
    }

    let visitCounter = 0;
    let prescriptionCounter = 0;
    let dispenseCounter = 0;
    let queueEntryCounter = 0;

    for (const dept of standardDepartments) {
        const deptDoctors = doctorsByDepartment.get(dept.id) ?? [];
        if (deptDoctors.length === 0) continue;

        const visitCount = randInt(25, 45); // per department across 6 months

        for (let v = 0; v < visitCount; v++) {
            const visitDate = randomDateBetween(
                SIX_MONTHS_AGO,
                addDays(NOW, -1),
            );
            const patient = pick(patients);
            const doctor = pick(deptDoctors);
            const addedBy = pick(receptionUsers);

            // Queue entry lifecycle: added -> locked (in_consultation) -> completed,
            // OR added -> removed (cancelled before consultation). Decide the
            // outcome up front so we never write a queue entry that looks both
            // completed and removed.
            queueEntryCounter++;
            const isCancelled = chance(0.06);

            const queueEntry = isCancelled
                ? await prisma.departmentQueue.create({
                      data: {
                          departmentId: dept.id,
                          patientId: patient.id,
                          status: QueueStatus.removed,
                          addedById: addedBy.id,
                          addedAt: visitDate,
                          removedById: doctor.id,
                          removedReason: pick(CANCEL_REASONS),
                      },
                  })
                : await prisma.departmentQueue.create({
                      data: {
                          departmentId: dept.id,
                          patientId: patient.id,
                          status: QueueStatus.completed,
                          addedById: addedBy.id,
                          addedAt: visitDate,
                          lockedById: doctor.id,
                          lockedAt: visitDate,
                          completedAt: visitDate,
                      },
                  });

            if (isCancelled) continue;

            visitCounter++;
            const willPrescribe = chance(0.65);

            const visit = await prisma.medicalVisit.create({
                data: {
                    patientId: patient.id,
                    doctorId: doctor.id,
                    departmentId: dept.id,
                    queueEntryId: queueEntry.id,
                    visitDate,
                    clinicalNotes: pick(CLINICAL_NOTES_POOL),
                    diagnosis: pick(VISIT_DIAGNOSES),
                    status: VisitStatus.completed,
                    createdAt: visitDate,
                },
            });

            // Occasionally cancel a small fraction of completed visits after the fact
            if (chance(0.03)) {
                await prisma.medicalVisit.update({
                    where: { id: visit.id },
                    data: {
                        status: VisitStatus.cancelled,
                        cancelReason: pick(CANCEL_REASONS),
                        cancelledById: doctor.id,
                        cancelledAt: addDays(visitDate, randInt(0, 2)),
                    },
                });
            }

            if (!willPrescribe) continue;

            const pharmacyStockedVariants = pharmacyVariantsWithStock();
            if (pharmacyStockedVariants.length === 0) continue;

            const isRecurring = chance(0.35);
            const frequencyUnit = isRecurring
                ? pick([
                      FrequencyUnit.day,
                      FrequencyUnit.week,
                      FrequencyUnit.month,
                  ])
                : undefined;
            const frequencyInterval = isRecurring
                ? frequencyUnit === FrequencyUnit.day
                    ? randInt(7, 14)
                    : frequencyUnit === FrequencyUnit.week
                      ? randInt(2, 4)
                      : 1
                : undefined;
            const totalCycles = isRecurring ? randInt(2, 4) : undefined;

            const startDate = dateOnly(visitDate);
            const currentCycleEnd = frequencyUnit
                ? frequencyUnit === FrequencyUnit.day
                    ? addDays(startDate, frequencyInterval!)
                    : frequencyUnit === FrequencyUnit.week
                      ? addDays(startDate, frequencyInterval! * 7)
                      : addMonths(startDate, frequencyInterval!)
                : startDate;

            const chosenVariants = pickMany(
                pharmacyStockedVariants,
                randInt(1, 3),
            );
            const prescriptionItemsInput = chosenVariants.map((cv) => {
                return {
                    variantId: cv.variantId,
                    prescribedQuantity: randInt(6, 60),
                    dosage: pick([
                        'قرص واحد',
                        'قرصان',
                        'نصف قرص',
                        '5 مل',
                        '10 مل',
                    ]),
                    frequency: pick([
                        'مرة يومياً',
                        'مرتين يومياً',
                        'ثلاث مرات يومياً',
                        'عند اللزوم',
                    ]),
                    durationDays: randInt(3, 30),
                };
            });

            prescriptionCounter++;
            const prescription = await prisma.prescription.create({
                data: {
                    visitId: visit.id,
                    patientId: patient.id,
                    doctorId: doctor.id,
                    status: PrescriptionStatus.active,
                    frequencyUnit,
                    frequencyInterval,
                    startDate,
                    totalCycles,
                    currentCycleNumber: 1,
                    currentCycleStart: startDate,
                    currentCycleEnd,
                    currentCycleStatus: CycleStatus.ready,
                    createdAt: visitDate,
                    items: { create: prescriptionItemsInput },
                },
                include: { items: true },
            });

            const medicationSummary = prescription.items
                .map((it) => {
                    const v = allVariants.find((av) => av.id === it.variantId)!;
                    return `${v.variantName} x${it.prescribedQuantity}`;
                })
                .join(', ');

            await prisma.pharmacyDispenseQueue.create({
                data: {
                    patientId: patient.id,
                    nationalId: patient.nationalId,
                    familyBookNumber: patient.familyBookNumber,
                    patientName: patient.fullName,
                    prescriptionId: prescription.id,
                    cycleNumber: 1,
                    medicationSummary,
                    status: CycleStatus.ready,
                    readySince: visitDate,
                },
            });

            // Simulate dispensing for most prescriptions shortly after being written
            const willDispense = chance(0.8);
            if (!willDispense) continue;

            const dispensedAt = addDays(visitDate, randInt(0, 2));
            const pharmacist = pick(pharmacistUsers);
            const isFullyDispensed = chance(0.75);

            const dispense = await prisma.prescriptionDispense.create({
                data: {
                    prescriptionId: prescription.id,
                    cycleNumber: 1,
                    dispensedById: pharmacist.id,
                    dispensedAt,
                    notes: chance(0.3)
                        ? 'تم الصرف الكامل حسب الوصفة الطبية.'
                        : undefined,
                },
            });
            dispenseCounter++;

            let allItemsFullyMet = true;

            for (const item of prescription.items) {
                const dispenseRatio = isFullyDispensed
                    ? 1
                    : randFloat(0.3, 0.9, 2);
                const quantityToDispense = Math.max(
                    1,
                    Math.round(Number(item.prescribedQuantity) * dispenseRatio),
                );
                if (quantityToDispense < Number(item.prescribedQuantity))
                    allItemsFullyMet = false;

                // FEFO allocation across pharmacy batches for this variant
                let remaining = quantityToDispense;
                const batchesForVariant = findAvailableBatchesForVariant(
                    item.variantId,
                    pharmacyDept.id,
                );
                for (const batch of batchesForVariant) {
                    if (remaining <= 0) break;
                    const available = getStock(batch.id, pharmacyDept.id);
                    const take = Math.min(available, remaining);
                    if (take <= 0) continue;

                    await prisma.prescriptionDispenseItem.create({
                        data: {
                            dispenseId: dispense.id,
                            prescriptionItemId: item.id,
                            variantId: item.variantId,
                            batchId: batch.id,
                            quantity: take,
                        },
                    });

                    const balanceAfter = await adjustStock(
                        batch.id,
                        pharmacyDept.id,
                        -take,
                    );
                    await recordTransaction({
                        transactionType: TransactionType.prescription_dispense,
                        variantId: item.variantId,
                        batchId: batch.id,
                        departmentId: pharmacyDept.id,
                        quantity: -take,
                        balanceAfter,
                        referenceType: ReferenceType.prescription_dispense,
                        referenceId: dispense.id,
                        performedById: pharmacist.id,
                        transactionDate: dispensedAt,
                    });

                    remaining -= take;
                }

                const actuallyDispensed = quantityToDispense - remaining;
                if (actuallyDispensed < Number(item.prescribedQuantity))
                    allItemsFullyMet = false;

                await prisma.prescriptionItem.update({
                    where: { id: item.id },
                    data: {
                        dispensedQuantity: { increment: actuallyDispensed },
                    },
                });
            }

            // Resolve the cycle: if fully met and it's a one-time (non-recurring)
            // or final-cycle prescription, mark completed + log + drop from queue.
            // Otherwise mark partially_delivered and leave in the dispense queue.
            const isOneTime = !frequencyUnit || !frequencyInterval;
            const isFinalCycle =
                isOneTime || (totalCycles !== undefined && 1 >= totalCycles);

            if (allItemsFullyMet) {
                const resolvedAt = dispensedAt;
                await prisma.prescriptionCycleLog.create({
                    data: {
                        prescriptionId: prescription.id,
                        cycleNumber: 1,
                        periodStart: startDate,
                        periodEnd: currentCycleEnd,
                        resolvedStatus: CycleStatus.delivered,
                        resolvedAt,
                    },
                });

                if (isFinalCycle) {
                    await prisma.prescription.update({
                        where: { id: prescription.id },
                        data: {
                            status: PrescriptionStatus.completed,
                            currentCycleStatus: CycleStatus.delivered,
                        },
                    });
                    await prisma.pharmacyDispenseQueue.deleteMany({
                        where: { prescriptionId: prescription.id },
                    });
                } else {
                    // Advance to next cycle, still "ready" and waiting in the dispense queue
                    const nextCycleStart = currentCycleEnd;
                    const nextCycleEnd =
                        frequencyUnit === FrequencyUnit.day
                            ? addDays(nextCycleStart, frequencyInterval!)
                            : frequencyUnit === FrequencyUnit.week
                              ? addDays(nextCycleStart, frequencyInterval! * 7)
                              : addMonths(nextCycleStart, frequencyInterval!);

                    await prisma.prescription.update({
                        where: { id: prescription.id },
                        data: {
                            currentCycleNumber: 2,
                            currentCycleStart: nextCycleStart,
                            currentCycleEnd: nextCycleEnd,
                            currentCycleStatus: CycleStatus.ready,
                        },
                    });
                    await prisma.pharmacyDispenseQueue.updateMany({
                        where: { prescriptionId: prescription.id },
                        data: {
                            cycleNumber: 2,
                            status: CycleStatus.ready,
                            readySince: resolvedAt,
                        },
                    });
                }
            } else {
                await prisma.prescription.update({
                    where: { id: prescription.id },
                    data: {
                        currentCycleStatus: CycleStatus.partially_delivered,
                    },
                });
                await prisma.pharmacyDispenseQueue.updateMany({
                    where: { prescriptionId: prescription.id },
                    data: { status: CycleStatus.partially_delivered },
                });
            }
        }
    }
    console.log(
        `   ✓ ${queueEntryCounter} queue entries, ${visitCounter} completed visits, ${prescriptionCounter} prescriptions, ${dispenseCounter} dispenses.`,
    );

    // ---------------------------------------------------------------------------
    // STEP 12: Inventory adjustments (damaged/expired/shrinkage/found) and stock
    // count sessions, across every stock-tracking department. Adjustments only
    // ever touch batch/department pairs that actually have live stock right now.
    // ---------------------------------------------------------------------------
    console.log(
        '\n[12/13] Seeding inventory adjustments and stock count sessions...',
    );

    function liveStockPairs(
        departmentId: string,
    ): { batch: SeededBatch; quantity: number }[] {
        const pairs: { batch: SeededBatch; quantity: number }[] = [];
        for (const batch of allBatches) {
            const qty = getStock(batch.id, departmentId);
            if (qty > 0) pairs.push({ batch, quantity: qty });
        }
        return pairs;
    }

    let adjustmentCounter = 0;

    const adjustmentDepartments = [
        centralWarehouse,
        pharmacyDept,
        ...standardDepartments,
    ];
    for (const dept of adjustmentDepartments) {
        const stockPairs = liveStockPairs(dept.id);
        if (stockPairs.length === 0) continue;

        const adjustmentCount = randInt(3, 9);
        const targets = pickMany(
            stockPairs,
            Math.min(adjustmentCount, stockPairs.length),
        );

        for (const target of targets) {
            const adjustmentType = pick<AdjustmentType>([
                AdjustmentType.damaged,
                AdjustmentType.expired,
                AdjustmentType.shrinkage,
                AdjustmentType.found,
            ]);
            const isIncreasing = adjustmentType === AdjustmentType.found;
            const variant = allVariants.find(
                (v) => v.id === target.batch.variantId,
            )!;

            const maxDecrease = Math.max(1, Math.floor(target.quantity * 0.3));
            const quantity = isIncreasing
                ? randInt(5, 40)
                : randInt(1, maxDecrease);
            const performedById =
                dept.id === centralWarehouse.id
                    ? warehouseManagerUser.id
                    : dept.id === pharmacyDept.id
                      ? pick(pharmacistUsers).id
                      : departmentManagerUser.id;
            const adjustedAt = randomDateBetween(
                dateOfBatchAvailable(target.batch, dept.id),
                NOW,
            );

            const adjustment = await prisma.inventoryAdjustment.create({
                data: {
                    variantId: variant.id,
                    departmentId: dept.id,
                    batchId: target.batch.id,
                    adjustmentType,
                    quantity,
                    reportedById: performedById,
                    notes: pick(ADJUSTMENT_NOTES[adjustmentType]),
                    createdAt: adjustedAt,
                },
            });
            adjustmentCounter++;

            const delta = isIncreasing ? quantity : -quantity;
            const balanceAfter = await adjustStock(
                target.batch.id,
                dept.id,
                delta,
            );
            const txType: TransactionType =
                adjustmentType === AdjustmentType.damaged
                    ? TransactionType.adjustment_damaged
                    : adjustmentType === AdjustmentType.expired
                      ? TransactionType.adjustment_expired
                      : adjustmentType === AdjustmentType.shrinkage
                        ? TransactionType.adjustment_shrinkage
                        : TransactionType.adjustment_found;

            await recordTransaction({
                transactionType: txType,
                variantId: variant.id,
                batchId: target.batch.id,
                departmentId: dept.id,
                quantity: delta,
                balanceAfter,
                referenceType: ReferenceType.adjustment,
                referenceId: adjustment.id,
                performedById,
                transactionDate: adjustedAt,
            });
        }
    }
    console.log(`   ✓ ${adjustmentCounter} inventory adjustments recorded.`);

    function dateOfBatchAvailable(
        batch: SeededBatch,
        _departmentId: string,
    ): Date {
        // Conservative: don't backdate an adjustment before the batch itself
        // existed in the system.
        return batch.receivingDate > SIX_MONTHS_AGO
            ? batch.receivingDate
            : SIX_MONTHS_AGO;
    }

    // Stock count sessions: one completed historical session per standard
    // department + the central warehouse, each covering a handful of
    // variant/batch pairs with a counted quantity that sometimes differs from
    // the expected (live) quantity, generating an auto-adjustment exactly like
    // the real completeSession() flow does.
    let stockCountSessionCounter = 0;
    const stockCountDepartments = [centralWarehouse, ...standardDepartments];

    for (const dept of stockCountDepartments) {
        const stockPairs = liveStockPairs(dept.id);
        if (stockPairs.length === 0) continue;

        const countDate = randomDateBetween(
            addDays(SIX_MONTHS_AGO, 20),
            addDays(NOW, -5),
        );
        const initiatedBy =
            dept.id === centralWarehouse.id
                ? warehouseManagerUser
                : departmentManagerUser;

        const session = await prisma.stockCountSession.create({
            data: {
                departmentId: dept.id,
                initiatedById: initiatedBy.id,
                status: StockCountStatus.draft,
                countDate: dateOnly(countDate),
                notes: 'جرد دوري مجدول للتحقق من دقة المخزون المسجل.',
                createdAt: countDate,
            },
        });
        stockCountSessionCounter++;

        const itemsToCount = pickMany(
            stockPairs,
            Math.min(randInt(5, 10), stockPairs.length),
        );
        for (const target of itemsToCount) {
            const expectedQuantity = target.quantity;
            const hasVariance = chance(0.35);
            const countedQuantity = hasVariance
                ? Math.max(0, expectedQuantity + randInt(-8, 8))
                : expectedQuantity;

            await prisma.stockCountItem.create({
                data: {
                    sessionId: session.id,
                    variantId: target.batch.variantId,
                    batchId: target.batch.id,
                    expectedQuantity,
                    countedQuantity,
                    variance: countedQuantity - expectedQuantity,
                    notes: hasVariance
                        ? 'تم تسجيل فرق أثناء الجرد اليدوي.'
                        : undefined,
                },
            });
        }

        // Complete the session: apply variance -> adjustments + ledger, mirroring
        // stock-counts.repository.ts completeSession() exactly.
        const completedAt = addDays(countDate, randInt(0, 1));
        await prisma.stockCountSession.update({
            where: { id: session.id },
            data: { status: StockCountStatus.completed, completedAt },
        });

        const sessionItems = await prisma.stockCountItem.findMany({
            where: { sessionId: session.id },
        });
        for (const item of sessionItems) {
            const variance = Number(item.variance);
            if (variance === 0 || !item.batchId) continue;

            const varianceAdjustmentType: AdjustmentType =
                variance > 0 ? AdjustmentType.found : AdjustmentType.shrinkage;
            const quantity = Math.abs(variance);

            const varianceAdjustment = await prisma.inventoryAdjustment.create({
                data: {
                    variantId: item.variantId,
                    departmentId: dept.id,
                    batchId: item.batchId,
                    adjustmentType: varianceAdjustmentType,
                    quantity,
                    notes: 'تسوية تلقائية ناتجة عن فرق الجرد.',
                    reportedById: initiatedBy.id,
                    referenceType: 'stock_count',
                    referenceId: session.id,
                    createdAt: completedAt,
                },
            });
            adjustmentCounter++;

            const delta = variance > 0 ? quantity : -quantity;
            const balanceAfter = await adjustStock(
                item.batchId,
                dept.id,
                delta,
            );
            await recordTransaction({
                transactionType:
                    variance > 0
                        ? TransactionType.adjustment_found
                        : TransactionType.adjustment_shrinkage,
                variantId: item.variantId,
                batchId: item.batchId,
                departmentId: dept.id,
                quantity: delta,
                balanceAfter,
                referenceType: ReferenceType.stock_count,
                referenceId: session.id,
                performedById: initiatedBy.id,
                transactionDate: completedAt,
            });
            void varianceAdjustment; // created for audit trail completeness
        }
    }
    console.log(
        `   ✓ ${stockCountSessionCounter} completed stock count sessions (with auto-generated variance adjustments).`,
    );

    // ---------------------------------------------------------------------------
    // STEP 13: Disposal transfers (damaged/expired adjustments + near-expiry
    // batches -> disposal warehouse) and disposal sale requests (from disposal
    // warehouse stock -> external destinations).
    // ---------------------------------------------------------------------------
    console.log(
        '\n[13/13] Seeding disposal transfers and disposal sale requests...',
    );

    // Deliberately create some genuinely near-expiry / already-expired batches
    // in a couple of standard departments so the disposal-candidates flow has
    // real material to work with (near_expiry_disposal_days is configured on
    // several PRODUCTS_SEED entries above).
    const nearExpiryProductVariantIds = new Set(
        allVariants
            .filter((v) => v.nearExpiryDisposalDays !== undefined)
            .map((v) => v.id),
    );

    let disposalTransferCounter = 0;
    let disposalItemCounter = 0;

    for (const dept of [...standardDepartments, pharmacyDept]) {
        // Damaged/expired adjustment-sourced candidates: reuse adjustments already
        // created above that are still "un-transferred" (no linked disposal item).
        const eligibleAdjustments = await prisma.inventoryAdjustment.findMany({
            where: {
                departmentId: dept.id,
                adjustmentType: {
                    in: [AdjustmentType.damaged, AdjustmentType.expired],
                },
            },
            select: {
                id: true,
                variantId: true,
                batchId: true,
                quantity: true,
                createdAt: true,
            },
        });

        if (eligibleAdjustments.length === 0 && !chance(0.3)) continue;

        const initiatedAt =
            eligibleAdjustments.length > 0
                ? addDays(
                      eligibleAdjustments[eligibleAdjustments.length - 1]
                          .createdAt,
                      randInt(1, 5),
                  )
                : randomDateBetween(
                      addDays(SIX_MONTHS_AGO, 30),
                      addDays(NOW, -5),
                  );

        const transfer = await prisma.disposalTransfer.create({
            data: {
                departmentId: dept.id,
                status: DisposalTransferStatus.initiated,
                initiatedById:
                    dept.id === pharmacyDept.id
                        ? pharmacistUsers[0].id
                        : departmentManagerUser.id,
                initiatedAt,
                notes: 'تجميع العناصر التالفة والمنتهية الصلاحية لنقلها إلى مستودع الهالك.',
            },
        });
        disposalTransferCounter++;

        let itemsCreated = 0;
        for (const adj of eligibleAdjustments) {
            await prisma.disposalTransferItem.create({
                data: {
                    transferId: transfer.id,
                    sourceType: DisposalItemSource.adjustment,
                    adjustmentId: adj.id,
                    variantId: adj.variantId,
                    batchId: adj.batchId,
                    shippedQuantity: adj.quantity,
                },
            });
            itemsCreated++;
            disposalItemCounter++;
        }

        // Also sweep a couple of near-expiry variant batches with live stock,
        // zeroing them out of the department (mirrors initiateTransfer's raw-SQL
        // zero-out behavior).
        const nearExpiryCandidates = liveStockPairs(dept.id).filter((p) =>
            nearExpiryProductVariantIds.has(p.batch.variantId),
        );
        const sweep = pickMany(
            nearExpiryCandidates,
            Math.min(2, nearExpiryCandidates.length),
        );
        for (const candidate of sweep) {
            const liveQuantity = getStock(candidate.batch.id, dept.id);
            if (liveQuantity <= 0) continue;

            await prisma.disposalTransferItem.create({
                data: {
                    transferId: transfer.id,
                    sourceType: DisposalItemSource.near_expiry,
                    variantId: candidate.batch.variantId,
                    batchId: candidate.batch.id,
                    shippedQuantity: liveQuantity,
                },
            });
            itemsCreated++;
            disposalItemCounter++;

            const balanceAfter = await adjustStock(
                candidate.batch.id,
                dept.id,
                -liveQuantity,
            );
            await recordTransaction({
                transactionType: TransactionType.disposal_transfer_out,
                variantId: candidate.batch.variantId,
                batchId: candidate.batch.id,
                departmentId: dept.id,
                quantity: -liveQuantity,
                balanceAfter,
                referenceType: ReferenceType.disposal_transfer,
                referenceId: transfer.id,
                performedById: transfer.initiatedById,
                transactionDate: initiatedAt,
            });
        }

        if (itemsCreated === 0) {
            // Nothing eligible after all; remove the empty transfer to avoid a
            // dangling initiated transfer with zero items (wouldn't happen via the
            // real API, which requires at least one item).
            await prisma.disposalTransfer.delete({
                where: { id: transfer.id },
            });
            disposalTransferCounter--;
            continue;
        }

        // Resolve most transfers to 'confirmed' (received into disposal warehouse),
        // a few left 'initiated' (in-flight) or 'cancelled' for status variety.
        const outcome = chance(0.75)
            ? 'confirmed'
            : chance(0.5)
              ? 'initiated'
              : 'cancelled';

        if (outcome === 'initiated') continue;

        if (outcome === 'cancelled') {
            const cancelledAt = addDays(initiatedAt, randInt(1, 3));
            await prisma.disposalTransfer.update({
                where: { id: transfer.id },
                data: {
                    status: DisposalTransferStatus.cancelled,
                    cancelledById: transfer.initiatedById,
                    cancelledAt,
                    cancelReason: pick(DISPOSAL_CANCEL_REASONS),
                },
            });
            // restore stock for the near_expiry items that had been zeroed out
            const transferItems = await prisma.disposalTransferItem.findMany({
                where: {
                    transferId: transfer.id,
                    sourceType: DisposalItemSource.near_expiry,
                },
            });
            for (const item of transferItems) {
                const balanceAfter = await adjustStock(
                    item.batchId,
                    dept.id,
                    Number(item.shippedQuantity),
                );
                await recordTransaction({
                    transactionType: TransactionType.disposal_transfer_in,
                    variantId: item.variantId,
                    batchId: item.batchId,
                    departmentId: dept.id,
                    quantity: Number(item.shippedQuantity),
                    balanceAfter,
                    referenceType: ReferenceType.disposal_transfer,
                    referenceId: transfer.id,
                    performedById: transfer.initiatedById,
                    transactionDate: cancelledAt,
                });
            }
            continue;
        }

        // outcome === 'confirmed'
        const confirmedAt = addDays(initiatedAt, randInt(1, 4));
        const transferItems = await prisma.disposalTransferItem.findMany({
            where: { transferId: transfer.id },
        });

        await prisma.disposalTransfer.update({
            where: { id: transfer.id },
            data: {
                status: DisposalTransferStatus.confirmed,
                confirmedById: disposalManagerUser.id,
                confirmedAt,
                notes: 'تم استلام جميع العناصر في مستودع الهالك ومطابقتها.',
            },
        });

        for (const item of transferItems) {
            const confirmedQuantity = Number(item.shippedQuantity); // confirmed fully as shipped
            await prisma.disposalTransferItem.update({
                where: { id: item.id },
                data: { confirmedQuantity, quantityDiscrepancy: 0 },
            });

            const balanceAfter = await adjustStock(
                item.batchId,
                disposalWarehouse.id,
                confirmedQuantity,
            );
            await recordTransaction({
                transactionType: TransactionType.disposal_transfer_in,
                variantId: item.variantId,
                batchId: item.batchId,
                departmentId: disposalWarehouse.id,
                quantity: confirmedQuantity,
                balanceAfter,
                referenceType: ReferenceType.disposal_transfer,
                referenceId: transfer.id,
                performedById: disposalManagerUser.id,
                transactionDate: confirmedAt,
            });
        }
    }
    console.log(
        `   ✓ ${disposalTransferCounter} disposal transfers, ${disposalItemCounter} disposal transfer items.`,
    );

    // Disposal sale requests: sell off some of what has now landed in the
    // disposal warehouse to external destinations.
    let disposalSaleCounter = 0;
    const disposalWarehouseStock = liveStockPairs(disposalWarehouse.id);

    if (disposalWarehouseStock.length > 0) {
        const saleRequestCount = Math.min(
            randInt(3, 6),
            disposalWarehouseStock.length,
        );
        const saleBatches = pickMany(disposalWarehouseStock, saleRequestCount);

        for (const saleBatch of saleBatches) {
            const destination = pick(destinations);
            const createdAt = randomDateBetween(
                addDays(SIX_MONTHS_AGO, 40),
                addDays(NOW, -3),
            );
            const quantity = Math.max(
                1,
                Math.floor(saleBatch.quantity * randFloat(0.3, 1.0, 2)),
            );
            const variant = allVariants.find(
                (v) => v.id === saleBatch.batch.variantId,
            )!;

            const saleRequest = await prisma.disposalSaleRequest.create({
                data: {
                    destinationId: destination.id,
                    requestedById: disposalManagerUser.id,
                    status: DisposalSaleRequestStatus.pending_approval,
                    notes: chance(0.4)
                        ? 'بيع كمية من الهالك القابل لإعادة التدوير.'
                        : undefined,
                    createdAt,
                    items: {
                        create: [
                            {
                                variantId: variant.id,
                                batchId: saleBatch.batch.id,
                                quantity,
                                price: randFloat(50, 2000, 0),
                            },
                        ],
                    },
                },
            });
            disposalSaleCounter++;

            const outcome = chance(0.7)
                ? 'completed'
                : chance(0.5)
                  ? 'awaiting_confirmation'
                  : chance(0.5)
                    ? 'rejected'
                    : 'cancelled';

            if (outcome === 'rejected') {
                await prisma.disposalSaleRequest.update({
                    where: { id: saleRequest.id },
                    data: {
                        status: DisposalSaleRequestStatus.rejected,
                        rejectionReason: pick(REJECTION_REASONS),
                    },
                });
                continue;
            }
            if (outcome === 'cancelled') {
                await prisma.disposalSaleRequest.update({
                    where: { id: saleRequest.id },
                    data: { status: DisposalSaleRequestStatus.cancelled },
                });
                continue;
            }

            const approvedAt = addDays(createdAt, randInt(1, 3));
            await prisma.disposalSaleRequest.update({
                where: { id: saleRequest.id },
                data: {
                    status: DisposalSaleRequestStatus.awaiting_confirmation,
                    approvedById: hospitalManager.id,
                    approvedAt,
                },
            });

            // Attach a placeholder image record (no real file storage in seed data,
            // but the row exists so image-count logic in the UI is satisfied)
            await prisma.disposalSaleRequestImage.create({
                data: {
                    requestId: saleRequest.id,
                    imageKey: `disposal-sales/${saleRequest.id}/placeholder-1.jpg`,
                    sortOrder: 0,
                    createdAt: approvedAt,
                },
            });

            if (outcome === 'awaiting_confirmation') continue;

            // outcome === 'completed'
            const confirmedAt = addDays(approvedAt, randInt(1, 4));
            const stockRow = await adjustStockGuarded(
                saleBatch.batch.id,
                disposalWarehouse.id,
                -quantity,
            );
            if (stockRow === null) {
                // stock changed since we sampled it (shouldn't normally happen given
                // single-threaded seed execution, but guard anyway)
                continue;
            }

            await recordTransaction({
                transactionType: TransactionType.disposal_sale_out,
                variantId: variant.id,
                batchId: saleBatch.batch.id,
                departmentId: disposalWarehouse.id,
                quantity: -quantity,
                balanceAfter: stockRow,
                referenceType: ReferenceType.disposal_sale_request,
                referenceId: saleRequest.id,
                performedById: disposalManagerUser.id,
                transactionDate: confirmedAt,
            });

            await prisma.disposalSaleRequest.update({
                where: { id: saleRequest.id },
                data: {
                    status: DisposalSaleRequestStatus.completed,
                    confirmedById: disposalManagerUser.id,
                    confirmedAt,
                },
            });
        }
    }
    console.log(`   ✓ ${disposalSaleCounter} disposal sale requests.`);

    async function adjustStockGuarded(
        batchId: string,
        departmentId: string,
        delta: number,
    ): Promise<number | null> {
        const current = getStock(batchId, departmentId);
        if (current + delta < 0) return null;
        return adjustStock(batchId, departmentId, delta);
    }

    console.log('\n🎉 Seed completed successfully.');
    console.log(
        '\nQuick-login accounts (all use OTP login; check requestOtp response in non-production for the code):',
    );
    for (const acc of QUICK_LOGIN_ACCOUNTS) {
        console.log(`   - ${acc.role.padEnd(20)} ${acc.email}`);
    }
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
