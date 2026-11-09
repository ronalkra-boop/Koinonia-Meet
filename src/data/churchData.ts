import { Hymn } from '../types/meeting';

export interface BibleVerseItem {
  book: string;
  reference: string;
  text: string;
  category: 'esperanza' | 'salvacion' | 'paz' | 'fe' | 'amor' | 'oracion' | 'fortaleza';
}

export const PRESET_ROOMS = [
  {
    id: 'culto-general',
    name: 'Culto General de la Iglesia',
    description: 'Servicio dominical en vivo con alabanzas, prédica y santa cena.',
    badge: 'Dominical',
  },
  {
    id: 'estudio-biblico',
    name: 'Estudio Bíblico y Discipulado',
    description: 'Enseñanza profunda de las Sagradas Escrituras y preguntas en vivo.',
    badge: 'Doctrina',
  },
  {
    id: 'reunion-oracion',
    name: 'Círculo de Oración e Intercesión',
    description: 'Clamor por los enfermos, las familias, la iglesia y las naciones.',
    badge: 'Intercesión',
  },
  {
    id: 'jovenes-adolescentes',
    name: 'Reunión de Jóvenes y Adolescentes',
    description: 'Comunión juvenil, dinámicas, alabanzas y palabra práctica.',
    badge: 'Generación',
  },
  {
    id: 'consejeria-pastoral',
    name: 'Consejería y Pastoreo',
    description: 'Espacio de cuidado pastoral, edificación personal y oración guiada.',
    badge: 'Privado',
  },
];

export const BIBLE_VERSES: BibleVerseItem[] = [
  {
    book: 'Juan',
    reference: 'Juan 3:16',
    text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
    category: 'salvacion',
  },
  {
    book: 'Salmos',
    reference: 'Salmos 23:1-3',
    text: 'Jehová es mi pastor; nada me faltará. En lugares de delicados pastos me hará descansar; junto a aguas de reposo me pastoreará. Confortará mi alma; me guiará por sendas de justicia por amor de su nombre.',
    category: 'paz',
  },
  {
    book: 'Filipenses',
    reference: 'Filipenses 4:6-7',
    text: 'Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios en toda oración y ruego, con acción de gracias. Y la paz de Dios, que sobrepasa todo entendimiento, guardará vuestros corazones y vuestros pensamientos en Cristo Jesús.',
    category: 'oracion',
  },
  {
    book: 'Filipenses',
    reference: 'Filipenses 4:13',
    text: 'Todo lo puedo en Cristo que me fortalece.',
    category: 'fortaleza',
  },
  {
    book: 'Romanos',
    reference: 'Romanos 8:28',
    text: 'Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados.',
    category: 'esperanza',
  },
  {
    book: 'Salmos',
    reference: 'Salmos 91:1-2',
    text: 'El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente. Diré yo a Jehová: Esperanza mía, y castillo mío; mi Dios, en quien confiaré.',
    category: 'paz',
  },
  {
    book: 'Isaías',
    reference: 'Isaías 40:31',
    text: 'Pero los que esperan a Jehová tendrán nuevas fuerzas; levantarán alas como las águilas; correrán, y no se cansarán; caminarán, y no se fatigarán.',
    category: 'fortaleza',
  },
  {
    book: 'Jeremías',
    reference: 'Jeremías 29:11',
    text: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis.',
    category: 'esperanza',
  },
  {
    book: 'Hebreos',
    reference: 'Hebreos 11:1',
    text: 'Es, pues, la fe la certeza de lo que se espera, la convicción de lo que no se ve.',
    category: 'fe',
  },
  {
    book: '1 Corintios',
    reference: '1 Corintios 13:4-7',
    text: 'El amor es sufrido, es benigno; el amor no tiene envidia, el amor no es jactancioso, no se envanece; no hace nada indebido, no busca lo suyo, no se irrita, no guarda rencor; no se goza de la injusticia, mas se goza de la verdad. Todo lo sufre, todo lo cree, todo lo espera, todo lo soporta.',
    category: 'amor',
  },
  {
    book: 'Mateo',
    reference: 'Mateo 28:19-20',
    text: 'Por tanto, id, y haced discípulos a todas las naciones, bautizándolos en el nombre del Padre, y del Hijo, y del Espíritu Santo; enseñándoles que guarden todas las cosas que os he mandado; y he aquí yo estoy con vosotros todos los días, hasta el fin del mundo. Amén.',
    category: 'salvacion',
  },
  {
    book: 'Proverbios',
    reference: 'Proverbios 3:5-6',
    text: 'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia. Reconócelo en todos tus caminos, y él enderezará tus veredas.',
    category: 'fe',
  },
  {
    book: 'Salmos',
    reference: 'Salmos 121:1-2',
    text: 'Alzaré mis ojos a los montes; ¿De dónde vendrá mi socorro? Mi socorro viene de Jehová, que hizo los cielos y la tierra.',
    category: 'esperanza',
  },
  {
    book: 'Efesios',
    reference: 'Efesios 6:10-11',
    text: 'Por lo demás, hermanos míos, fortaleceos en el Señor, y en el poder de su fuerza. Vestíos de toda la armadura de Dios, para que podáis estar firmes contra las asechanzas del diablo.',
    category: 'fortaleza',
  },
];

export const CHURCH_HYMNS: Hymn[] = [
  {
    id: 'hymn-1',
    title: 'Cuán Grande es Él',
    category: 'Adoración',
    chorus: 'Mi corazón entona la canción, ¡Cuán grande es Él! ¡Cuán grande es Él! Mi corazón entona la canción, ¡Cuán grande es Él! ¡Cuán grande es Él!',
    stanzas: [
      'Señor, mi Dios, al contemplar los cielos, el firmamento y las estrellas mil, al oír tu voz en los potentes truenos y ver brillar el sol en su cenit.',
      'Al recorrer los montes y los valles y ver las bellas flores al pasar, al escuchar el canto de las aves y el murmurar del claro manantial.',
      'Cuando recuerdo del amor divino, que desde el cielo al Salvador envió, aquel Jesús que por salvarme vino y en una cruz por mí murió y resucitó.',
    ],
  },
  {
    id: 'hymn-2',
    title: 'Sublime Gracia',
    category: 'Gracia y Salvación',
    chorus: '¡Gracia de Dios, sublime don! Que a un vil pecador salvó.',
    stanzas: [
      '¡Sublime gracia del Señor, que a un pecador salvó! Fui ciego mas hoy veo yo, perdido y Él me halló.',
      'Su gracia me enseñó a temer, mis dudas ahuyentó; ¡oh, cuán preciosa fue a mi ser cuando Él me transformó!',
      'En los peligros o aflicción que yo he tenido aquí, su gracia siempre me libró, y me guiará feliz.',
    ],
  },
  {
    id: 'hymn-3',
    title: 'Tu Fidelidad es Grande',
    category: 'Alabanza',
    chorus: 'Tu fidelidad es grande, tu fidelidad incomparable es; nadie como Tú, bendito Dios, grande es tu fidelidad.',
    stanzas: [
      'Tu fidelidad es grande, Señor celestial, cada mañana se renueva tu bondad. No hay sombra de variación en Ti, siempre permaneces fiel.',
      'Tú me sostienes en la tempestad, con tu diestra me das seguridad. Mi copa rebosa de tu infinito amor.',
    ],
  },
  {
    id: 'hymn-4',
    title: 'A Dios Sea la Gloria',
    category: 'Acción de Gracias',
    chorus: '¡Alabad al Señor, alaben su poder! ¡Alabad al Señor, que a su Hijo nos dio! Al Calvario subió por mi culpa a pagar, y la gloria a Dios por siempre jamás.',
    stanzas: [
      'A Dios sea la gloria, pues grande es su amor; nos dio a su Hijo, bendito Señor. Su vida entregó por el vil pecador, y abrió la puerta de vida y perdón.',
      'La sangre de Cristo la culpa borró; promesa bendita para el que creyó. El vil pecador que a Jesús aceptó, en ese momento perdón alcanzó.',
    ],
  },
];

export const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pastor: { label: 'Pastor / Administrador', color: 'text-amber-300', bg: 'bg-amber-950/70 border-amber-500/40' },
  leader: { label: 'Líder / Diácono', color: 'text-blue-300', bg: 'bg-blue-950/70 border-blue-500/40' },
  musician: { label: 'Ministerio de Alabanza', color: 'text-emerald-300', bg: 'bg-emerald-950/70 border-emerald-500/40' },
  member: { label: 'Hermano(a)', color: 'text-slate-300', bg: 'bg-slate-800/80 border-slate-700/50' },
  guest: { label: 'Invitado(a)', color: 'text-purple-300', bg: 'bg-purple-950/70 border-purple-500/40' },
};
