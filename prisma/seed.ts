/**
 * Conteúdo inicial do CLEARFINGER (idempotente: só cria o que ainda não existe).
 *   npm run db:seed
 * Tudo aqui é editável no admin. Preços dos kits são valores iniciais de exemplo — revise em Ofertas.
 * Não há depoimentos: cadastre apenas depoimentos reais e autorizados.
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const db = new PrismaClient();

const SECTIONS: { key: string; type: string; label: string; data: Partial<Prisma.LandingSectionCreateInput> }[] = [
  {
    key: "hero",
    type: "hero",
    label: "Primeira tela",
    data: {
      title: "Aquele amarelado nos dedos não precisa ficar.",
      subtitle:
        "CLEARFINGER é um removedor feito para as manchas de nicotina nas mãos e nas unhas. Simples de usar, para você voltar a olhar para as próprias mãos sem incômodo.",
      ctaLabel: "QUERO CUIDAR DAS MINHAS MÃOS",
      ctaTarget: "#ofertas",
      config: {
        eyebrow: "Removedor de manchas de nicotina para mãos e unhas",
        priceNote: "à vista no PIX ou no crediário",
        badges: ["Compra segura", "PIX ou crediário", "Dados protegidos"],
      },
    },
  },
  {
    key: "dor",
    type: "pain",
    label: "Dor / identificação",
    data: {
      title: "O cigarro foi escolha sua. A mancha nos dedos, não.",
      imageUrl: "/brand/smoker.webp",
      body:
        "Muita gente não se incomoda em fumar. O que incomoda é olhar para as mãos e perceber a aparência amarelada que o cigarro deixa nos dedos e nas unhas.\n\nEla aparece na hora de cumprimentar alguém, de segurar um copo, de mostrar algo no celular. E lavar as mãos nem sempre resolve.",
      config: {
        items: ["Dedos com tom amarelado, principalmente entre o indicador e o médio", "Unhas que perderam a cor natural", "Aquela vontade de esconder as mãos em fotos e conversas"],
      },
    },
  },
  {
    key: "solucao",
    type: "solution",
    label: "Apresentação da solução",
    data: {
      title: "Foi pensando nesse problema que criamos o CLEARFINGER.",
      body:
        "Um removedor de manchas de nicotina específico para mãos e unhas. Em vez de improvisar com produtos de limpeza, você usa algo pensado para essa finalidade.\n\nVem em frasco de 30 mL com válvula pump, prático para deixar na bolsa, na mochila ou na pia do banheiro.",
      ctaLabel: "Ver kits e preços",
      ctaTarget: "#ofertas",
      config: { points: ["Específico para manchas de nicotina", "Para mãos e unhas", "Frasco de 30 mL com válvula pump", "Uso externo"] },
    },
  },
  {
    key: "como-funciona",
    type: "how_it_works",
    label: "Como funciona",
    data: {
      title: "Como usar",
      subtitle: "Três passos, no seu ritmo.",
      config: {
        steps: [
          { title: "Aplique", text: "Aplique o produto sobre as áreas amareladas dos dedos e das unhas." },
          { title: "Limpe", text: "Espalhe e limpe a região conforme as instruções da embalagem." },
          { title: "Finalize", text: "Lave as mãos e repita no dia a dia, seguindo a orientação de uso." },
        ],
        note: "Siga sempre as instruções de uso que acompanham o produto.",
      },
    },
  },
  {
    key: "demonstracao",
    type: "demo",
    label: "Demonstração",
    data: {
      active: true,
      title: "Veja o CLEARFINGER em uso",
      subtitle: "Aplicação real, do começo ao fim.",
      config: { beforeUrl: "", applicationUrl: "", afterUrl: "", posterUrl: "", caption: "" },
    },
  },
  {
    key: "beneficios",
    type: "benefits",
    label: "Benefícios",
    data: {
      title: "O que você ganha com o CLEARFINGER",
      config: {
        items: [
          { icon: "sparkle", title: "Ajuda a remover manchas amareladas", text: "Feito para a aparência amarelada que a nicotina deixa nos dedos e nas unhas." },
          { icon: "drop", title: "Fácil de usar", text: "Válvula pump: a quantidade certa, sem desperdício e sem bagunça." },
          { icon: "hand", title: "Prático para o dia a dia", text: "Frasco de 30 mL que cabe em qualquer bolsa ou gaveta." },
          { icon: "heart", title: "Cuidado com as mãos", text: "Uma rotina simples para mãos com aparência mais limpa e cuidada." },
          { icon: "check", title: "Solução específica", text: "Um produto para um problema específico — não um improviso." },
        ],
      },
    },
  },
  { key: "depoimentos", type: "testimonials", label: "Depoimentos", data: { title: "Quem já usa", subtitle: "Depoimentos de clientes, publicados com autorização." } },
  {
    key: "ofertas",
    type: "offers",
    label: "Ofertas / kits",
    data: { title: "Escolha o seu kit", subtitle: "Quanto mais unidades, menor o preço por frasco.", ctaLabel: "Comprar este kit" },
  },
  {
    key: "confianca",
    type: "trust",
    label: "Confiança e segurança",
    data: {
      title: "Compre com tranquilidade",
      config: {
        items: [
          { icon: "lock", title: "Compra segura", text: "Site com conexão protegida. Seus dados são usados só para o seu pedido." },
          { icon: "pix", title: "PIX com confirmação automática", text: "Pagou, o pedido é confirmado na hora — sem enviar comprovante." },
          { icon: "box", title: "Crediário com análise", text: "Use o protocolo do seu crediário e parcele. Nada é cobrado antes da análise." },
          { icon: "chat", title: "Atendimento", text: "Fale com a gente pelos canais de atendimento informados no rodapé." },
        ],
      },
    },
  },
  { key: "faq", type: "faq", label: "Perguntas frequentes", data: { title: "Perguntas frequentes" } },
  {
    key: "cta-final",
    type: "final_cta",
    label: "CTA final",
    data: {
      title: "Comece hoje a cuidar das suas mãos.",
      subtitle: "Escolha o kit, pague com PIX ou crediário e receba em casa.",
      ctaLabel: "QUERO O MEU CLEARFINGER",
      ctaTarget: "#ofertas",
    },
  },
];

const FAQS: { question: string; answer: string; active: boolean }[] = [
  { question: "Como usar o CLEARFINGER?", answer: "Aplique sobre as áreas manchadas dos dedos e das unhas e siga as instruções de uso que acompanham a embalagem.", active: true },
  { question: "Onde posso usar?", answer: "Nas mãos e nas unhas. É um produto de uso externo.", active: true },
  { question: "Com que frequência devo usar?", answer: "[PREENCHER] Frequência de uso recomendada pelo fabricante.", active: false },
  { question: "Qual o prazo de entrega?", answer: "[PREENCHER] Prazo de postagem e de entrega, e como acompanhar o pedido.", active: false },
  { question: "Quais as formas de pagamento?", answer: "PIX, com confirmação automática, ou crediário, usando o protocolo do seu crediário.", active: true },
  {
    question: "Como funciona o crediário?",
    answer: "No checkout, escolha Crediário e informe o número do protocolo, a validade e os 3 últimos dígitos do seu CPF, e escolha o parcelamento. O pedido é registrado e confirmado após a análise do protocolo. O crediário não é cartão de crédito e nada é cobrado antes da análise.",
    active: true,
  },
  { question: "Posso devolver o produto?", answer: "Você pode desistir da compra em até 7 dias após o recebimento, conforme o Código de Defesa do Consumidor. [PREENCHER] Como solicitar a devolução.", active: false },
  { question: "É seguro comprar aqui?", answer: "Sim. O pagamento via PIX é processado por um intermediador de pagamentos, e seus dados são usados apenas para processar e entregar o pedido.", active: true },
];

const MEDIA = [
  { id: "brand_kit", name: "Kit CLEARFINGER (caixa + frasco)", url: "/brand/kit.webp", category: "PRODUTO", alt: "Caixa e frasco do CLEARFINGER, removedor de manchas de nicotina, 30 mL" },
  { id: "brand_logo", name: "Logo CLEARFINGER", url: "/brand/logo.webp", category: "MARCA", alt: "Logo CLEARFINGER" },
  { id: "brand_logo_circ", name: "Logo circular CLEARFINGER", url: "/brand/logo-circular.webp", category: "MARCA", alt: "Logo circular CLEARFINGER" },
];

async function main() {
  for (const [i, s] of SECTIONS.entries()) {
    await db.landingSection.upsert({ where: { key: s.key }, update: {}, create: { key: s.key, type: s.type, label: s.label, sortOrder: i + 1, ...s.data } as Prisma.LandingSectionCreateInput });
  }
  if ((await db.faq.count()) === 0) await db.faq.createMany({ data: FAQS.map((f, i) => ({ ...f, sortOrder: i + 1 })) });
  for (const m of MEDIA) await db.mediaAsset.upsert({ where: { id: m.id }, update: {}, create: { ...m, storage: "static" } });

  const product = await db.product.upsert({
    where: { slug: "clearfinger" },
    update: {},
    create: {
      slug: "clearfinger",
      sku: "CF-30ML",
      name: "CLEARFINGER Removedor de Manchas de Nicotina",
      shortName: "CLEARFINGER",
      shortDescription: "Removedor de manchas de nicotina para mãos e unhas. Frasco de 30 mL com válvula pump.",
      description: "Removedor de manchas de nicotina desenvolvido para mãos e unhas. Ajuda a remover a aparência amarelada deixada pelo cigarro nos dedos e nas unhas. Uso externo.",
      priceCents: 5990,
      benefits: [
        { icon: "sparkle", title: "Ajuda a remover manchas amareladas" },
        { icon: "drop", title: "Fácil de usar" },
        { icon: "hand", title: "Prático para o dia a dia" },
      ],
      specs: [
        { label: "Conteúdo", value: "30 mL" },
        { label: "Indicação", value: "Mãos e unhas" },
        { label: "Uso", value: "Externo" },
      ],
      images: { create: [{ url: "/brand/kit-cutout.webp", alt: "Caixa e frasco do CLEARFINGER, removedor de manchas de nicotina, 30 mL", role: "MAIN", sortOrder: 0 }] },
    },
  });

  const offers = [
    { slug: "kit-1", name: "1 unidade", quantity: 1, priceCents: 5990, compareAtPriceCents: null, badge: null, highlight: false, description: "Para começar a usar.", sortOrder: 1 },
    { slug: "kit-2", name: "Kit com 2 unidades", quantity: 2, priceCents: 9990, compareAtPriceCents: 11980, badge: "Recomendado", highlight: true, description: "Uma para casa e outra para levar com você.", sortOrder: 2 },
    { slug: "kit-3", name: "Kit com 3 unidades", quantity: 3, priceCents: 13490, compareAtPriceCents: 17970, badge: "Menor preço por unidade", highlight: false, description: "Para usar por mais tempo sem precisar repor.", sortOrder: 3 },
  ];
  for (const o of offers) await db.productOffer.upsert({ where: { slug: o.slug }, update: {}, create: { ...o, productId: product.id } });

  if ((await db.orderBump.count()) === 0) {
    await db.orderBump.createMany({
      data: [
        { productId: product.id, name: "+1 frasco", title: "Adicione +1 frasco com desconto", description: "Um frasco extra para deixar no trabalho ou na bolsa. Oferta exclusiva deste pedido.", quantity: 1, priceCents: 3990, compareAtPriceCents: 5990, badge: "Oferta do checkout", sortOrder: 1 },
        { productId: product.id, name: "+2 frascos", title: "Leve +2 frascos e não fique sem", description: "Dois frascos extras com preço especial para usar por mais tempo.", quantity: 2, priceCents: 6990, compareAtPriceCents: 11980, badge: "Melhor preço", sortOrder: 2 },
      ],
    });
  }

  console.log("Seed concluído:", { sections: await db.landingSection.count(), faqs: await db.faq.count(), offers: await db.productOffer.count() });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
