/**
 * Fictional Belgian brasserie used in the marketing site's phone mockups and the interactive demo.
 * Names and descriptions are the restaurant's own (Dutch); `tr` holds the guest-language helpers.
 * Shapes mirror the real product (CLAUDE.md 4–6) so the demo behaves like the guest menu will.
 */
export type TranslatedLang = "en" | "fr" | "de" | "es" | "it" | "zh";
export type GuestLang = "nl" | TranslatedLang;
export const guestLanguages: GuestLang[] = [
  "en",
  "fr",
  "de",
  "es",
  "it",
  "zh",
  "nl",
];
export const guestLanguageNames: Record<GuestLang, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  zh: "中文",
  nl: "Nederlands",
};

export type Allergen =
  | "gluten"
  | "crustaceans"
  | "eggs"
  | "milk"
  | "celery"
  | "mustard"
  | "molluscs"
  | "sulphites";

export interface SampleItem {
  id: string;
  name: string;
  /** Restaurant's own description, in Dutch. */
  description: string;
  price: number;
  tr: Record<TranslatedLang, { name: string; description: string }>;
  vegetarian?: boolean;
  inStock?: boolean;
  /** Owner-confirmed allergens. Undefined = not confirmed yet. */
  allergens?: Allergen[];
}

export interface SampleCategory {
  name: string;
  tr: Record<TranslatedLang, string>;
  items: SampleItem[];
}

export const sampleRestaurant = {
  name: "Brasserie Lindehof",
  city: "Leuven",
  table: "5",
};

export const sampleMenu: SampleCategory[] = [
  {
    name: "Voorgerechten",
    tr: {
      en: "Starters",
      fr: "Entrées",
      de: "Vorspeisen",
      es: "Entrantes",
      it: "Antipasti",
      zh: "前菜",
    },
    items: [
      {
        id: "kaaskroketten",
        name: "Kaaskroketten",
        description:
          "Twee krokante kroketten met gesmolten Belgische kaas, gefrituurde peterselie en citroen.",
        price: 14,
        vegetarian: true,
        allergens: ["gluten", "milk", "eggs"],
        tr: {
          en: {
            name: "Cheese croquettes",
            description:
              "Two crispy croquettes filled with molten Belgian cheese, with fried parsley and lemon.",
          },
          fr: {
            name: "Croquettes au fromage",
            description:
              "Deux croquettes croustillantes au fromage belge fondant, persil frit et citron.",
          },
          de: {
            name: "Käsekroketten",
            description:
              "Zwei knusprige Kroketten mit geschmolzenem belgischem Käse, frittierter Petersilie und Zitrone.",
          },
          es: {
            name: "Croquetas de queso",
            description:
              "Dos croquetas crujientes rellenas de queso belga fundido, con perejil frito y limón.",
          },
          it: {
            name: "Crocchette di formaggio",
            description:
              "Due crocchette croccanti ripiene di formaggio belga fuso, con prezzemolo fritto e limone.",
          },
          zh: {
            name: "奶酪可乐饼",
            description:
              "两个酥脆可乐饼，内馅为融化的比利时奶酪，配炸欧芹和柠檬。",
          },
        },
      },
      {
        id: "garnaalkroketten",
        name: "Garnaalkroketten",
        description:
          "Noordzeegarnalen in een romige vulling, gepaneerd en gefrituurd. Met citroen.",
        price: 18.5,
        allergens: ["gluten", "crustaceans", "milk", "eggs"],
        tr: {
          en: {
            name: "Grey shrimp croquettes",
            description:
              "North Sea grey shrimp in a creamy filling, breaded and fried. Served with lemon.",
          },
          fr: {
            name: "Croquettes aux crevettes grises",
            description:
              "Crevettes grises de la mer du Nord dans une farce crémeuse, panées et frites. Servies avec du citron.",
          },
          de: {
            name: "Nordseekrabben-Kroketten",
            description:
              "Nordseekrabben in cremiger Füllung, paniert und frittiert. Mit Zitrone serviert.",
          },
          es: {
            name: "Croquetas de camarón gris",
            description:
              "Camarón gris del mar del Norte en un relleno cremoso, empanado y frito. Con limón.",
          },
          it: {
            name: "Crocchette di gamberetti grigi",
            description:
              "Gamberetti grigi del Mare del Nord in un ripieno cremoso, impanati e fritti. Serviti con limone.",
          },
          zh: {
            name: "灰虾可乐饼",
            description: "北海灰虾配奶油馅，裹粉油炸，配柠檬。",
          },
        },
      },
    ],
  },
  {
    name: "Hoofdgerechten",
    tr: {
      en: "Main courses",
      fr: "Plats principaux",
      de: "Hauptgerichte",
      es: "Platos principales",
      it: "Secondi piatti",
      zh: "主菜",
    },
    items: [
      {
        id: "stoofvlees",
        name: "Stoofvlees met frietjes",
        description:
          "Rundvlees, langzaam gestoofd in donker Belgisch bier met ui en mosterd.",
        price: 22.5,
        allergens: ["gluten", "mustard"],
        tr: {
          en: {
            name: "Flemish beef stew with fries",
            description:
              "Beef slowly stewed in dark Belgian beer with onions and mustard.",
          },
          fr: {
            name: "Carbonnade flamande et frites",
            description:
              "Bœuf mijoté lentement dans une bière belge brune, avec oignons et moutarde.",
          },
          de: {
            name: "Flämischer Rindereintopf mit Pommes",
            description:
              "Rindfleisch, langsam in dunklem belgischem Bier mit Zwiebeln und Senf geschmort.",
          },
          es: {
            name: "Estofado flamenco de ternera con patatas fritas",
            description:
              "Ternera guisada lentamente en cerveza belga oscura con cebolla y mostaza.",
          },
          it: {
            name: "Stufato fiammingo di manzo con patatine fritte",
            description:
              "Manzo stufato lentamente nella birra scura belga con cipolle e senape.",
          },
          zh: {
            name: "佛兰德啤酒炖牛肉配薯条",
            description: "牛肉用比利时黑啤酒、洋葱和芥末慢炖而成。",
          },
        },
      },
      {
        id: "vol-au-vent",
        name: "Vol-au-vent met frietjes",
        description:
          "Bladerdeeg met kip, balletjes en champignons in een romige saus.",
        price: 21,
        allergens: ["gluten", "milk", "eggs", "celery"],
        tr: {
          en: {
            name: "Chicken vol-au-vent with fries",
            description:
              "Puff pastry with chicken, meatballs and mushrooms in a creamy sauce.",
          },
          fr: {
            name: "Vol-au-vent et frites",
            description:
              "Feuilleté au poulet, boulettes et champignons en sauce crémeuse.",
          },
          de: {
            name: "Hühnerpastete mit Pommes",
            description:
              "Blätterteig mit Huhn, Fleischbällchen und Champignons in Rahmsauce.",
          },
          es: {
            name: "Vol-au-vent de pollo con patatas fritas",
            description:
              "Hojaldre con pollo, albóndigas y champiñones en salsa cremosa.",
          },
          it: {
            name: "Vol-au-vent di pollo con patatine fritte",
            description:
              "Sfoglia con pollo, polpettine e funghi in salsa cremosa.",
          },
          zh: {
            name: "鸡肉酥盒配薯条",
            description: "酥皮盒内盛鸡肉、肉丸和蘑菇，配奶油酱汁。",
          },
        },
      },
      {
        id: "waterzooi",
        name: "Waterzooi van kip",
        description: "Kip en groenten in een lichte, romige bouillon.",
        price: 23,
        // Allergens deliberately not confirmed: the demo shows the "ask staff" rule.
        tr: {
          en: {
            name: "Ghent-style chicken stew",
            description: "Chicken and vegetables in a light, creamy broth.",
          },
          fr: {
            name: "Waterzooi de poulet",
            description: "Poulet et légumes dans un bouillon léger et crémeux.",
          },
          de: {
            name: "Genter Hühnereintopf",
            description: "Huhn und Gemüse in einer leichten, cremigen Brühe.",
          },
          es: {
            name: "Guiso de pollo al estilo de Gante",
            description: "Pollo y verduras en un caldo ligero y cremoso.",
          },
          it: {
            name: "Stufato di pollo alla gandese",
            description: "Pollo e verdure in un brodo leggero e cremoso.",
          },
          zh: {
            name: "根特式奶油炖鸡",
            description: "鸡肉和蔬菜配清淡的奶油高汤。",
          },
        },
      },
      {
        id: "mosselen",
        name: "Mosselen natuur",
        description: "Een pot mosselen met selder en ui. Met frietjes.",
        price: 28,
        inStock: false,
        allergens: ["molluscs", "celery", "sulphites"],
        tr: {
          en: {
            name: "Mussels, natural style",
            description:
              "A pot of mussels steamed with celery and onion. Served with fries.",
          },
          fr: {
            name: "Moules nature",
            description:
              "Une casserole de moules au céleri et à l'oignon. Servies avec des frites.",
          },
          de: {
            name: "Miesmuscheln natur",
            description:
              "Ein Topf Muscheln, gedämpft mit Sellerie und Zwiebeln. Mit Pommes.",
          },
          es: {
            name: "Mejillones al natural",
            description:
              "Una olla de mejillones al vapor con apio y cebolla. Con patatas fritas.",
          },
          it: {
            name: "Cozze al naturale",
            description:
              "Una pentola di cozze al vapore con sedano e cipolla. Servite con patatine fritte.",
          },
          zh: {
            name: "清蒸青口",
            description: "一锅用芹菜和洋葱蒸制的青口，配薯条。",
          },
        },
      },
    ],
  },
  {
    name: "Desserts",
    tr: {
      en: "Desserts",
      fr: "Desserts",
      de: "Desserts",
      es: "Postres",
      it: "Dolci",
      zh: "甜点",
    },
    items: [
      {
        id: "dame-blanche",
        name: "Dame blanche",
        description: "Vanille-ijs, slagroom en warme Belgische chocoladesaus.",
        price: 9.5,
        vegetarian: true,
        allergens: ["milk", "eggs"],
        tr: {
          en: {
            name: "Vanilla ice cream with hot chocolate sauce",
            description:
              "Vanilla ice cream, whipped cream and warm Belgian chocolate sauce.",
          },
          fr: {
            name: "Dame blanche",
            description:
              "Glace vanille, crème fouettée et sauce chaude au chocolat belge.",
          },
          de: {
            name: "Vanilleeis mit heißer Schokoladensauce",
            description:
              "Vanilleeis, Schlagsahne und warme belgische Schokoladensauce.",
          },
          es: {
            name: "Helado de vainilla con salsa de chocolate caliente",
            description:
              "Helado de vainilla, nata montada y salsa caliente de chocolate belga.",
          },
          it: {
            name: "Gelato alla vaniglia con salsa di cioccolato calda",
            description:
              "Gelato alla vaniglia, panna montata e salsa calda di cioccolato belga.",
          },
          zh: {
            name: "香草冰淇淋配热巧克力酱",
            description: "香草冰淇淋、鲜奶油和温热的比利时巧克力酱。",
          },
        },
      },
      {
        id: "chocolademousse",
        name: "Chocolademousse",
        description: "Huisgemaakte mousse van pure Belgische chocolade.",
        price: 8.5,
        vegetarian: true,
        allergens: ["milk", "eggs"],
        tr: {
          en: {
            name: "Chocolate mousse",
            description: "Homemade mousse of dark Belgian chocolate.",
          },
          fr: {
            name: "Mousse au chocolat",
            description: "Mousse maison au chocolat noir belge.",
          },
          de: {
            name: "Schokoladenmousse",
            description:
              "Hausgemachte Mousse aus dunkler belgischer Schokolade.",
          },
          es: {
            name: "Mousse de chocolate",
            description: "Mousse casera de chocolate negro belga.",
          },
          it: {
            name: "Mousse al cioccolato",
            description: "Mousse fatta in casa di cioccolato fondente belga.",
          },
          zh: {
            name: "巧克力慕斯",
            description: "自制比利时黑巧克力慕斯。",
          },
        },
      },
    ],
  },
];

export const allItems = sampleMenu.flatMap((c) => c.items);

export const allergenNames: Record<GuestLang, Record<Allergen, string>> = {
  en: {
    gluten: "Gluten",
    crustaceans: "Crustaceans",
    eggs: "Eggs",
    milk: "Milk",
    celery: "Celery",
    mustard: "Mustard",
    molluscs: "Molluscs",
    sulphites: "Sulphites",
  },
  fr: {
    gluten: "Gluten",
    crustaceans: "Crustacés",
    eggs: "Œufs",
    milk: "Lait",
    celery: "Céleri",
    mustard: "Moutarde",
    molluscs: "Mollusques",
    sulphites: "Sulfites",
  },
  de: {
    gluten: "Gluten",
    crustaceans: "Krebstiere",
    eggs: "Eier",
    milk: "Milch",
    celery: "Sellerie",
    mustard: "Senf",
    molluscs: "Weichtiere",
    sulphites: "Sulfite",
  },
  es: {
    gluten: "Gluten",
    crustaceans: "Crustáceos",
    eggs: "Huevos",
    milk: "Leche",
    celery: "Apio",
    mustard: "Mostaza",
    molluscs: "Moluscos",
    sulphites: "Sulfitos",
  },
  it: {
    gluten: "Glutine",
    crustaceans: "Crostacei",
    eggs: "Uova",
    milk: "Latte",
    celery: "Sedano",
    mustard: "Senape",
    molluscs: "Molluschi",
    sulphites: "Solfiti",
  },
  zh: {
    gluten: "麸质",
    crustaceans: "甲壳类",
    eggs: "鸡蛋",
    milk: "牛奶",
    celery: "芹菜",
    mustard: "芥末",
    molluscs: "软体动物",
    sulphites: "亚硫酸盐",
  },
  nl: {
    gluten: "Gluten",
    crustaceans: "Schaaldieren",
    eggs: "Eieren",
    milk: "Melk",
    celery: "Selder",
    mustard: "Mosterd",
    molluscs: "Weekdieren",
    sulphites: "Sulfieten",
  },
};

/** UI labels inside the demo phone, in the guest's language. */
export interface GuestUi {
  language: string;
  vegetarian: string;
  all: string;
  outOfStock: string;
  allergens: string;
  allergenUnconfirmed: string;
  allergyNote: string;
  add: string;
  remove: string;
  increase: string;
  decrease: string;
  viewOrder: string;
  yourOrder: string;
  emptyOrder: string;
  notePlaceholder: string;
  showToStaff: string;
  table: string;
  total: string;
  close: string;
  ask: string;
  askTitle: string;
  askIntro: string;
  askPlaceholder: string;
  send: string;
  demoReply: string;
  fromMenu: string;
  general: string;
  staffHint: string;
  /** Kept as the short mockup bubble in the hero. */
  question: string;
  answer: string;
}

export const guestUi: Record<GuestLang, GuestUi> = {
  en: {
    language: "Language",
    vegetarian: "Vegetarian",
    all: "All dishes",
    outOfStock: "Out of stock",
    allergens: "Allergens",
    allergenUnconfirmed: "Allergen info not confirmed — please ask staff.",
    allergyNote: "For allergies, please inform staff before ordering.",
    add: "Add {dish}",
    remove: "Remove",
    increase: "One more {dish}",
    decrease: "One less {dish}",
    viewOrder: "View order",
    yourOrder: "Your order",
    emptyOrder: "Nothing added yet. Tap + next to a dish.",
    notePlaceholder: "Note, e.g. no onions",
    showToStaff: "Show to staff",
    table: "Table",
    total: "Total",
    close: "Close",
    ask: "Ask about the menu",
    askTitle: "Questions about the menu",
    askIntro: "Answers come only from this restaurant's menu.",
    askPlaceholder: "Type a question…",
    send: "Send",
    demoReply:
      "This is a demo with sample answers. Tap one of the questions above. In the real menu, guests can ask anything about the dishes.",
    fromMenu: "From the menu",
    general: "General knowledge",
    staffHint: "Show this screen to your waiter.",
    question: "Is the stoofvlees spicy?",
    answer: "No — it's a mild, slightly sweet beef stew made with dark beer.",
  },
  fr: {
    language: "Langue",
    vegetarian: "Végétarien",
    all: "Tous les plats",
    outOfStock: "Épuisé",
    allergens: "Allergènes",
    allergenUnconfirmed:
      "Allergènes non confirmés — merci de demander au personnel.",
    allergyNote: "En cas d'allergie, prévenez le personnel avant de commander.",
    add: "Ajouter {dish}",
    remove: "Retirer",
    increase: "Un {dish} de plus",
    decrease: "Un {dish} de moins",
    viewOrder: "Voir la commande",
    yourOrder: "Votre commande",
    emptyOrder: "Rien pour l'instant. Touchez + à côté d'un plat.",
    notePlaceholder: "Remarque, p. ex. sans oignons",
    showToStaff: "Montrer au personnel",
    table: "Table",
    total: "Total",
    close: "Fermer",
    ask: "Une question sur la carte ?",
    askTitle: "Questions sur la carte",
    askIntro: "Les réponses viennent uniquement de la carte de ce restaurant.",
    askPlaceholder: "Écrivez une question…",
    send: "Envoyer",
    demoReply:
      "Ceci est une démo avec des réponses d'exemple. Touchez une des questions ci-dessus. Sur la vraie carte, les clients peuvent poser n'importe quelle question sur les plats.",
    fromMenu: "Selon la carte",
    general: "Connaissance générale",
    staffHint: "Montrez cet écran au serveur.",
    question: "Le stoofvlees est-il épicé ?",
    answer:
      "Non — c'est un ragoût de bœuf doux, légèrement sucré, à la bière brune.",
  },
  de: {
    language: "Sprache",
    vegetarian: "Vegetarisch",
    all: "Alle Gerichte",
    outOfStock: "Ausverkauft",
    allergens: "Allergene",
    allergenUnconfirmed:
      "Allergene nicht bestätigt — bitte fragen Sie das Personal.",
    allergyNote:
      "Bei Allergien bitte vor der Bestellung das Personal informieren.",
    add: "{dish} hinzufügen",
    remove: "Entfernen",
    increase: "Ein {dish} mehr",
    decrease: "Ein {dish} weniger",
    viewOrder: "Bestellung ansehen",
    yourOrder: "Ihre Bestellung",
    emptyOrder: "Noch nichts ausgewählt. Tippen Sie auf + neben einem Gericht.",
    notePlaceholder: "Hinweis, z. B. ohne Zwiebeln",
    showToStaff: "Dem Personal zeigen",
    table: "Tisch",
    total: "Summe",
    close: "Schließen",
    ask: "Frage zur Speisekarte",
    askTitle: "Fragen zur Speisekarte",
    askIntro: "Antworten kommen nur aus der Speisekarte dieses Restaurants.",
    askPlaceholder: "Frage eingeben…",
    send: "Senden",
    demoReply:
      "Dies ist eine Demo mit Beispielantworten. Tippen Sie auf eine der Fragen oben. Auf der echten Speisekarte können Gäste alles über die Gerichte fragen.",
    fromMenu: "Laut Speisekarte",
    general: "Allgemeinwissen",
    staffHint: "Zeigen Sie diesen Bildschirm dem Kellner.",
    question: "Ist das Stoofvlees scharf?",
    answer:
      "Nein — ein milder, leicht süßlicher Rindereintopf mit dunklem Bier.",
  },
  es: {
    language: "Idioma",
    vegetarian: "Vegetariano",
    all: "Todos los platos",
    outOfStock: "Agotado",
    allergens: "Alérgenos",
    allergenUnconfirmed: "Alérgenos sin confirmar — pregunte al personal.",
    allergyNote: "Si tiene alergias, avise al personal antes de pedir.",
    add: "Añadir {dish}",
    remove: "Quitar",
    increase: "Un {dish} más",
    decrease: "Un {dish} menos",
    viewOrder: "Ver pedido",
    yourOrder: "Su pedido",
    emptyOrder: "Aún no hay nada. Toque + junto a un plato.",
    notePlaceholder: "Nota, p. ej. sin cebolla",
    showToStaff: "Mostrar al personal",
    table: "Mesa",
    total: "Total",
    close: "Cerrar",
    ask: "Pregunte sobre la carta",
    askTitle: "Preguntas sobre la carta",
    askIntro: "Las respuestas salen solo de la carta de este restaurante.",
    askPlaceholder: "Escriba una pregunta…",
    send: "Enviar",
    demoReply:
      "Esta es una demo con respuestas de ejemplo. Toque una de las preguntas de arriba. En la carta real, los clientes pueden preguntar cualquier cosa sobre los platos.",
    fromMenu: "Según la carta",
    general: "Conocimiento general",
    staffHint: "Muestre esta pantalla al camarero.",
    question: "¿El stoofvlees es picante?",
    answer:
      "No — es un estofado de ternera suave y algo dulce, hecho con cerveza oscura.",
  },
  it: {
    language: "Lingua",
    vegetarian: "Vegetariano",
    all: "Tutti i piatti",
    outOfStock: "Esaurito",
    allergens: "Allergeni",
    allergenUnconfirmed: "Allergeni non confermati — chiedere al personale.",
    allergyNote:
      "In caso di allergie, informate il personale prima di ordinare.",
    add: "Aggiungi {dish}",
    remove: "Rimuovi",
    increase: "Un {dish} in più",
    decrease: "Un {dish} in meno",
    viewOrder: "Vedi ordine",
    yourOrder: "Il tuo ordine",
    emptyOrder: "Ancora niente. Tocca + accanto a un piatto.",
    notePlaceholder: "Nota, es. senza cipolla",
    showToStaff: "Mostra al personale",
    table: "Tavolo",
    total: "Totale",
    close: "Chiudi",
    ask: "Chiedi del menu",
    askTitle: "Domande sul menu",
    askIntro: "Le risposte vengono solo dal menu di questo ristorante.",
    askPlaceholder: "Scrivi una domanda…",
    send: "Invia",
    demoReply:
      "Questa è una demo con risposte di esempio. Tocca una delle domande qui sopra. Nel menu reale, gli ospiti possono chiedere qualsiasi cosa sui piatti.",
    fromMenu: "Dal menu",
    general: "Conoscenza generale",
    staffHint: "Mostra questo schermo al cameriere.",
    question: "Lo stoofvlees è piccante?",
    answer:
      "No — è uno stufato di manzo delicato e leggermente dolce, fatto con birra scura.",
  },
  zh: {
    language: "语言",
    vegetarian: "素食",
    all: "全部菜品",
    outOfStock: "已售罄",
    allergens: "过敏原",
    allergenUnconfirmed: "过敏原信息未经确认 — 请询问服务员。",
    allergyNote: "如有过敏，请在点餐前告知服务员。",
    add: "添加 {dish}",
    remove: "移除",
    increase: "再加一份 {dish}",
    decrease: "减少一份 {dish}",
    viewOrder: "查看订单",
    yourOrder: "您的订单",
    emptyOrder: "尚未添加任何菜品。点击菜品旁的 +。",
    notePlaceholder: "备注，例如：不要洋葱",
    showToStaff: "出示给服务员",
    table: "桌号",
    total: "合计",
    close: "关闭",
    ask: "询问菜单",
    askTitle: "关于菜单的问题",
    askIntro: "回答仅基于本餐厅的菜单。",
    askPlaceholder: "输入问题…",
    send: "发送",
    demoReply:
      "这是一个带示例回答的演示。请点击上方的问题之一。在真实菜单中，顾客可以询问关于菜品的任何问题。",
    fromMenu: "根据菜单",
    general: "常识",
    staffHint: "请将此屏幕出示给服务员。",
    question: "Stoofvlees 辣吗？",
    answer: "不辣 — 这是一道用黑啤酒炖的温和、微甜的牛肉。",
  },
  nl: {
    language: "Taal",
    vegetarian: "Vegetarisch",
    all: "Alle gerechten",
    outOfStock: "Uitverkocht",
    allergens: "Allergenen",
    allergenUnconfirmed:
      "Allergenen niet bevestigd — vraag het aan het personeel.",
    allergyNote:
      "Heb je een allergie? Meld het aan het personeel voor je bestelt.",
    add: "{dish} toevoegen",
    remove: "Verwijderen",
    increase: "Eén {dish} meer",
    decrease: "Eén {dish} minder",
    viewOrder: "Bekijk bestelling",
    yourOrder: "Je bestelling",
    emptyOrder: "Nog niets gekozen. Tik op + naast een gerecht.",
    notePlaceholder: "Opmerking, bv. zonder ui",
    showToStaff: "Toon aan personeel",
    table: "Tafel",
    total: "Totaal",
    close: "Sluiten",
    ask: "Vraag iets over het menu",
    askTitle: "Vragen over het menu",
    askIntro: "Antwoorden komen alleen uit het menu van dit restaurant.",
    askPlaceholder: "Typ een vraag…",
    send: "Verstuur",
    demoReply:
      "Dit is een demo met voorbeeldantwoorden. Tik op een van de vragen hierboven. In het echte menu kunnen gasten alles vragen over de gerechten.",
    fromMenu: "Volgens het menu",
    general: "Algemene kennis",
    staffHint: "Toon dit scherm aan de ober.",
    question: "Is het stoofvlees pikant?",
    answer: "Nee — het is een milde, licht zoete stoofpot met donker bier.",
  },
};

/** Canned chat answers. Item cards come from the menu data (ids), like the real guardrail layer. */
export interface SampleAnswer {
  id: string;
  question: Record<GuestLang, string>;
  answer: Record<GuestLang, string>;
  type: "menu_fact" | "general_knowledge";
  itemIds: string[];
  /** Guest asked about allergens/diet: code appends `unconfirmedAllergenLine` for unconfirmed dishes. */
  allergenQuestion?: boolean;
}

export const sampleAnswers: SampleAnswer[] = [
  {
    id: "spicy",
    question: {
      en: "Is the stoofvlees spicy?",
      fr: "Le stoofvlees est-il épicé ?",
      de: "Ist das Stoofvlees scharf?",
      es: "¿El stoofvlees es picante?",
      it: "Lo stoofvlees è piccante?",
      zh: "Stoofvlees 辣吗？",
      nl: "Is het stoofvlees pikant?",
    },
    answer: {
      en: "No. The menu describes it as beef slowly stewed in dark Belgian beer with onions and mustard — mild and slightly sweet.",
      fr: "Non. La carte le décrit comme du bœuf mijoté dans une bière belge brune avec oignons et moutarde — doux et légèrement sucré.",
      de: "Nein. Laut Speisekarte ist es Rindfleisch, langsam in dunklem belgischem Bier mit Zwiebeln und Senf geschmort — mild und leicht süßlich.",
      es: "No. Según la carta, es ternera guisada lentamente en cerveza belga oscura con cebolla y mostaza — suave y algo dulce.",
      it: "No. Secondo il menu è manzo stufato lentamente nella birra scura belga con cipolle e senape — delicato e leggermente dolce.",
      zh: "不辣。根据菜单，这是用比利时黑啤酒、洋葱和芥末慢炖的牛肉 — 口味温和、微甜。",
      nl: "Nee. Volgens het menu is het rundvlees, langzaam gestoofd in donker bier met ui en mosterd — mild en licht zoet.",
    },
    type: "menu_fact",
    itemIds: ["stoofvlees"],
  },
  {
    id: "vegetarian",
    question: {
      en: "What's vegetarian?",
      fr: "Qu'est-ce qui est végétarien ?",
      de: "Was ist vegetarisch?",
      es: "¿Qué es vegetariano?",
      it: "Cosa è vegetariano?",
      zh: "哪些是素食？",
      nl: "Wat is vegetarisch?",
    },
    answer: {
      en: "These dishes are marked vegetarian on the menu:",
      fr: "Ces plats sont indiqués comme végétariens sur la carte :",
      de: "Diese Gerichte sind auf der Speisekarte als vegetarisch markiert:",
      es: "Estos platos están marcados como vegetarianos en la carta:",
      it: "Questi piatti sono indicati come vegetariani nel menu:",
      zh: "以下菜品在菜单上标注为素食：",
      nl: "Deze gerechten staan als vegetarisch op het menu:",
    },
    type: "menu_fact",
    itemIds: ["kaaskroketten", "dame-blanche", "chocolademousse"],
  },
  {
    id: "belgian",
    question: {
      en: "What's typically Belgian?",
      fr: "Qu'est-ce qui est typiquement belge ?",
      de: "Was ist typisch belgisch?",
      es: "¿Qué es típicamente belga?",
      it: "Cosa è tipicamente belga?",
      zh: "哪些是典型的比利时菜？",
      nl: "Wat is typisch Belgisch?",
    },
    answer: {
      en: "The menu doesn't say, but typically these are Belgian classics: stoofvlees (beer stew), vol-au-vent and waterzooi from Ghent. The mussels are sold out today.",
      fr: "La carte ne le précise pas, mais ce sont typiquement des classiques belges : le stoofvlees (carbonnade), le vol-au-vent et le waterzooi gantois. Les moules sont épuisées aujourd'hui.",
      de: "Die Speisekarte sagt es nicht, aber typisch belgische Klassiker sind: Stoofvlees (Biereintopf), Vol-au-vent und Waterzooi aus Gent. Die Muscheln sind heute ausverkauft.",
      es: "La carta no lo dice, pero estos son clásicos belgas típicos: stoofvlees (estofado a la cerveza), vol-au-vent y waterzooi de Gante. Los mejillones están agotados hoy.",
      it: "Il menu non lo dice, ma questi sono tipici classici belgi: stoofvlees (stufato alla birra), vol-au-vent e waterzooi di Gand. Le cozze oggi sono esaurite.",
      zh: "菜单上没有说明，但这些是典型的比利时经典菜：stoofvlees（啤酒炖牛肉）、vol-au-vent 和根特的 waterzooi。青口今天已售罄。",
      nl: "Het menu zegt het niet, maar dit zijn typisch Belgische klassiekers: stoofvlees, vol-au-vent en Gentse waterzooi. De mosselen zijn vandaag uitverkocht.",
    },
    type: "general_knowledge",
    itemIds: ["stoofvlees", "vol-au-vent", "waterzooi"],
  },
  {
    id: "gluten",
    question: {
      en: "Is the waterzooi gluten-free?",
      fr: "Le waterzooi est-il sans gluten ?",
      de: "Ist das Waterzooi glutenfrei?",
      es: "¿El waterzooi es sin gluten?",
      it: "Il waterzooi è senza glutine?",
      zh: "Waterzooi 不含麸质吗？",
      nl: "Is de waterzooi glutenvrij?",
    },
    answer: {
      en: "The restaurant hasn't confirmed the allergens for this dish, so I can't say it's gluten-free.",
      fr: "Le restaurant n'a pas confirmé les allergènes de ce plat, je ne peux donc pas dire qu'il est sans gluten.",
      de: "Das Restaurant hat die Allergene für dieses Gericht nicht bestätigt, daher kann ich nicht sagen, dass es glutenfrei ist.",
      es: "El restaurante no ha confirmado los alérgenos de este plato, así que no puedo decir que sea sin gluten.",
      it: "Il ristorante non ha confermato gli allergeni di questo piatto, quindi non posso dire che sia senza glutine.",
      zh: "餐厅尚未确认这道菜的过敏原，因此我无法说它不含麸质。",
      nl: "Het restaurant heeft de allergenen van dit gerecht niet bevestigd, dus ik kan niet zeggen dat het glutenvrij is.",
    },
    type: "menu_fact",
    itemIds: ["waterzooi"],
    allergenQuestion: true,
  },
];

/** Fixed line the code (not the model) appends to allergen answers about unconfirmed dishes (CLAUDE.md 4.1). */
export const unconfirmedAllergenLine: Record<GuestLang, string> = {
  en: "Allergen info for this dish isn't confirmed by the restaurant — please ask staff.",
  fr: "Les allergènes de ce plat ne sont pas confirmés par le restaurant — merci de demander au personnel.",
  de: "Die Allergenangaben für dieses Gericht sind vom Restaurant nicht bestätigt — bitte fragen Sie das Personal.",
  es: "La información de alérgenos de este plato no está confirmada por el restaurante — pregunte al personal.",
  it: "Gli allergeni di questo piatto non sono confermati dal ristorante — chiedere al personale.",
  zh: "餐厅尚未确认这道菜的过敏原信息 — 请询问服务员。",
  nl: "De allergenen van dit gerecht zijn niet bevestigd door het restaurant — vraag het aan het personeel.",
};
