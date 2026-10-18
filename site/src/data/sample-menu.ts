/**
 * Fictional Belgian brasserie used in the marketing site's phone mockups (and the Phase 0.3 demo).
 * Dish and category names are the "printed" Dutch originals; `tr` holds guest-language helpers.
 */
export type GuestLang = "en" | "fr" | "de";

export interface SampleItem {
  name: string;
  price: number;
  tr: Record<GuestLang, { name: string; description: string }>;
  tags?: Array<"vegetarian" | "spicy">;
  inStock?: boolean;
}

export interface SampleCategory {
  name: string;
  tr: Record<GuestLang, string>;
  items: SampleItem[];
}

export const sampleRestaurant = {
  name: "Brasserie Lindehof",
  city: "Leuven",
};

export const sampleMenu: SampleCategory[] = [
  {
    name: "Voorgerechten",
    tr: { en: "Starters", fr: "Entrées", de: "Vorspeisen" },
    items: [
      {
        name: "Kaaskroketten",
        price: 14,
        tags: ["vegetarian"],
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
        name: "Garnaalkroketten",
        price: 18.5,
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
        name: "Stoofvlees met frietjes",
        price: 22.5,
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
        name: "Vol-au-vent met frietjes",
        price: 21,
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
        name: "Waterzooi van kip",
        price: 23,
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
        name: "Mosselen natuur",
        price: 28,
        inStock: false,
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
        name: "Dame blanche",
        price: 9.5,
        tags: ["vegetarian"],
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
    ],
  },
];

/** UI labels inside the mockup phone, in the guest's language. */
export const guestUi: Record<
  GuestLang,
  {
    outOfStock: string;
    vegetarian: string;
    ask: string;
    question: string;
    answer: string;
    allergyNote: string;
    showToStaff: string;
    table: string;
    total: string;
  }
> = {
  en: {
    outOfStock: "Out of stock",
    vegetarian: "Vegetarian",
    ask: "Ask about the menu",
    question: "Is the stoofvlees spicy?",
    answer: "No — it's a mild, slightly sweet beef stew made with dark beer.",
    allergyNote: "For allergies, please inform staff before ordering.",
    showToStaff: "Show to staff",
    table: "Table",
    total: "Total",
  },
  fr: {
    outOfStock: "Épuisé",
    vegetarian: "Végétarien",
    ask: "Une question sur le menu ?",
    question: "Le stoofvlees est-il épicé ?",
    answer:
      "Non — c'est un ragoût de bœuf doux, légèrement sucré, à la bière brune.",
    allergyNote: "En cas d'allergie, prévenez le personnel avant de commander.",
    showToStaff: "Montrer au personnel",
    table: "Table",
    total: "Total",
  },
  de: {
    outOfStock: "Ausverkauft",
    vegetarian: "Vegetarisch",
    ask: "Frage zur Speisekarte",
    question: "Ist das Stoofvlees scharf?",
    answer:
      "Nein — ein milder, leicht süßlicher Rindereintopf mit dunklem Bier.",
    allergyNote:
      "Bei Allergien bitte vor der Bestellung das Personal informieren.",
    showToStaff: "Dem Personal zeigen",
    table: "Tisch",
    total: "Summe",
  },
};
