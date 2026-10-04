// Demo books: short original stories written for this prototype so the library
// looks lived-in on first open. They are clearly labelled "Demo" in the UI and
// can be hidden from the profile menu.

import type { Book, CoverMotif, UserId } from './types';
import type { FlowDocument } from './importers/types';

interface DemoChapter {
  title: string;
  paras: string[];
}

interface DemoBook {
  id: string;
  ownerId: UserId;
  shared: boolean;
  title: string;
  author: string;
  category: string;
  description: string;
  palette: [string, string, string];
  motif: CoverMotif;
  chapters: DemoChapter[];
}

const NUMBERS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

const DEMO: DemoBook[] = [
  {
    id: 'demo-lamplighter',
    ownerId: 'aatish',
    shared: true,
    title: 'The Lamplighter’s Almanac',
    author: 'Elsie Marrow',
    category: 'Literary fiction',
    description:
      'In a harbour town where the lamps must be lit by hand, a young lamplighter discovers that each flame remembers the last person who passed beneath it.',
    palette: ['#1f3a33', '#f1e3c4', '#c9a45c'],
    motif: 'lamp',
    chapters: [
      {
        title: 'The Long Pole',
        paras: [
          'Every evening at a quarter past six, when the light over Wren Harbour turned the colour of weak tea, Tobiah Fell took the long brass pole down from its hooks behind the chandler’s shop and went out to wake the lamps.',
          'There were one hundred and twelve of them. He had counted them on his first night, and again on his second, because he had not believed the first number, and then never again, because by the third night he knew them the way you know the stairs of a house you grew up in — not by counting, but by the small changes in your step.',
          'The lamps along the harbour wall were the oldest. Their glass had gone faintly green with salt, and the little doors that opened onto the wicks had to be lifted and then nudged to the left, like a shy animal that wanted to be asked twice. The lamps on Chapel Row were newer and more obliging. The lamp outside the widow Ambry’s house leaned slightly, as if listening.',
          'Tobiah liked the work in the way that some people like rain. It asked very little of him and gave back a kind of quiet. He would lift the pole, find the catch, turn the key, and the wick would take the flame with a small sound like someone settling into a chair. Then the light would spread, a soft amber circle on the cobbles, and he would move on to the next.',
          'It was on a Tuesday in late October, at the forty-third lamp, that the flame spoke.',
          'It did not speak in words, exactly. It was more that, as the wick caught, Tobiah felt a warmth that was not the warmth of fire — a feeling of hurrying home with bread under one arm, of cold fingers, of somebody humming a song about a sailor and a pear tree. The feeling lasted the length of a breath. Then it was gone, and the lamp was only a lamp, and Tobiah was standing very still in the middle of Netmaker’s Lane with his pole raised like a question.',
          'He lit the remaining sixty-nine lamps in something of a daze. None of them hummed. None of them carried bread. But when he hung the brass pole back on its hooks that night, he noticed that his hands were not cold at all.',
        ],
      },
      {
        title: 'What the Almanac Said',
        paras: [
          'The almanac lived on the top shelf of the chandler’s back room, wedged between a tin of brass polish and a ledger nobody had opened since the old king died. It was bound in brown cloth gone soft as a mole’s back, and on its spine, in letters almost rubbed away, someone had written: For the Keeper of the Lamps.',
          'Tobiah had always assumed it was a book of tides. Most almanacs in Wren Harbour were. He took it down that Wednesday morning, while Mr. Hollis was arguing with a supplier about the price of tallow, and opened it on the counter between a coil of rope and a jar of lamp wicks.',
          'It was not a book of tides.',
          'The first page held only a single line, in a looping hand: A flame remembers the last warm thing that passed beneath it. Be kind to what it tells you.',
          'The pages after that were a record — dates, lamp numbers, and short notes, sometimes only a word or two. Lamp 12. A child with a kite. Lamp 77. Grief, but softening. Lamp 43. Someone singing. The dates went back further than Tobiah could easily believe; the ink changed colour every few decades, from brown to black to blue, and the handwriting changed with it.',
          'There were dozens of lamplighters in that book. Perhaps hundreds. And every one of them, it seemed, had felt what he had felt on Netmaker’s Lane.',
          'He turned to the last written page. The final entry was dated nine years ago, in a small, careful hand he did not recognise. Lamp 101. She will come back in the spring. Leave the light on for her.',
          'Below it, the rest of the almanac was blank. The paper was the faint cream of new milk, waiting.',
          'Tobiah closed the book very gently, the way you might close a door on someone sleeping. Then, after a moment, he opened it again, took the stub of pencil from behind his ear, and wrote: Lamp 43. Bread, and a song about a pear tree. Warm hands.',
        ],
      },
      {
        title: 'Lamp One Hundred and One',
        paras: [
          'Lamp 101 stood at the very end of the harbour wall, where the stones gave way to a short wooden jetty that nobody used any more. It was the last lamp on Tobiah’s round, and the loneliest. Gulls perched on it. Fog liked it. In winter it wore a little cap of ice that had to be tapped away before the door would open.',
          'He had never felt anything from it. Not once, in three years.',
          'That night he went to it first, out of order, which made the other lamps seem faintly put out, the way a dog looks when you feed the cat before it. He lifted the pole, found the catch, and turned the key.',
          'The flame took slowly, as if it had been waiting so long it had forgotten how. And then, very faintly — like a voice heard through two closed doors — Tobiah felt it. Not a person passing beneath, but someone standing still. Someone who had stood at the end of the jetty for a long time, looking out to sea, not cold, not sad exactly, but patient, with the particular patience of a person who has decided to trust a promise.',
          'He stood beneath it for a long while, until the fog came in and made a soft room around the lamp and himself.',
          'When he finally went back along the harbour wall to light the others, every one of them seemed to burn a little brighter, as though word had got around.',
        ],
      },
      {
        title: 'Spring',
        paras: [
          'Winter in Wren Harbour was long and grey and smelled of wet rope. Tobiah lit the lamps through all of it — through sleet that stung his face and nights so still he could hear the mussels clicking on the rocks below the wall. He wrote in the almanac every evening. Lamp 8. A quarrel, then laughter. Lamp 56. Somebody new in town, nervous. Lamp 101. Still waiting.',
          'He began to know the town differently. He knew that Mrs. Ambry walked to the chapel each Thursday carrying something she never left behind. He knew that the baker’s son practised proposing to the lamp outside the post office, and that he was getting better at it. He knew that the harbour master, who was gruff with everyone, walked home the long way so he could pass beneath the green-glassed lamps that his father had once lit.',
          'He did not tell anyone what he knew. The first page had asked him to be kind, and he had come to understand that kindness, sometimes, is simply keeping a secret carefully.',
          'The first warm evening came in the middle of April. Tobiah went out at a quarter past six with the brass pole over his shoulder, and the light over the harbour was the colour of honey instead of tea, and the air smelled of salt and new grass.',
          'There was a boat at the old jetty.',
          'It was a small boat with a patched red sail, and standing on the boards beside it, looking up at the unlit lamp, was a woman in a coat too heavy for the weather, holding a suitcase and smiling the uncertain smile of someone arriving at a place they used to belong to.',
          'Tobiah lifted the pole, found the catch, and turned the key. The flame took at once, bright and glad.',
          '“Somebody left the light on,” the woman said softly.',
          '“Somebody asked me to,” said Tobiah. And that night, in the almanac, under the last careful entry, he wrote: Lamp 101. She came back.',
        ],
      },
    ],
  },
  {
    id: 'demo-sea-house',
    ownerId: 'nishi',
    shared: false,
    title: 'Letters from the Sea House',
    author: 'Ines Calloway',
    category: 'Romance',
    description:
      'Two strangers renting the same cottage in different seasons begin leaving letters for each other in the drawer of an old writing desk.',
    palette: ['#1d2c44', '#efe4cf', '#d9a68b'],
    motif: 'wave',
    chapters: [
      {
        title: 'The Writing Desk',
        paras: [
          'The listing had said sea views and quiet, and for once a listing had told the truth. The cottage sat at the end of a sandy track, white-walled and slightly crooked, as if it had been leaning into the wind so long it had forgotten how to stand up straight.',
          'Mira arrived on the first of March with two suitcases, a box of books, and the firm intention of not talking to anybody for six weeks. She had a manuscript to finish and a heart that needed a rest, and she had decided — in the way you decide things at two in the morning — that the sea would help with both.',
          'The writing desk was in the small room upstairs, under a window that looked straight out over the water. It was old and scarred and smelled of beeswax. It had one drawer, which stuck. When she finally coaxed it open, she found inside a single envelope, unsealed, addressed in pencil to Whoever comes next.',
          'She almost didn’t read it. It felt like opening someone else’s post. But the cottage was very quiet and the sea was very loud, and in the end curiosity won, as it usually does.',
          'Dear whoever you are, the letter began. The kettle takes forever but it’s worth it. The third stair creaks, so step over it if you come down at night. At low tide, if you walk left along the beach for twenty minutes, there is a rock pool shaped like a heart. I promise I didn’t make that up. I hope this place is as kind to you as it was to me. — S.',
          'Mira read it twice. Then she went downstairs, stepping carefully over the third stair, and put the kettle on, and waited. It took forever. It was worth it.',
        ],
      },
      {
        title: 'Low Tide',
        paras: [
          'She found the rock pool on her fourth morning. It was exactly as promised: a small, perfect heart of still water held in the black rock, with a single red anemone at its centre like a pulse.',
          'She laughed out loud, alone on the beach, and the sound surprised her. She hadn’t laughed in a while.',
          'That evening she sat at the desk and, after a long time not writing her manuscript, wrote a letter instead.',
          'Dear S., she wrote. You were right about the kettle, the stair and the rock pool. You did not mention the robin who sits on the gate every morning and looks at me as if I owe him money. I have named him Mr. Pemberton. I’m supposed to be writing a novel, but mostly I am watching the sea. I hope wherever you are, you have something as good to look at. — M.',
          'She folded it into the envelope alongside the first, and closed the drawer, and felt foolish, and then felt something else that wasn’t foolish at all.',
          'The owner of the cottage, a brisk woman named Harriet who came on Fridays to check the boiler, told her that guests came and went all year round. “Some of them stay for months,” she said. “Writers, mostly. Or people who’ve had a bad year.” She looked at Mira sideways. “The sea’s good for both.”',
        ],
      },
      {
        title: 'A Reply',
        paras: [
          'Mira left at the end of April, with a finished manuscript and a slightly mended heart. She left the letters in the drawer. It seemed the right thing to do, like leaving a light on.',
          'She did not expect to come back. But in October, when the city had become loud again and the novel was with her editor and the evenings were drawing in, she found herself looking at the listing, and then booking a week, and then driving down the sandy track with the radio off, listening to the gulls.',
          'The drawer stuck, as before. She coaxed it open.',
          'There were three envelopes now.',
          'Dear M., the newest began, in the same pencil hand. I came back in the summer and found your letter, and I have to tell you that Mr. Pemberton is a perfect name and I am furious I didn’t think of it. He sat on the gate every morning in July and judged my breakfast. I have finished nothing, but I have started something, which feels like more. If you come back, check under the loose board by the fireplace. — S.',
          'Under the loose board, wrapped in a tea towel, was a small jar of sea glass — green and white and one rare piece of blue — and a scrap of paper that said, simply: For your desk, wherever it is.',
          'Mira sat on the floor of the little cottage with the jar in her lap and the sea going on and on outside, and found that she was smiling in a way she had nearly forgotten how to.',
        ],
      },
      {
        title: 'The Third Stair',
        paras: [
          'They wrote to each other for a year without meeting. It became the slowest correspondence in the world: a letter in spring, a reply in summer, another in autumn. They never left surnames or numbers. It seemed important not to, though neither of them could have said why.',
          'S. wrote about the light in August and a dog he had befriended on the beach. Mira wrote about the novel, which had been accepted, and about her mother, who was ill and then, slowly, better. S. wrote that he had once been a doctor and now made furniture, and that he had repaired the stuck drawer and then, on reflection, un-repaired it, because the sticking had started to feel like part of the ritual.',
          'In the March of the following year, Mira drove down the sandy track again. There was a car parked by the gate. Mr. Pemberton — or perhaps his son — sat on the gatepost, looking at the car with deep disapproval.',
          'The front door was open. Somewhere inside, a kettle was beginning, very slowly, to sing.',
          'Mira stood on the step for a long moment. Then she went in, and through the little hallway, and up the stairs — and, from long habit, stepped carefully over the third one.',
          'From the room with the writing desk came a voice she had never heard and somehow already knew. “You must be M.,” it said. “Nobody else knows about the stair.”',
        ],
      },
    ],
  },
  {
    id: 'demo-atlas-rain',
    ownerId: 'nishi',
    shared: false,
    title: 'A Small Atlas of Rain',
    author: 'Theo Lindqvist',
    category: 'Essays',
    description: 'Short, quiet essays on the many kinds of rain, and the people we become while we wait for it to stop.',
    palette: ['#3d4a3c', '#ede6d6', '#a7b59a'],
    motif: 'leaf',
    chapters: [
      {
        title: 'On Drizzle',
        paras: [
          'Drizzle is the rain of indecision. It does not commit. It hangs in the air like a thought you haven’t finished having, and it makes everything slightly softer at the edges — the streetlights, the trees, the faces of people waiting at bus stops.',
          'You cannot really be caught in drizzle. You simply notice, after a while, that you are damp. It is the rain of long walks and unfinished conversations, of not bothering with an umbrella because surely it will stop soon, and then arriving somewhere with your hair full of tiny silver beads.',
          'My grandmother called it angel-breath. She said it was the sky trying not to wake anyone. I think about that every time I walk through it: the whole enormous sky, tiptoeing.',
        ],
      },
      {
        title: 'On Summer Storms',
        paras: [
          'The summer storm arrives like a guest who has been talked about for days. First the heaviness, the air thick as soup. Then the strange yellow light. Then the smell — that smell, petrichor, the scent of dry earth receiving its first drops, which scientists say we can detect at five parts per trillion, more sensitive than a shark to blood.',
          'We are built, it seems, to know when rain is coming.',
          'And then it comes, all at once, and the street empties and fills with running, laughing people holding newspapers over their heads, and for ten minutes the whole city behaves like children let out of school.',
          'Afterwards everything drips and glitters. The pavements steam. Somebody’s radio starts playing again through an open window. The world has been rinsed, and for one evening it looks brand new.',
        ],
      },
      {
        title: 'On Rain at Night',
        paras: [
          'There is no sound in the world quite like rain at night, heard from inside a warm room.',
          'It is the sound of being safe while the weather happens to someone else. It turns a bedroom into a small boat. It makes tea taste better and books more absorbing and silence more companionable. It is the best possible reason to stay exactly where you are.',
          'I have lived in seven homes, and I could tell you, without hesitation, what the rain sounded like in each of them: tin roof, skylight, gutter that overflowed into a bucket, the soft hush of rain on a garden, the gentle tapping on a window above a desk where I wrote these words.',
          'If you are reading this on a rainy night, I hope you are somewhere warm. I hope somebody you love is nearby, reading too, turning their pages a little slower than you turn yours. I hope the rain keeps going until you are ready for it to stop.',
        ],
      },
    ],
  },
  {
    id: 'demo-fox-moon',
    ownerId: 'nishi',
    shared: true,
    title: 'The Fox Who Borrowed the Moon',
    author: 'Mira Okonkwo-Hale',
    category: 'Fable',
    description: 'A small red fox borrows the moon for a single night to help a friend who is afraid of the dark — and must find a way to give it back.',
    palette: ['#5a1f2b', '#f3e6cf', '#e5b86b'],
    motif: 'moon',
    chapters: [
      {
        title: 'Badger’s Trouble',
        paras: [
          'At the edge of Hollowmere Wood lived a small red fox called Wick, who was clever in the way of foxes and kind in a way that foxes do not usually admit to.',
          'His best friend was a badger called Barnaby, who was large and slow and gentle, and who had a secret: he was afraid of the dark.',
          'This is a very inconvenient thing for a badger to be afraid of, because badgers do most of their living at night. Barnaby would stand at the mouth of his sett each evening, looking out at the shadows between the trees, and his paws would refuse to move.',
          '“If only it were a little lighter,” he said one night, very quietly. “Just a little. Just enough to see the path.”',
          'Wick looked up at the sky, where the moon was hanging fat and silver over the hill, and had what he would later call an idea and what everyone else would call a terrible plan.',
        ],
      },
      {
        title: 'The Tallest Tree',
        paras: [
          'The tallest tree in Hollowmere was an old pine called Grandmother, and from her topmost branch, the foxes said, you could very nearly touch the moon.',
          'Wick climbed all night. Foxes are not made for climbing, and he slipped twice and scraped his nose once and had a short, polite argument with an owl. But at last he reached the very top, where the branch was thin as a whisker and swayed in the wind, and there was the moon, close enough to feel its cool light on his whiskers.',
          '“Excuse me,” said Wick. “I wonder if I might borrow you. Only for one night. It’s for a friend.”',
          'The moon considered this. It had been asked for many things over the years — wishes, mostly, and once a cheese sandwich — but never to be borrowed.',
          '“One night,” said the moon at last. “And you must bring me back before the sun gets up. The sky doesn’t like to be left empty.”',
        ],
      },
      {
        title: 'Giving It Back',
        paras: [
          'That night, Barnaby walked through the whole of Hollowmere Wood with the moon floating beside him like a lantern on a string. He saw the stream sparkling and the mushrooms glowing and the little paths winding everywhere like silver thread. He was not afraid at all.',
          'And somewhere around the old oak, he noticed that the shadows were not frightening when you knew what was in them. They were only the places where the light was resting.',
          'Just before dawn, Wick climbed Grandmother once more and gave the moon back, a little tired and very grateful.',
          'The next night, Barnaby came out of his sett, looked at the dark between the trees, took a deep breath — and walked into it.',
          '“Don’t you need the moon?” asked Wick, trotting beside him.',
          '“No,” said Barnaby. “I just needed to see it once. Now I know what’s there.” And the moon, back in its proper place, hung over the hill and shone on both of them, and looked, Wick thought, very pleased with itself.',
        ],
      },
    ],
  },
  {
    id: 'demo-paper-moon',
    ownerId: 'aatish',
    shared: false,
    title: 'Midnight at the Paper Moon Café',
    author: 'Rowan Ashby',
    category: 'Short stories',
    description: 'A café that only opens after midnight serves exactly what each customer needs — which is rarely what they ordered.',
    palette: ['#2b2233', '#f0e2c8', '#c58b6b'],
    motif: 'cup',
    chapters: [
      {
        title: 'Open After Midnight',
        paras: [
          'The Paper Moon Café had no sign, no website, and no fixed address that anyone could agree on. It simply appeared, a little after midnight, on whichever street needed it most — a narrow door with a warm yellow window and a bell that rang in a minor key.',
          'Inside there were six tables, a counter of worn oak, and a proprietor named Odile who wore her silver hair in a knot held up with a pencil. She never wrote anything down. She never needed to.',
          'Daniel found it at 12:40 on a Wednesday, walking home from a job he hated in shoes that hurt. He went in because it was raining and because the window looked like a held hand.',
          '“Coffee,” he said. “Black. Strong.”',
          'Odile looked at him for a long moment, the way you look at a page you are about to turn. Then she brought him a cup of hot milk with honey and a single biscuit shaped like a star.',
        ],
      },
      {
        title: 'The Right Order',
        paras: [
          'He meant to complain. He really did. But the milk was the exact warmth of a childhood kitchen, and the biscuit tasted of cinnamon and a summer he had forgotten, and halfway through he realised he hadn’t thought about his job for seven entire minutes.',
          'At the next table, a woman in a raincoat was crying quietly over a bowl of soup she hadn’t ordered. Not unhappy crying — the other kind, the kind that comes when something stuck finally loosens.',
          'By the window, an old man sat with a pot of tea and two cups, and talked softly to the empty chair opposite him, and seemed content.',
          '“How do you know?” Daniel asked, when Odile came to clear his cup. “What people need?”',
          'She smiled. “Everybody orders what they think they should want,” she said. “But the body always tells the truth, if you watch how it sits down.”',
        ],
      },
      {
        title: 'Closing Time',
        paras: [
          'Daniel went back the next night, but the café wasn’t on his street any more. Nor the night after. He walked the city for a week looking for the yellow window and the minor-key bell, and found only shut shops and puddles.',
          'On the eighth night, he gave up looking. He went home a different way, past the river, and stopped to watch the lights shivering on the water, and realised he was thinking about quitting his job, and that the thought did not frighten him.',
          'He handed in his notice that Friday.',
          'Years later, he would open a small café of his own — daytime only, with a proper sign — and sometimes, when a tired customer came in and asked for black coffee, he would look at the way they sat down, and bring them hot milk with honey instead.',
          'They nearly always stayed a little longer than they meant to.',
        ],
      },
    ],
  },
  {
    id: 'demo-small-keys',
    ownerId: 'aatish',
    shared: false,
    title: 'The Keeper of Small Keys',
    author: 'Hollis Brandt',
    category: 'Mystery',
    description: 'A locksmith’s apprentice inherits a ring of eleven unlabelled keys — and a city full of doors that seem to be waiting for them.',
    palette: ['#3a2a1e', '#f2e5cb', '#b8894a'],
    motif: 'key',
    chapters: [
      {
        title: 'Eleven Keys',
        paras: [
          'When old Mr. Quell died, he left his shop to his nephew, his tools to the guild, and to his apprentice, Ada Lorne, a ring of eleven small brass keys and a note that said only: They know where they belong. Let them show you.',
          'The keys were no longer than her little finger. None of them had labels. Each was worn smooth in a slightly different place, the way stairs wear smooth where people tend to step.',
          'Ada hung the ring on a nail above her workbench and tried to forget about it. She had a living to make and doors to fit and a landlady who did not accept riddles in place of rent.',
          'But on the third night, she woke to a sound like a tiny bell. The keys were swinging on their nail, gently, though every window was shut — and all of them, every one, was pointing east.',
        ],
      },
      {
        title: 'The First Door',
        paras: [
          'East, it turned out, meant the old covered market, closed for twenty years and boarded up behind a fence that everyone walked past without seeing.',
          'Ada slipped through a gap in the fence a little after dawn, the keys warm in her pocket. Inside, the market was a cathedral of dust and pigeon-light. Stalls stood empty under the iron roof, their names still painted above them: Fishmonger. Florist. Clocks & Repairs.',
          'The keys tugged her, very slightly, towards the clock stall.',
          'At the back of it was a small door no taller than her shoulder, painted the same green as the wall so that you would never notice it unless you were looking. It had a keyhole the size of a grain of rice.',
          'Ada took out the ring. One key, the smallest, was warmer than the rest.',
          'It turned as easily as a page.',
        ],
      },
      {
        title: 'What Was Inside',
        paras: [
          'Behind the little door was a cupboard, and in the cupboard was a clock — a plain wooden clock with a white face — and pinned beneath it, a letter in Mr. Quell’s handwriting.',
          'Ada, it said. This clock belonged to the woman who kept this stall. She stopped it the day the market closed, because she said time here was finished. She was wrong. Time is never finished; it only waits for someone to wind it again. There are ten more doors. Each one is a thing someone set down and couldn’t pick up. I was too old to finish the round. I think you will not be.',
          'Ada wound the clock. It began, at once, to tick — a small, steady, determined sound in the enormous quiet of the market.',
          'And on the ring in her pocket, the ten remaining keys swung, very slightly, north.',
        ],
      },
    ],
  },
];

function chapterHtml(ch: DemoChapter, i: number): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const leadIn = (p: string) => {
    // The first five words get small caps, like a printed chapter opening.
    const m = p.match(/^((?:\S+\s+){1,5})/);
    return m ? `<span class="lead-in">${esc(m[1])}</span>${esc(p.slice(m[1].length))}` : esc(p);
  };
  const paras = ch.paras.map((p, j) => (j === 0 ? `<p class="first">${leadIn(p)}</p>` : `<p>${esc(p)}</p>`)).join('');
  return `<header class="chapter-head"><span class="chapter-num">Chapter ${NUMBERS[i] ?? i + 1}</span><h2>${esc(ch.title)}</h2><div class="ornament" aria-hidden="true">❦</div></header>${paras}`;
}

export const DEMO_IDS = DEMO.map((d) => d.id);

export function demoBookRecords(now = Date.now()): Book[] {
  return DEMO.map((d, i) => ({
    id: d.id,
    ownerId: d.ownerId,
    shared: d.shared,
    title: d.title,
    author: d.author,
    category: d.category,
    description: d.description,
    format: 'demo' as const,
    addedAt: now - (DEMO.length - i) * 86400000 * 3,
    cover: { kind: 'generated' as const, palette: d.palette, motif: d.motif },
    isDemo: true,
  }));
}

export function openDemoBook(id: string): FlowDocument {
  const d = DEMO.find((b) => b.id === id);
  if (!d) throw new Error('This demo book is no longer available.');
  const sections = d.chapters.map((ch, i) => ({ html: chapterHtml(ch, i), title: `Chapter ${i + 1} · ${ch.title}` }));
  return {
    kind: 'flow',
    sections,
    toc: d.chapters.map((ch, i) => ({ label: ch.title, section: i, depth: 0 })),
    resolveLink: () => undefined,
    dispose: () => {},
  };
}

/** Initial reading states so the demo looks lived-in. */
export const DEMO_STATES: { userId: UserId; bookId: string; status: 'reading' | 'finished' | 'want'; section: number; fraction: number; progress: number; favourite?: boolean }[] = [
  { userId: 'aatish', bookId: 'demo-lamplighter', status: 'reading', section: 1, fraction: 0.72, progress: 0.43 },
  { userId: 'aatish', bookId: 'demo-paper-moon', status: 'finished', section: 2, fraction: 1, progress: 1, favourite: true },
  { userId: 'aatish', bookId: 'demo-small-keys', status: 'want', section: 0, fraction: 0, progress: 0 },
  { userId: 'nishi', bookId: 'demo-sea-house', status: 'reading', section: 1, fraction: 0.5, progress: 0.38 },
  { userId: 'nishi', bookId: 'demo-fox-moon', status: 'finished', section: 2, fraction: 1, progress: 1, favourite: true },
  { userId: 'nishi', bookId: 'demo-lamplighter', status: 'want', section: 0, fraction: 0, progress: 0 },
];
