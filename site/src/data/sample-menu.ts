/**
 * Fictional Belgian brasserie used in the marketing site's phone mockups and the interactive demo.
 * Names and descriptions are the restaurant's own (Dutch); `tr` holds the guest-language helpers.
 * Shapes mirror the real product (CLAUDE.md 4–6) so the demo behaves like the guest menu will.
 */
export type TranslatedLang = "en" | "fr" | "de";
export type GuestLang = "nl" | TranslatedLang;
export const guestLanguages: GuestLang[] = ["en", "fr", "de", "nl"];
export const guestLanguageNames: Record<GuestLang, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
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
    tr: { en: "Starters", fr: "Entrées", de: "Vorspeisen" },
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
        },
      },
    ],
  },
  {
    name: "Hoofdgerechten",
    tr: { en: "Main courses", fr: "Plats principaux", de: "Hauptgerichte" },
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
        },
      },
    ],
  },
  {
    name: "Desserts",
    tr: { en: "Desserts", fr: "Desserts", de: "Desserts" },
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
      nl: "Is het stoofvlees pikant?",
    },
    answer: {
      en: "No. The menu describes it as beef slowly stewed in dark Belgian beer with onions and mustard — mild and slightly sweet.",
      fr: "Non. La carte le décrit comme du bœuf mijoté dans une bière belge brune avec oignons et moutarde — doux et légèrement sucré.",
      de: "Nein. Laut Speisekarte ist es Rindfleisch, langsam in dunklem belgischem Bier mit Zwiebeln und Senf geschmort — mild und leicht süßlich.",
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
      nl: "Wat is vegetarisch?",
    },
    answer: {
      en: "These dishes are marked vegetarian on the menu:",
      fr: "Ces plats sont indiqués comme végétariens sur la carte :",
      de: "Diese Gerichte sind auf der Speisekarte als vegetarisch markiert:",
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
      nl: "Wat is typisch Belgisch?",
    },
    answer: {
      en: "The menu doesn't say, but typically these are Belgian classics: stoofvlees (beer stew), vol-au-vent and waterzooi from Ghent. The mussels are sold out today.",
      fr: "La carte ne le précise pas, mais ce sont typiquement des classiques belges : le stoofvlees (carbonnade), le vol-au-vent et le waterzooi gantois. Les moules sont épuisées aujourd'hui.",
      de: "Die Speisekarte sagt es nicht, aber typisch belgische Klassiker sind: Stoofvlees (Biereintopf), Vol-au-vent und Waterzooi aus Gent. Die Muscheln sind heute ausverkauft.",
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
      nl: "Is de waterzooi glutenvrij?",
    },
    answer: {
      en: "The restaurant hasn't confirmed the allergens for this dish, so I can't say it's gluten-free.",
      fr: "Le restaurant n'a pas confirmé les allergènes de ce plat, je ne peux donc pas dire qu'il est sans gluten.",
      de: "Das Restaurant hat die Allergene für dieses Gericht nicht bestätigt, daher kann ich nicht sagen, dass es glutenfrei ist.",
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
  nl: "De allergenen van dit gerecht zijn niet bevestigd door het restaurant — vraag het aan het personeel.",
};
