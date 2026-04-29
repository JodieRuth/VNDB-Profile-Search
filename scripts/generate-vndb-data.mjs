import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dbRoot = join(root, '.tmp-vndb-dump', 'extract', 'db');
const outRoot = join(root, 'public', 'data');

const bool = (value) => value === 't';
const nil = (value) => value === '\\N' || value === undefined ? null : value;
const num = (value) => value === '\\N' || value === undefined || value === '' ? null : Number(value);
const stripPrefix = (id) => Number(String(id).replace(/^[a-z]+/, ''));
const b64 = (value) => Buffer.from(value ?? '', 'utf8').toString('base64');
const fromB64 = (value) => Buffer.from(value ?? '', 'base64').toString('utf8');
const encodedText = (value) => b64(value ?? '');
const formatUtc8Date = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second}`;
};
const movedMetaTranslations = { tags: new Set(), traits: new Set() };
const movedDescriptionTranslations = { tags: new Set(), traits: new Set() };

const decodedTranslationValue = (entry, key) => {
  const value = entry?.[key];
  if (!value) return '';
  return entry?.[`${key}Encoded`] ? fromB64(value) : value;
};
const encodeTranslationEntry = (entry, keys) => {
  for (const key of keys) {
    if (!entry[key]) continue;
    entry[key] = b64(decodedTranslationValue(entry, key));
    entry[`${key}Encoded`] = true;
  }
};
const cleanDescription = (value) => (value ?? '')
  .replace(/\[url=[^\]]+\]([\s\S]*?)\[\/url\]/gi, '$1')
  .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '$1')
  .replace(/\[\/?[a-z][a-z0-9]*(?:=[^\]]*)?\]/gi, '')
  .replace(/\r\n/g, '\n')
  .trim();
const translationPath = join(outRoot, 'vndb-meta-translations.json');
const metaTranslations = existsSync(translationPath) ? JSON.parse(readFileSync(translationPath, 'utf8')) : { tags: {}, traits: {} };
const descriptionTranslationPath = join(outRoot, 'vndb-meta-description-translations.json');
const metaDescriptionTranslations = existsSync(descriptionTranslationPath) ? JSON.parse(readFileSync(descriptionTranslationPath, 'utf8')) : { tags: {}, traits: {} };
metaTranslations.tags ??= {};
metaTranslations.traits ??= {};
metaDescriptionTranslations.tags ??= {};
metaDescriptionTranslations.traits ??= {};
let metaTranslationsChanged = false;
let descriptionTranslationsChanged = false;

const orderedTranslationEntry = (entry, metadataKeys = []) => {
  const result = {};
  for (const key of metadataKeys) {
    if (Object.hasOwn(entry, key)) result[key] = entry[key];
  }
  for (const key of ['en', 'zh', 'ja', 'enEncoded', 'zhEncoded', 'jaEncoded']) {
    if (Object.hasOwn(entry, key)) result[key] = entry[key];
  }
  for (const [key, value] of Object.entries(entry)) {
    if (!Object.hasOwn(result, key)) result[key] = value;
  }
  return result;
};

const normalizeMetaTranslationEntry = (kind, entry) => orderedTranslationEntry(entry, kind === 'tags' ? ['vndbId', 'category', 'sexual'] : ['vndbId', 'group', 'sexual']);
const normalizeDescriptionTranslationEntry = (entry) => orderedTranslationEntry(entry);

for (const [kind, group] of Object.entries(metaTranslations)) {
  for (const [key, entry] of Object.entries(group)) {
    encodeTranslationEntry(entry, ['en', 'zh', 'ja']);
    group[key] = normalizeMetaTranslationEntry(kind, entry);
  }
}
for (const group of [metaDescriptionTranslations.tags, metaDescriptionTranslations.traits]) {
  for (const [key, entry] of Object.entries(group)) {
    encodeTranslationEntry(entry, ['en', 'zh', 'ja']);
    group[key] = normalizeDescriptionTranslationEntry(entry);
  }
}
metaTranslationsChanged = true;
descriptionTranslationsChanged = true;

function ensureMetaTranslation(kind, id, fields) {
  const key = String(id);
  const existing = metaTranslations[kind][key];
  const metadata = kind === 'tags'
    ? { vndbId: fields.vndbId, category: fields.category, sexual: fields.sexual }
    : { vndbId: fields.vndbId, group: fields.group, sexual: fields.sexual };
  if (existing) {
    const previousEn = decodedTranslationValue(existing, 'en');
    if (previousEn !== fields.en) {
      delete metaTranslations[kind][key];
      metaTranslations[kind][key] = normalizeMetaTranslationEntry(kind, { ...metadata, en: encodedText(fields.en), zh: '', ja: '', enEncoded: true });
      movedMetaTranslations[kind].add(key);
      metaTranslationsChanged = true;
      return;
    }
    Object.assign(existing, metadata);
    metaTranslations[kind][key] = normalizeMetaTranslationEntry(kind, existing);
    return;
  }
  metaTranslations[kind][key] = normalizeMetaTranslationEntry(kind, { ...metadata, en: encodedText(fields.en), zh: '', ja: '', enEncoded: true });
  movedMetaTranslations[kind].add(key);
  metaTranslationsChanged = true;
}

function ensureDescriptionTranslation(kind, id, description) {
  const key = String(id);
  const en = cleanDescription(description);
  const existing = metaDescriptionTranslations[kind][key];
  if (existing) {
    if (cleanDescription(decodedTranslationValue(existing, 'en')) !== en) {
      delete metaDescriptionTranslations[kind][key];
      metaDescriptionTranslations[kind][key] = normalizeDescriptionTranslationEntry({ en: encodedText(en), zh: '', ja: '', enEncoded: true });
      movedDescriptionTranslations[kind].add(key);
      descriptionTranslationsChanged = true;
      return;
    }
    metaDescriptionTranslations[kind][key] = normalizeDescriptionTranslationEntry(existing);
    return;
  }
  metaDescriptionTranslations[kind][key] = normalizeDescriptionTranslationEntry({ en: encodedText(en), zh: '', ja: '', enEncoded: true });
  movedDescriptionTranslations[kind].add(key);
  descriptionTranslationsChanged = true;
}

const stringifyIndentedJson = (value, indent) => JSON.stringify(value, null, 2).split('\n').map((line, index) => index === 0 ? line : `${indent}${line}`).join('\n');
const stringifyTranslationGroup = (group, movedKeys, indent) => {
  const entries = Object.entries(group);
  const orderedEntries = [
    ...entries.filter(([key]) => !movedKeys.has(key)),
    ...entries.filter(([key]) => movedKeys.has(key))
  ];
  if (!orderedEntries.length) return '{}';
  const lines = ['{'];
  orderedEntries.forEach(([key, value], index) => {
    const comma = index === orderedEntries.length - 1 ? '' : ',';
    lines.push(`${indent}"${key}": ${stringifyIndentedJson(value, indent)}${comma}`);
  });
  lines.push(`${indent.slice(0, -2)}}`);
  return lines.join('\n');
};
const stringifyTranslationFile = (value, moved) => `{
  "tags": ${stringifyTranslationGroup(value.tags, moved.tags, '    ')},
  "traits": ${stringifyTranslationGroup(value.traits, moved.traits, '    ')}
}\n`;

function saveTranslationPlaceholders() {
  if (metaTranslationsChanged) writeFileSync(translationPath, stringifyTranslationFile(metaTranslations, movedMetaTranslations), 'utf8');
  if (descriptionTranslationsChanged) writeFileSync(descriptionTranslationPath, stringifyTranslationFile(metaDescriptionTranslations, movedDescriptionTranslations), 'utf8');
}

function translatedMetaFields(kind, id) {
  const translated = metaTranslations[kind]?.[id];
  if (!translated) return {};
  const result = {};
  const zh = decodedTranslationValue(translated, 'zh');
  const ja = decodedTranslationValue(translated, 'ja');
  if (zh) {
    result.nameZh = encodedText(zh);
    result.nameZhEncoded = true;
  }
  if (ja) {
    result.nameJa = encodedText(ja);
    result.nameJaEncoded = true;
  }
  return result;
}

function translatedDescriptionFields(kind, id) {
  const translated = metaDescriptionTranslations[kind]?.[id];
  if (!translated) return {};
  const result = {};
  const zh = cleanDescription(decodedTranslationValue(translated, 'zh'));
  const ja = cleanDescription(decodedTranslationValue(translated, 'ja'));
  if (zh) {
    result.descriptionZh = encodedText(zh);
    result.descriptionZhEncoded = true;
  }
  if (ja) {
    result.descriptionJa = encodedText(ja);
    result.descriptionJaEncoded = true;
  }
  return result;
}

const metaOverrides = {
  traits: {
    1038: {
      name: 'Taiwanese',
      alias: '',
      description: 'This character is from Taiwan, China.\n\nThis trait refers to characters associated with Taiwan, China, including characters whose cultural identity, background, or origin is connected with the Taiwan region of China.'
    }
  }
};

function metaOverride(kind, id) {
  return metaOverrides[kind]?.[id] ?? {};
}

function decodeCopyValue(value) {
  if (value === '\\N') return null;
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    i += 1;
    const next = value[i];
    if (next === 'N') return null;
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next === 'b') out += '\b';
    else if (next === 'f') out += '\f';
    else if (next === '\\') out += '\\';
    else out += next ?? '';
  }
  return out;
}

function splitCopyLine(line) {
  const values = [];
  let current = '';
  let escaping = false;
  for (const ch of line) {
    if (escaping) {
      current += `\\${ch}`;
      escaping = false;
      continue;
    }
    if (ch === '\\') {
      escaping = true;
      continue;
    }
    if (ch === '\t') {
      values.push(decodeCopyValue(current));
      current = '';
      continue;
    }
    current += ch;
  }
  if (escaping) current += '\\';
  values.push(decodeCopyValue(current));
  return values;
}

async function readHeader(name) {
  const text = await readFile(join(dbRoot, `${name}.header`), 'utf8');
  return text.trimEnd().split('\t');
}

async function scanTable(name, onRow) {
  const header = await readHeader(name);
  const rl = createInterface({ input: createReadStream(join(dbRoot, name), { encoding: 'utf8' }), crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    const values = splitCopyLine(line);
    const row = Object.create(null);
    for (let i = 0; i < header.length; i += 1) row[header[i]] = values[i] ?? null;
    count += 1;
    await onRow(row, count);
  }
  return count;
}

function pickDisplayTitle(titles) {
  if (!titles?.length) return { main: null, english: null };
  const nonEnglishOfficial = titles.find((title) => title.lang !== 'en' && title.official);
  const nonEnglish = titles.find((title) => title.lang !== 'en');
  const english = titles.find((title) => title.lang === 'en') ?? null;
  const official = titles.find((title) => title.official);
  return { main: nonEnglishOfficial ?? nonEnglish ?? english ?? official ?? titles[0], english };
}

function pickDisplayName(names) {
  if (!names?.length) return { main: null, english: null };
  const nonEnglish = names.find((name) => name.lang !== 'en');
  const english = names.find((name) => name.lang === 'en') ?? null;
  return { main: nonEnglish ?? english ?? names[0], english };
}

function displaySubtitle(main, english, titleKey, latinKey) {
  if (!main) return null;
  const candidates = [];
  if (main[latinKey] && main[latinKey] !== main[titleKey]) candidates.push(main[latinKey]);
  if (english && english !== main) candidates.push(english[titleKey], english[latinKey]);
  return candidates.find((value) => value && value !== main[titleKey]) ?? null;
}

function textForSearch(...parts) {
  return parts.filter(Boolean).join(' ').toLocaleLowerCase();
}

function scoreFromVn(vn) {
  const rating = vn.rating ?? 0;
  const votes = vn.votes ?? 0;
  return rating * Math.log10(Math.max(10, votes));
}

function addUniqueProducer(list, producer) {
  if (!producer || list.some((item) => item.id === producer.id)) return;
  list.push(producer);
}

function encodeProducer(producer) {
  return {
    ...producer,
    name: encodedText(producer.name),
    nameEncoded: true,
    original: producer.original ? encodedText(producer.original) : null,
    originalEncoded: Boolean(producer.original)
  };
}

function collectDescendants(parentMap, roots) {
  const blocked = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, parents] of parentMap) {
      if (!blocked.has(id) && parents.some((parent) => blocked.has(parent))) {
        blocked.add(id);
        changed = true;
      }
    }
  }
  return blocked;
}

console.log('读取 VN 基础数据');
const vnMap = new Map();
await scanTable('vn', (row) => {
  const votes = num(row.c_votecount) ?? 0;
  const ratingRaw = num(row.c_rating);
  const averageRaw = num(row.c_average);
  const id = stripPrefix(row.id);
  vnMap.set(id, {
    id,
    image: nil(row.c_image) ?? nil(row.image),
    olang: row.olang,
    votes,
    rating: ratingRaw === null ? 0 : ratingRaw / 10,
    average: (averageRaw ?? ratingRaw ?? 0) / 10,
    aliases: nil(row.alias) ?? '',
    titles: [],
    tags: [],
    relations: [],
    developers: [],
    publishers: []
  });
});

console.log('读取 VN 标题');
await scanTable('vn_titles', (row) => {
  const id = stripPrefix(row.id);
  const vn = vnMap.get(id);
  if (!vn) return;
  vn.titles.push({ lang: row.lang, official: bool(row.official), title: row.title, latin: nil(row.latin) });
});

console.log('读取 tag 元数据');
const tagMeta = new Map();
const forcedSexualTagIds = new Set([23, 3247]);

await scanTable('tags', (row) => {
  const id = stripPrefix(row.id);
  const override = metaOverride('tags', id);
  const sexual = row.cat === 'ero' || forcedSexualTagIds.has(id);
  const name = override.name ?? row.name;
  const alias = override.alias ?? nil(row.alias) ?? '';
  const description = cleanDescription(override.description ?? nil(row.description) ?? '');
  ensureMetaTranslation('tags', id, { vndbId: row.id, category: row.cat, sexual, en: name });
  ensureDescriptionTranslation('tags', id, description);
  tagMeta.set(id, {
    id,
    cat: row.cat,
    defaultspoil: num(row.defaultspoil) ?? 0,
    sexual,
    tech: row.cat === 'tech',
    searchable: bool(row.searchable),
    applicable: bool(row.applicable),
    name: encodedText(name),
    nameEncoded: true,
    ...translatedMetaFields('tags', id),
    alias: encodedText(alias),
    aliasEncoded: true,
    description: encodedText(description),
    descriptionEncoded: true,
    ...translatedDescriptionFields('tags', id)
  });
});

console.log('构建 VN tag 屏蔽子树');
const tagParents = new Map();
await scanTable('tags_parents', (row) => {
  const id = stripPrefix(row.id);
  const parent = stripPrefix(row.parent);
  const parents = tagParents.get(id) ?? [];
  parents.push(parent);
  tagParents.set(id, parents);
});
for (const [id, parents] of tagParents) {
  const meta = tagMeta.get(id);
  if (meta) meta.parents = parents;
}
const blockedTagIds = collectDescendants(tagParents, [20, 305]);
for (const id of blockedTagIds) {
  const meta = tagMeta.get(id);
  if (meta) meta.blocked = true;
}
console.log(`屏蔽 Character/Scene tag 子树 ${blockedTagIds.size} 个`);

console.log('聚合 VN tags');
const vnTagAgg = new Map();
await scanTable('tags_vn', (row) => {
  if (row.ignore === 't') return;
  const vid = stripPrefix(row.vid);
  if (!vnMap.has(vid)) return;
  const tid = stripPrefix(row.tag);
  const meta = tagMeta.get(tid);
  if (!meta) return;
  const vote = num(row.vote) ?? 0;
  if (vote <= 0) return;
  const key = `${vid}:${tid}`;
  const agg = vnTagAgg.get(key) ?? { sum: 0, count: 0, spoiler: 0, lie: false };
  agg.sum += vote;
  agg.count += 1;
  agg.spoiler = Math.max(agg.spoiler, num(row.spoiler) ?? 0);
  agg.lie ||= row.lie === 't';
  vnTagAgg.set(key, agg);
});
for (const [key, agg] of vnTagAgg) {
  const [vidText, tidText] = key.split(':');
  const vn = vnMap.get(Number(vidText));
  if (!vn) continue;
  const rating = agg.sum / agg.count;
  vn.tags.push([Number(tidText), Number(rating.toFixed(2)), agg.spoiler, agg.lie ? 1 : 0]);
}
for (const vn of vnMap.values()) {
  vn.tags.sort((a, b) => b[1] - a[1]);
}

console.log('读取 VN 关系');
await scanTable('vn_relations', (row) => {
  const id = stripPrefix(row.id);
  const target = stripPrefix(row.vid);
  const vn = vnMap.get(id);
  if (!vn || !vnMap.has(target)) return;
  vn.relations.push([target, row.relation, bool(row.official) ? 1 : 0]);
});

console.log('读取会社信息');
const producerMap = new Map();
await scanTable('producers', (row) => {
  const id = stripPrefix(row.id);
  producerMap.set(id, {
    id,
    name: nil(row.latin) ?? row.name,
    original: row.name,
    type: row.type,
    lang: row.lang
  });
});
const releaseToVns = new Map();
await scanTable('releases_vn', (row) => {
  const vid = stripPrefix(row.vid);
  if (!vnMap.has(vid)) return;
  const rid = stripPrefix(row.id);
  const list = releaseToVns.get(rid) ?? [];
  list.push(vid);
  releaseToVns.set(rid, list);
});
await scanTable('releases_producers', (row) => {
  const rid = stripPrefix(row.id);
  const vids = releaseToVns.get(rid);
  if (!vids) return;
  const producer = producerMap.get(stripPrefix(row.pid));
  if (!producer) return;
  for (const vid of vids) {
    const vn = vnMap.get(vid);
    if (!vn) continue;
    if (bool(row.developer)) addUniqueProducer(vn.developers, producer);
    if (bool(row.publisher)) addUniqueProducer(vn.publishers, producer);
  }
});

console.log('读取角色基础数据');
const charMap = new Map();
await scanTable('chars', (row) => {
  const id = stripPrefix(row.id);
  charMap.set(id, {
    id,
    image: nil(row.image),
    sex: nil(row.sex),
    gender: nil(row.gender),
    blood: nil(row.bloodt),
    bust: num(row.s_bust),
    waist: num(row.s_waist),
    hip: num(row.s_hip),
    birthday: nil(row.birthday),
    names: [],
    aliases: [],
    traits: [],
    vns: [],
    vnScore: 0
  });
});

console.log('读取角色所属 VN');
await scanTable('chars_vns', (row) => {
  const cid = stripPrefix(row.id);
  const vid = stripPrefix(row.vid);
  const character = charMap.get(cid);
  const vn = vnMap.get(vid);
  if (!character || !vn) return;
  const roleWeight = row.role === 'main' ? 1.2 : row.role === 'primary' ? 1.1 : row.role === 'side' ? 0.85 : 0.6;
  character.vnScore = Math.max(character.vnScore, scoreFromVn(vn) * roleWeight);
  character.vns.push([vid, row.role, num(row.spoil) ?? 0]);
});

console.log('读取角色名称');
await scanTable('chars_names', (row) => {
  const id = stripPrefix(row.id);
  const character = charMap.get(id);
  if (!character) return;
  character.names.push({ lang: row.lang, name: row.name, latin: nil(row.latin) });
});
await scanTable('chars_alias', (row) => {
  const id = stripPrefix(row.id);
  const character = charMap.get(id);
  if (!character) return;
  character.aliases.push(nil(row.latin) ?? row.name);
});

console.log('读取 trait 元数据');
const traitMeta = new Map();
const forcedSexualTraitIds = new Set([43, 1625, 3476, 3787]);

await scanTable('traits', (row) => {
  const id = stripPrefix(row.id);
  const override = metaOverride('traits', id);
  const sexual = bool(row.sexual) || forcedSexualTraitIds.has(id);
  const name = override.name ?? row.name;
  const alias = override.alias ?? nil(row.alias) ?? '';
  const description = cleanDescription(override.description ?? nil(row.description) ?? '');
  ensureMetaTranslation('traits', id, { vndbId: row.id, group: row.gid ? stripPrefix(row.gid) : null, sexual, en: name });
  ensureDescriptionTranslation('traits', id, description);
  traitMeta.set(id, {
    id,
    group: row.gid ? stripPrefix(row.gid) : null,
    defaultspoil: num(row.defaultspoil) ?? 0,
    sexual,
    searchable: bool(row.searchable),
    applicable: bool(row.applicable),
    name: encodedText(name),
    nameEncoded: true,
    ...translatedMetaFields('traits', id),
    alias: encodedText(alias),
    aliasEncoded: true,
    description: encodedText(description),
    descriptionEncoded: true,
    ...translatedDescriptionFields('traits', id)
  });
});

console.log('读取 trait 父级关系');
await scanTable('traits_parents', (row) => {
  const id = stripPrefix(row.id);
  const parent = stripPrefix(row.parent);
  const meta = traitMeta.get(id);
  if (!meta) return;
  meta.parents ??= [];
  meta.parents.push(parent);
});

console.log('读取角色 traits');
await scanTable('chars_traits', (row) => {
  const cid = stripPrefix(row.id);
  const character = charMap.get(cid);
  if (!character) return;
  const tid = stripPrefix(row.tid);
  if (!traitMeta.has(tid)) return;
  character.traits.push([tid, num(row.spoil) ?? 0, row.lie === 't' ? 1 : 0]);
});
saveTranslationPlaceholders();

const vns = [...vnMap.values()].map((vn) => {
  const display = pickDisplayTitle(vn.titles);
  const main = display.main;
  const english = display.english;
  const title = main?.title ?? main?.latin ?? `v${vn.id}`;
  const subtitle = displaySubtitle(main, english, 'title', 'latin');
  return {
    id: vn.id,
    title: encodedText(title),
    titleEncoded: true,
    original: subtitle ? encodedText(subtitle) : null,
    originalEncoded: Boolean(subtitle),
    olang: vn.olang,
    rating: vn.rating,
    average: vn.average,
    votes: vn.votes,
    image: vn.image,
    aliases: encodedText(vn.aliases),
    aliasesEncoded: true,
    developers: vn.developers.map(encodeProducer),
    publishers: vn.publishers.map(encodeProducer),
    search: encodedText(textForSearch(`v${vn.id}`, title, subtitle, vn.aliases, ...vn.titles.flatMap((title) => [title.title, title.latin]), ...vn.developers.map((producer) => producer.name), ...vn.publishers.map((producer) => producer.name))),
    searchEncoded: true,
    tags: vn.tags,
    relations: vn.relations
  };
});

const characters = [...charMap.values()].map((character) => {
  const display = pickDisplayName(character.names);
  const main = display.main;
  const english = display.english;
  const name = main?.name ?? main?.latin ?? `c${character.id}`;
  const subtitle = displaySubtitle(main, english, 'name', 'latin');
  return {
    id: character.id,
    name: encodedText(name),
    nameEncoded: true,
    original: subtitle ? encodedText(subtitle) : null,
    originalEncoded: Boolean(subtitle),
    image: character.image,
    sex: character.sex,
    gender: character.gender,
    blood: character.blood,
    birthday: character.birthday,
    bust: character.bust,
    waist: character.waist,
    hip: character.hip,
    score: Number(character.vnScore.toFixed(2)),
    search: encodedText(textForSearch(`c${character.id}`, name, subtitle, ...character.names.flatMap((name) => [name.name, name.latin]), ...character.aliases)),
    searchEncoded: true,
    aliases: character.aliases.map(encodedText),
    aliasesEncoded: true,
    vns: character.vns,
    traits: character.traits
  };
});

function stringifyIndented(value, indent) {
  return JSON.stringify(value, null, 2).split('\n').map((line, index) => index === 0 ? line : `${indent}${line}`).join('\n');
}

function stringifyPayload(payload) {
  const lineArrayKeys = new Set(['vns', 'characters', 'tags', 'traits']);
  const entries = Object.entries(payload);
  const lines = ['{'];
  entries.forEach(([key, value], entryIndex) => {
    const entryComma = entryIndex === entries.length - 1 ? '' : ',';
    if (Array.isArray(value) && lineArrayKeys.has(key)) {
      lines.push(`  "${key}": [`);
      value.forEach((item, itemIndex) => {
        const itemComma = itemIndex === value.length - 1 ? '' : ',';
        lines.push(`    ${JSON.stringify(item)}${itemComma}`);
      });
      lines.push(`  ]${entryComma}`);
      return;
    }
    lines.push(`  "${key}": ${stringifyIndented(value, '  ')}${entryComma}`);
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function cleanOldCompressedData(keepFileName) {
  for (const fileName of readdirSync(outRoot)) {
    if (!/^vndb-prototype(?:\.[0-9a-f]{16})?\.json\.gz$/u.test(fileName) || fileName === keepFileName) continue;
    rmSync(join(outRoot, fileName), { force: true });
  }
}

mkdirSync(outRoot, { recursive: true });
const generatedDate = new Date();
const generatedAt = generatedDate.toISOString();
const buildDateUtc8 = formatUtc8Date(generatedDate);
const payload = {
  generatedAt,
  buildDateUtc8,
  source: 'VNDB near-complete database dump, complete local export',
  limits: {},
  stats: { vns: vns.length, characters: characters.length, tags: tagMeta.size, traits: traitMeta.size, blockedTags: blockedTagIds.size, producers: producerMap.size },
  vns,
  characters,
  tags: [...tagMeta.values()],
  traits: [...traitMeta.values()]
};
const jsonPayload = stringifyPayload(payload);
const gzipPayload = gzipSync(jsonPayload, { level: 9 });
const gzipHash = createHash('sha256').update(gzipPayload).digest('hex');
const gzipFileName = `vndb-prototype.${gzipHash.slice(0, 16)}.json.gz`;
cleanOldCompressedData(gzipFileName);
const dataPath = join(outRoot, 'vndb-prototype.json');
const hashedGzipPath = join(outRoot, gzipFileName);
const manifestPath = join(outRoot, 'manifest.json');
const manifest = {
  generatedAt: payload.generatedAt,
  buildDateUtc8: payload.buildDateUtc8,
  dataPath: `./data/${gzipFileName}`,
  sha256: gzipHash,
  size: gzipPayload.length,
  stats: payload.stats
};
writeFileSync(dataPath, jsonPayload);
writeFileSync(hashedGzipPath, gzipPayload);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(payload.stats);
console.log(`写入 ${dataPath}`);
console.log(`写入 ${hashedGzipPath}`);
console.log(`写入 ${manifestPath}`);
