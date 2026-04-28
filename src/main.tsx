import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import './styles.css';

type Pair = [number, number, number, number];
type TraitPair = [number, number, number];
type VnRelation = [number, string, number];
type Producer = { id: number; name: string; nameEncoded?: boolean; original: string | null; originalEncoded?: boolean; type: string; lang: string };
type Vn = {
  id: number;
  title: string;
  titleEncoded?: boolean;
  original: string | null;
  originalEncoded?: boolean;
  olang: string | null;
  rating: number;
  average: number;
  votes: number;
  image: string | null;
  aliases: string;
  aliasesEncoded?: boolean;
  developers: Producer[];
  publishers: Producer[];
  search: string;
  searchEncoded?: boolean;
  tags: Pair[];
  relations: VnRelation[];
};
type Character = {
  id: number;
  name: string;
  nameEncoded?: boolean;
  original: string | null;
  originalEncoded?: boolean;
  image: string | null;
  sex: string | null;
  gender: string | null;
  blood: string | null;
  birthday: string | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  score: number;
  search: string;
  searchEncoded?: boolean;
  aliases: string[];
  aliasesEncoded?: boolean;
  vns: [number, string, number][];
  traits: TraitPair[];
};
type Meta = {
  id: number;
  cat?: string;
  group?: number | null;
  defaultspoil?: number;
  sexual: boolean;
  tech?: boolean;
  searchable: boolean;
  applicable: boolean;
  name: string;
  nameEncoded: boolean;
  nameZh?: string;
  nameZhEncoded?: boolean;
  nameJa?: string;
  nameJaEncoded?: boolean;
  alias: string;
  aliasEncoded?: boolean;
  description?: string;
  descriptionEncoded?: boolean;
  descriptionZh?: string;
  descriptionZhEncoded?: boolean;
  descriptionJa?: string;
  descriptionJaEncoded?: boolean;
  parents?: number[];
  blocked?: boolean;
};
type Data = {
  generatedAt: string;
  source: string;
  limits: Record<string, number>;
  stats: Record<string, number>;
  vns: Vn[];
  characters: Character[];
  tags: Meta[];
  traits: Meta[];
};
type Detail = {
  imageUrl?: string | null;
  description?: string | null;
  developers?: Producer[];
  loading?: boolean;
  error?: string | null;
};
type QueuedDetailRequest = {
  key: string;
  run: () => Promise<void>;
  fail: (reason: unknown) => void;
  attempts: number;
};
type Mode = 'vn' | 'character' | 'tag';
type MetaLanguage = 'zh' | 'ja' | 'origin';
type UiLanguage = 'zh' | 'ja' | 'en';
type ResultSort = 'relevance' | 'rating' | 'votes' | 'title' | 'confidence';
type SortDirection = 'desc' | 'asc';
type CharacterRoleFilter = { primary: boolean; main: boolean; side: boolean; appears: boolean };
type Recommendation<T> = T & { similarity: number; overlap: number; priorityMatched: number; priorityTotal: number; priorityConfidence: number };
type MixedTagResult = { vn: Recommendation<Vn>; character: Recommendation<Character>; similarity: number; priorityMatched: number; priorityTotal: number; priorityConfidence: number };
type RecommendationRef = { id: number; similarity: number; overlap: number; priorityMatched: number; priorityTotal: number; priorityConfidence: number };
type MixedTagRef = { vnId: number; characterId: number; similarity: number; priorityMatched: number; priorityTotal: number; priorityConfidence: number };
type WorkerResult = { vnRecommendations: RecommendationRef[]; characterRecommendations: RecommendationRef[]; tagSearchVnResults: RecommendationRef[]; tagSearchCharacterResults: RecommendationRef[]; mixedTagResults: MixedTagRef[] };
type MetaSearchGroup = { selectedId: number; alternatives: Set<number> };

const REPOSITORY_URL = 'https://github.com/JodieRuth/VNDB-Profile-Search';
const README_URL = `${REPOSITORY_URL}#readme`;
const GITHUB_REPO_API = 'https://api.github.com/repos/JodieRuth/VNDB-Profile-Search';
const DATA_GZIP_PATH = './data/vndb-prototype.json.gz';

const UI_TEXT: Record<UiLanguage, Record<string, string>> = {
  zh: {
    source: '基于 VNDB 数据源', themeDark: '切换黑夜模式', themeLight: '切换白天模式', vnMode: 'VN 检索', characterMode: '角色检索', tagMode: '标签检索', showR18: '显示 R18 标签名', allowSpoiler: '允许剧透标签', metaLanguage: 'tag/traits', uiLanguage: '界面', searchVn: '搜索 VN', searchCharacter: '搜索角色', searchLocal: '搜索本地索引', localResults: '本地搜索结果', selectedSamples: '已选择样本', profile: '合成画像', vnRecommendations: '相似 VN 推荐', characterRecommendations: '相似角色推荐', tagResults: 'tag/traits 检索结果', candidates: '候选数量', perPage: '每页', currentPage: '当前第', page: '页', sort: '排序', direction: '方向', minVotes: '最低票数', tagLimit: '搜索前 N 个 tag', traitLimit: '搜索前 N 个 trait', preferAverage: '按关联 VN 平均分加权', roleType: '角色类型', primary: '主角', main: '主要角色', side: '配角', appears: '仅登场', previous: '上一页', next: '下一页', previousItem: '上一个', nextItem: '下一个', loadPage: '载入当前页详情', choosePage: '请选择排序与分页后载入当前页详情。', license: 'VNDB 数据遵循 VNDB Data License（Open Database License / Database Contents License）；图片与外部详情仍以 VNDB 原站记录为准。', relevance: '相关值', confidence: '置信度', rating: 'VN rating', votes: '投票数', title: '标题', desc: '上到下', asc: '下到上', clear: '清空', tagPanelTitle: 'VN tag', traitPanelTitle: '角色 traits', tagPanelDesc: '选择作品 tag；技术 tag 和 Character/Scene tag 只有被选中时才参与检索。', traitPanelDesc: '选择角色 trait；与 VN tag 同时选择时输出作品 + 角色组合。', tagFilter: '检索 VN tag', traitFilter: '检索角色 trait', showBlockedTags: '显示 Character/Scene 标签', loading: '正在加载本地 VNDB 索引……', computing: '正在计算候选结果……', selectedMeta: '已选中', parentMeta: '父级', projectLinks: '项目链接', readmeTitle: '使用说明', githubStarFallback: 'Star', githubStarHelp: '如果这个项目对你有帮助，请考虑点个 star', statsVn: 'VN', statsCharacters: '角色', statsMeta: '标签数量', statsProducers: '厂商', metaLanguageLabel: 'tag/trait 显示语言', uiLanguageLabel: '界面语言'
  },
  ja: {
    source: 'VNDB データソースに基づく', themeDark: 'ダークモードへ', themeLight: 'ライトモードへ', vnMode: 'VN検索', characterMode: 'キャラクター検索', tagMode: 'タグ検索', showR18: 'R18 タグ名', allowSpoiler: 'ネタバレ許可', metaLanguage: 'tag/traits', uiLanguage: 'UI', searchVn: 'VN を検索', searchCharacter: 'キャラクターを検索', searchLocal: 'ローカル検索', localResults: 'ローカル検索結果', selectedSamples: '選択したサンプル', profile: '合成プロファイル', vnRecommendations: '類似 VN 推薦', characterRecommendations: '類似キャラクター推薦', tagResults: 'tag/traits 検索結果', candidates: '候補数', perPage: '1ページ', currentPage: '現在', page: 'ページ', sort: 'ソート', direction: '方向', minVotes: '最低投票数', tagLimit: '検索 tag 数', traitLimit: '検索 trait 数', preferAverage: '関連 VN 平均点で重み付け', roleType: '役割', primary: '主人公', main: 'メイン', side: 'サブ', appears: '登場のみ', previous: '前へ', next: '次へ', previousItem: '前の項目', nextItem: '次の項目', loadPage: '現在ページの詳細を読み込む', choosePage: 'ソートとページを選択してから詳細を読み込んでください。', license: 'VNDB データは VNDB Data License（Open Database License / Database Contents License）に従います。画像と外部詳細は VNDB 原本を基準とします。', relevance: '関連度', confidence: '信頼度', rating: 'VN rating', votes: '投票数', title: 'タイトル', desc: '降順', asc: '昇順', clear: 'クリア', tagPanelTitle: 'VN tag', traitPanelTitle: 'キャラクター traits', tagPanelDesc: '作品 tag を選択します。technical tag と Character/Scene tag は選択時のみ検索に使われます。', traitPanelDesc: 'キャラクター trait を選択します。VN tag と同時に選ぶと VN + キャラクターの組み合わせを出力します。', tagFilter: 'VN tag を検索', traitFilter: 'キャラクター trait を検索', showBlockedTags: 'Character/Scene tag', loading: 'ローカル VNDB 索引を読み込み中……', computing: '候補を計算中……', selectedMeta: '選択中', parentMeta: '親', projectLinks: 'プロジェクトリンク', readmeTitle: '使い方', githubStarFallback: 'Star', githubStarHelp: 'このプロジェクトが役に立った場合は star をご検討ください', statsVn: 'VN', statsCharacters: 'キャラクター', statsMeta: 'タグ数', statsProducers: '制作者', metaLanguageLabel: 'tag/trait 表示言語', uiLanguageLabel: 'UI 言語'
  },
  en: {
    source: 'Based on VNDB data source', themeDark: 'Switch to dark mode', themeLight: 'Switch to light mode', vnMode: 'VN search', characterMode: 'Character search', tagMode: 'Tag search', showR18: 'R18 names', allowSpoiler: 'Spoilers', metaLanguage: 'tag/traits', uiLanguage: 'UI', searchVn: 'Search VN', searchCharacter: 'Search character', searchLocal: 'Search local index', localResults: 'Local search results', selectedSamples: 'Selected samples', profile: 'Combined profile', vnRecommendations: 'Similar VN recommendations', characterRecommendations: 'Similar character recommendations', tagResults: 'tag/traits results', candidates: 'Candidates', perPage: 'Per page', currentPage: 'Page', page: '', sort: 'Sort', direction: 'Direction', minVotes: 'Minimum votes', tagLimit: 'Top N tags', traitLimit: 'Top N traits', preferAverage: 'Weight by related VN average', roleType: 'Character role', primary: 'Primary', main: 'Main', side: 'Side', appears: 'Appears only', previous: 'Previous', next: 'Next', previousItem: 'Previous item', nextItem: 'Next item', loadPage: 'Load current page details', choosePage: 'Choose sorting and page, then load current page details.', license: 'VNDB data follows the VNDB Data License (Open Database License / Database Contents License); images and external details remain subject to VNDB records.', relevance: 'Relevance', confidence: 'Confidence', rating: 'VN rating', votes: 'Votes', title: 'Title', desc: 'Descending', asc: 'Ascending', clear: 'Clear', tagPanelTitle: 'VN tag', traitPanelTitle: 'Character traits', tagPanelDesc: 'Select VN tags. Technical and Character/Scene tags only participate when selected.', traitPanelDesc: 'Select character traits. Selecting both VN tags and traits outputs VN + character pairs.', tagFilter: 'Search VN tag', traitFilter: 'Search character trait', showBlockedTags: 'Character/Scene tag', loading: 'Loading local VNDB index……', computing: 'Computing candidates……', selectedMeta: 'Selected', parentMeta: 'Parent', projectLinks: 'Project links', readmeTitle: 'Usage guide', githubStarFallback: 'Star', githubStarHelp: 'If this project helps you, please consider giving it a star', statsVn: 'VN', statsCharacters: 'Characters', statsMeta: 'Tags', statsProducers: 'Producers', metaLanguageLabel: 'tag/trait display language', uiLanguageLabel: 'UI language'
  }
};

const text = (value: string) => value.trim().toLocaleLowerCase();
const isVnId = (value: string) => /^v\d+$/i.test(value.trim());
const isCharId = (value: string) => /^c\d+$/i.test(value.trim());
const idOf = (value: string) => Number(value.trim().slice(1));
const vndbUrl = (prefix: 'v' | 'c' | 'g' | 'i' | 'p', id: number) => `https://vndb.org/${prefix}${id}`;
const normalizeTitle = (value: string) => value.toLocaleLowerCase().replace(/[\s\-_~:：!！?？()[\]（）【】「」『』,，.。]/g, '');
const decode = (value: string) => {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return value;
  }
};
const decodeIfNeeded = (value: string | null | undefined, encoded?: boolean) => value && encoded ? decode(value) : value ?? null;

function decodeLocalData(data: Data): Data {
  const decodeProducer = (producer: Producer) => ({
    ...producer,
    name: decodeIfNeeded(producer.name, producer.nameEncoded) ?? producer.name,
    original: decodeIfNeeded(producer.original, producer.originalEncoded)
  });
  const vns = data.vns.map((vn) => ({
    ...vn,
    title: decodeIfNeeded(vn.title, vn.titleEncoded) ?? vn.title,
    original: decodeIfNeeded(vn.original, vn.originalEncoded),
    aliases: decodeIfNeeded(vn.aliases, vn.aliasesEncoded) ?? '',
    developers: vn.developers.map(decodeProducer),
    publishers: vn.publishers.map(decodeProducer),
    search: decodeIfNeeded(vn.search, vn.searchEncoded) ?? vn.search
  }));
  const characters = data.characters.map((character) => ({
    ...character,
    name: decodeIfNeeded(character.name, character.nameEncoded) ?? character.name,
    original: decodeIfNeeded(character.original, character.originalEncoded),
    search: decodeIfNeeded(character.search, character.searchEncoded) ?? character.search,
    aliases: character.aliasesEncoded ? character.aliases.map((alias) => decode(alias)) : character.aliases
  }));
  const decodeMeta = (metaItem: Meta) => ({
    ...metaItem,
    name: decodeIfNeeded(metaItem.name, metaItem.nameEncoded) ?? metaItem.name,
    nameEncoded: false,
    nameZh: decodeIfNeeded(metaItem.nameZh, metaItem.nameZhEncoded) ?? undefined,
    nameZhEncoded: false,
    nameJa: decodeIfNeeded(metaItem.nameJa, metaItem.nameJaEncoded) ?? undefined,
    nameJaEncoded: false,
    alias: decodeIfNeeded(metaItem.alias, metaItem.aliasEncoded ?? metaItem.nameEncoded) ?? '',
    aliasEncoded: false,
    description: decodeIfNeeded(metaItem.description, metaItem.descriptionEncoded) ?? undefined,
    descriptionEncoded: false,
    descriptionZh: decodeIfNeeded(metaItem.descriptionZh, metaItem.descriptionZhEncoded) ?? undefined,
    descriptionZhEncoded: false,
    descriptionJa: decodeIfNeeded(metaItem.descriptionJa, metaItem.descriptionJaEncoded) ?? undefined,
    descriptionJaEncoded: false
  });
  return { ...data, vns, characters, tags: data.tags.map(decodeMeta), traits: data.traits.map(decodeMeta) };
}

async function responseBytes(response: Response, onProgress: (progress: number) => void) {
  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total > 0) onProgress(Math.min(92, Math.round(loaded / total * 92)));
  }
  if (total <= 0) onProgress(92);
  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function loadDataText(url: string, compressed: boolean, signal: AbortSignal, onProgress: (progress: number) => void) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`数据文件读取失败：${response.status}`);
  const bytes = await responseBytes(response, onProgress);
  const contentEncoding = response.headers.get('content-encoding')?.toLocaleLowerCase() ?? '';
  const hasGzipHeader = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!compressed || contentEncoding.includes('gzip') || !hasGzipHeader) return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持 gzip 解压');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function commonPrefixLength(a: string, b: string) {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  let count = 0;
  while (count < left.length && count < right.length && left[count] === right[count]) count += 1;
  return count;
}

function producerIds(vn: Vn) {
  return new Set([...vn.developers, ...vn.publishers].map((producer) => producer.id));
}

function isSameCompanyPrefixDuplicate(candidate: Vn, samples: Vn[]) {
  const candidateProducers = producerIds(candidate);
  if (!candidateProducers.size) return false;
  return samples.some((sample) => {
    const sharedCompany = [...producerIds(sample)].some((id) => candidateProducers.has(id));
    return sharedCompany && commonPrefixLength(candidate.title, sample.title) > 3;
  });
}

function itemSpoiler(item: Pair | TraitPair, kind: 'tag' | 'trait') {
  return kind === 'tag' ? item[2] ?? 0 : item[1] ?? 0;
}

function itemLie(item: Pair | TraitPair, kind: 'tag' | 'trait') {
  return kind === 'tag' ? item[3] ?? 0 : item[2] ?? 0;
}

function canUseMetaForSearch(metaItem: Meta, spoiler: number, includeSpoiler: boolean, allowedSexualIds?: Set<number>) {
  if (metaItem.sexual && !allowedSexualIds?.has(metaItem.id)) return false;
  if (!includeSpoiler && Math.max(spoiler, metaItem.defaultspoil ?? 0) > 0) return false;
  return true;
}

function makeVector(items: Pair[] | TraitPair[], meta: Map<number, Meta>, kind: 'tag' | 'trait', includeSpoiler: boolean, includeParents = false, allowedSexualIds?: Set<number>) {
  const vector = new Map<number, number>();
  for (const item of items) {
    const id = item[0];
    const metaItem = meta.get(id);
    const spoiler = itemSpoiler(item, kind);
    const lie = itemLie(item, kind);
    if (!metaItem || lie) continue;
    if (!canUseMetaForSearch(metaItem, spoiler, includeSpoiler, allowedSexualIds)) continue;
    const weight = kind === 'tag' ? (item[1] ?? 1) : 1;
    vector.set(id, Math.max(vector.get(id) ?? 0, weight));
    if (includeParents) {
      for (const parentId of metaItem.parents ?? []) {
        const parent = meta.get(parentId);
        if (!parent) continue;
        if (!canUseMetaForSearch(parent, 0, includeSpoiler, allowedSexualIds)) continue;
        vector.set(parentId, Math.max(vector.get(parentId) ?? 0, weight * 0.55));
      }
    }
  }
  return vector;
}

function mergeVectors(vectors: Map<number, number>[]) {
  const merged = new Map<number, number>();
  for (const vector of vectors) {
    for (const [id, value] of vector) merged.set(id, (merged.get(id) ?? 0) + value);
  }
  for (const [id, value] of merged) merged.set(id, value / vectors.length);
  return merged;
}

function mergeSpoilers(itemGroups: Array<Pair[] | TraitPair[]>, kind: 'tag' | 'trait', meta: Map<number, Meta>, includeSexual: boolean, includeSpoiler: boolean) {
  const spoilers = new Map<number, number>();
  for (const items of itemGroups) {
    for (const item of items) {
      const metaItem = meta.get(item[0]);
      const spoiler = itemSpoiler(item, kind);
      if (!metaItem || itemLie(item, kind)) continue;
      if (!includeSexual && metaItem.sexual) continue;
      if (!includeSpoiler && spoiler > 0) continue;
      spoilers.set(item[0], Math.max(spoilers.get(item[0]) ?? 0, spoiler));
    }
  }
  return spoilers;
}

function limitVector(vector: Map<number, number>, limit: number) {
  return new Map([...vector.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, limit)));
}

function metaIsAutoIgnored(metaItem?: Meta) {
  return Boolean(metaItem?.tech || metaItem?.blocked);
}

function searchVector(vector: Map<number, number>, limit: number, priorityIds: Set<number>, meta?: Map<number, Meta>) {
  const entries = [...vector.entries()].sort((a, b) => b[1] - a[1]);
  const limited = entries.filter(([id]) => {
    const metaItem = meta?.get(id);
    return !priorityIds.has(id) && !metaIsAutoIgnored(metaItem) && !metaItem?.sexual;
  }).slice(0, Math.max(1, limit));
  const result = new Map<number, number>(limited);
  const topWeight = entries.reduce((max, [, value]) => Math.max(max, value), 1);
  for (const id of priorityIds) {
    if (vector.has(id)) result.set(id, Math.max(vector.get(id) ?? 0, topWeight * 2));
  }
  return result;
}

function omitUnprioritizedSpecialTags(vector: Map<number, number>, meta: Map<number, Meta>, priorityIds: Set<number>) {
  const result = new Map<number, number>();
  for (const [id, value] of vector) {
    if (!metaIsAutoIgnored(meta.get(id)) || priorityIds.has(id)) result.set(id, value);
  }
  return result;
}

function priorityMatch(query: Set<number>, candidate: Map<number, number>) {
  let matched = 0;
  for (const id of query) if (candidate.has(id)) matched += 1;
  return matched;
}

function vectorScore(query: Map<number, number>, candidate: Map<number, number>) {
  let queryWeight = 0;
  let matchedWeight = 0;
  for (const [id, value] of query) {
    queryWeight += value;
    if (candidate.has(id)) matchedWeight += value;
  }
  const coverage = queryWeight ? matchedWeight / queryWeight : 0;
  return coverage * 0.7 + cosine(query, candidate) * 0.3;
}

function expandVectorParents(vector: Map<number, number>, meta: Map<number, Meta>, includeSpoiler: boolean, allowedSexualIds?: Set<number>) {
  const expanded = new Map(vector);
  for (const [id, value] of vector) {
    const metaItem = meta.get(id);
    for (const parentId of metaItem?.parents ?? []) {
      const parent = meta.get(parentId);
      if (!parent) continue;
      if (!canUseMetaForSearch(parent, 0, includeSpoiler, allowedSexualIds)) continue;
      expanded.set(parentId, Math.max(expanded.get(parentId) ?? 0, value * 0.55));
    }
  }
  return expanded;
}

function metaChildrenMap(items: Meta[]) {
  const children = new Map<number, Meta[]>();
  for (const item of items) {
    for (const parentId of item.parents ?? []) {
      const list = children.get(parentId) ?? [];
      list.push(item);
      children.set(parentId, list);
    }
  }
  return children;
}

function metaSearchDescendants(item: Meta, children: Map<number, Meta[]>, includeSexual: boolean, includeSpoiler: boolean, includeBlocked: boolean, path = new Set<number>()) {
  if (path.has(item.id)) return [];
  const nextPath = new Set(path);
  nextPath.add(item.id);
  const result: Meta[] = [];
  for (const child of children.get(item.id) ?? []) {
    if (!includeSexual && child.sexual) continue;
    if (!includeSpoiler && child.defaultspoil && child.defaultspoil > 0) continue;
    if (!includeBlocked && child.blocked) continue;
    result.push(child, ...metaSearchDescendants(child, children, includeSexual, includeSpoiler, includeBlocked, nextPath));
  }
  return result;
}

function metaSearchGroups(selectedIds: Set<number>, items: Meta[], meta: Map<number, Meta>, includeSexual: boolean, includeSpoiler: boolean, includeBlocked = true) {
  const children = metaChildrenMap(items);
  return [...selectedIds].map((selectedId) => {
    const alternatives = new Set<number>([selectedId]);
    const item = meta.get(selectedId);
    const includeSexualDescendants = includeSexual && item?.sexual === true;
    const includeBlockedDescendants = includeBlocked || item?.blocked === true;
    if (item) for (const child of metaSearchDescendants(item, children, includeSexualDescendants, includeSpoiler, includeBlockedDescendants)) alternatives.add(child.id);
    return { selectedId, alternatives };
  });
}

function selectedSexualAlternativeIds(groups: MetaSearchGroup[], meta: Map<number, Meta>) {
  const ids = new Set<number>();
  for (const group of groups) {
    if (!meta.get(group.selectedId)?.sexual) continue;
    for (const id of group.alternatives) ids.add(id);
  }
  return ids;
}

function groupedPriorityMatch(groups: MetaSearchGroup[], candidate: Map<number, number>) {
  let matched = 0;
  for (const group of groups) {
    for (const id of group.alternatives) {
      if (candidate.has(id)) {
        matched += 1;
        break;
      }
    }
  }
  return matched;
}

function groupedMetaScore(groups: MetaSearchGroup[], candidate: Map<number, number>) {
  if (!groups.length) return 0;
  let matched = 0;
  let strength = 0;
  for (const group of groups) {
    let best = 0;
    for (const id of group.alternatives) best = Math.max(best, candidate.get(id) ?? 0);
    if (best > 0) matched += 1;
    strength += Math.min(best / 3, 1);
  }
  return matched / groups.length * 0.82 + strength / groups.length * 0.18;
}

function visibleItems<T extends Pair | TraitPair>(items: T[], meta: Map<number, Meta>, kind: 'tag' | 'trait', includeSexual: boolean, includeSpoiler: boolean, showBlockedTags = true) {
  return items.filter((item) => {
    const metaItem = meta.get(item[0]);
    const spoiler = itemSpoiler(item, kind);
    if (!metaItem) return false;
    if (!includeSexual && metaItem.sexual) return false;
    if (!includeSpoiler && spoiler > 0) return false;
    if (kind === 'tag' && metaItem.blocked && !showBlockedTags) return false;
    return true;
  });
}

function decodedMetaField(value?: string, encoded?: boolean) {
  if (!value) return null;
  return encoded ? decode(value) : value;
}

function metaName(metaItem: Meta, showSexual: boolean, language: MetaLanguage) {
  if (metaItem.sexual && !showSexual) return 'R18 已隐藏';
  if (language === 'zh') {
    return decodedMetaField(metaItem.nameZh, metaItem.nameZhEncoded)
      ?? decodedMetaField(metaItem.nameJa, metaItem.nameJaEncoded)
      ?? decodedMetaField(metaItem.name, metaItem.nameEncoded)
      ?? '';
  }
  if (language === 'ja') {
    return decodedMetaField(metaItem.nameJa, metaItem.nameJaEncoded)
      ?? decodedMetaField(metaItem.nameZh, metaItem.nameZhEncoded)
      ?? decodedMetaField(metaItem.name, metaItem.nameEncoded)
      ?? '';
  }
  return decodedMetaField(metaItem.name, metaItem.nameEncoded) ?? '';
}

function metaEnglishName(metaItem: Meta) {
  return decodedMetaField(metaItem.name, metaItem.nameEncoded) ?? '';
}

function metaTooltip(metaItem: Meta, showSexual: boolean, language: MetaLanguage) {
  if (metaItem.sexual && !showSexual) return 'R18 已隐藏';
  const descriptions = language === 'zh'
    ? [
      decodedMetaField(metaItem.descriptionZh, metaItem.descriptionZhEncoded),
      decodedMetaField(metaItem.descriptionJa, metaItem.descriptionJaEncoded),
      decodedMetaField(metaItem.description, metaItem.descriptionEncoded)
    ]
    : language === 'ja'
      ? [
        decodedMetaField(metaItem.descriptionJa, metaItem.descriptionJaEncoded),
        decodedMetaField(metaItem.descriptionZh, metaItem.descriptionZhEncoded),
        decodedMetaField(metaItem.description, metaItem.descriptionEncoded)
      ]
      : [decodedMetaField(metaItem.description, metaItem.descriptionEncoded)];
  const description = descriptions.find((value) => value?.trim())?.trim();
  if (description) return cleanDescription(description);
  return metaEnglishName(metaItem);
}

function spoilerClass(value: number) {
  return value > 1 ? 'spoilerHigh' : value > 0 ? 'spoilerLow' : '';
}

function traitGroupMeta(metaItem: Meta, meta: Map<number, Meta>) {
  const groupId = metaItem.group ?? metaItem.id;
  return meta.get(groupId) ?? metaItem;
}

function traitGroupLabel(metaItem: Meta, meta: Map<number, Meta>) {
  const group = traitGroupMeta(metaItem, meta);
  const name = metaEnglishName(group);
  const labels: Record<string, string> = {
    Hair: '头发',
    Eyes: '眼睛',
    Body: '身体',
    Clothes: '服饰',
    Items: '物品',
    Personality: '性格',
    Role: '角色定位',
    'Engages in': '行为',
    'Subject of': '对象',
    'Engages in (Sexual)': '性行为',
    'Subject of (Sexual)': '性对象'
  };
  return labels[name] ?? name;
}

function traitGroups(items: TraitPair[], meta: Map<number, Meta>, showSexual: boolean, showSpoiler: boolean) {
  const groups = new Map<string, TraitPair[]>();
  for (const item of visibleItems(items, meta, 'trait', showSexual, showSpoiler)) {
    const metaItem = meta.get(item[0]);
    if (!metaItem) continue;
    const label = traitGroupLabel(metaItem, meta);
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  return [...groups.entries()];
}

function profileTraitGroups(items: [number, number][], meta: Map<number, Meta>, showSexual: boolean) {
  const groups = new Map<string, [number, number][]>() ;
  for (const item of items) {
    const metaItem = meta.get(item[0]);
    if (!metaItem) continue;
    if (!showSexual && metaItem.sexual) continue;
    const label = traitGroupLabel(metaItem, meta);
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  return [...groups.entries()];
}

function compareVnScore(a: Vn, b: Vn) {
  return (b.rating - a.rating) || (b.votes - a.votes) || (b.average - a.average);
}

function vnSearchRank(vn: Vn, query: string) {
  const title = text(vn.title);
  const original = text(vn.original ?? '');
  const aliases = vn.aliases.split('\n').map(text).filter(Boolean);
  if (`v${vn.id}` === query) return 100;
  if (title === query || original === query || aliases.includes(query)) return 90;
  if (title.startsWith(query) || original.startsWith(query) || aliases.some((alias) => alias.startsWith(query))) return 80;
  if (title.includes(query) || original.includes(query) || aliases.some((alias) => alias.includes(query))) return 70;
  if (vn.search.includes(query)) return 10;
  return 0;
}

function compareVnSearchResult(query: string) {
  return (a: Vn, b: Vn) => {
    const rankDiff = vnSearchRank(b, query) - vnSearchRank(a, query);
    return rankDiff || compareVnScore(a, b);
  };
}

function compareCharacterScore(a: Character, b: Character) {
  return b.score - a.score;
}

function priorityBucketedResults<T extends Recommendation<Vn> | Recommendation<Character>>(candidates: T[], total: number, score: (item: T) => number) {
  const sorted = [...candidates].sort((a, b) => score(b) - score(a));
  if (!total) return sorted;
  const result: T[] = [];
  const minimumMatched = total >= 5 ? total - 2 : total >= 3 ? total - 1 : total;
  for (let matched = total; matched >= minimumMatched; matched -= 1) {
    const bucket = sorted.filter((item) => item.priorityMatched === matched);
    if (!bucket.length) continue;
    result.push(...bucket);
  }
  return result;
}

function topRecommendations<T extends Recommendation<Vn> | Recommendation<Character>>(candidates: T[], total: number, score: (item: T) => number) {
  return priorityBucketedResults(candidates, total, score);
}

function topTagMatches<T extends Recommendation<Vn> | Recommendation<Character>>(candidates: T[], total: number, score: (item: T) => number) {
  if (!total) return [];
  return priorityBucketedResults(candidates, total, score);
}

function selectedMetaVector(ids: Set<number>) {
  const vector = new Map<number, number>();
  for (const id of ids) vector.set(id, 2);
  return vector;
}

function characterVnIds(character: Character) {
  return new Set(character.vns.map(([id]) => id));
}

function roleAllowed(role: string, filter: CharacterRoleFilter) {
  if (role === 'primary') return filter.primary;
  if (role === 'main') return filter.main;
  if (role === 'side') return filter.side;
  if (role === 'appears') return filter.appears;
  return filter.appears;
}

function characterHasQualifiedVn(character: Character, vns: Map<number, Vn>, minVotes: number, roleFilter?: CharacterRoleFilter) {
  return character.vns.some(([id, role]) => (vns.get(id)?.votes ?? 0) >= minVotes && (!roleFilter || roleAllowed(role, roleFilter)));
}

function characterRoleFilteredVnIds(character: Character, roleFilter: CharacterRoleFilter) {
  return new Set(character.vns.filter(([, role]) => roleAllowed(role, roleFilter)).map(([id]) => id));
}

function characterAverageForMatchedVns(character: Character, vns: Map<number, Vn>, matchedVnIds: Set<number>) {
  const scores = character.vns
    .filter(([id]) => matchedVnIds.has(id))
    .map(([id]) => vns.get(id)?.average ?? 0)
    .filter((score) => score > 0);
  if (!scores.length) return characterAverageScore(character, vns);
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function characterAverageScore(character: Character, vns: Map<number, Vn>) {
  const scores = character.vns
    .map(([id]) => vns.get(id)?.average ?? 0)
    .filter((score) => score > 0);
  if (!scores.length) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function characterDisplayScore(character: Character, vns: Map<number, Vn>, preferAverage: boolean) {
  if (!preferAverage) return character.score;
  return characterAverageScore(character, vns) * 10 + character.score / 100;
}

function cosine(a: Map<number, number>, b: Map<number, number>) {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (const value of a.values()) aa += value * value;
  for (const value of b.values()) bb += value * value;
  for (const [id, value] of a) dot += value * (b.get(id) ?? 0);
  if (!aa || !bb) return 0;
  return dot / (Math.sqrt(aa) * Math.sqrt(bb));
}

function overlap(a: Map<number, number>, b: Map<number, number>) {
  let count = 0;
  for (const id of a.keys()) if (b.has(id)) count += 1;
  return count;
}

async function vndbPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`https://api.vndb.org/kana${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function fetchVnDetail(id: number): Promise<Detail> {
  const data = await vndbPost<{ results: Array<{ image?: { url?: string | null } | null; description?: string | null; developers?: Array<{ id: string; name: string }> }> }>('/vn', {
    filters: ['id', '=', `v${id}`],
    fields: 'image.url,description,developers.id,developers.name',
    results: 1
  });
  const item = data.results[0];
  return {
    imageUrl: item?.image?.url ?? null,
    description: item?.description ?? null,
    developers: item?.developers?.map((producer) => ({ id: idOf(producer.id), name: producer.name, original: producer.name, type: 'co', lang: '' })) ?? []
  };
}

async function fetchCharacterDetail(id: number): Promise<Detail> {
  const data = await vndbPost<{ results: Array<{ image?: { url?: string | null } | null; description?: string | null }> }>('/character', {
    filters: ['id', '=', `c${id}`],
    fields: 'image.url,description',
    results: 1
  });
  const item = data.results[0];
  return { imageUrl: item?.image?.url ?? null, description: item?.description ?? null };
}

function cleanDescription(value: string, maxLength?: number) {
  const cleaned = value.replace(/\[url=[^\]]+\]/g, '').replace(/\[\/url\]/g, '').replace(/\[[^\]]+\]/g, '').trim();
  if (!maxLength || cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength)}...`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const DETAIL_REQUEST_INTERVAL = 1700;
const DETAIL_RETRY_DELAY = 7000;
const DETAIL_RETRY_LIMIT = 3;
const RESULTS_PER_PAGE = 30;
const LOCAL_SEARCH_RESULTS_PER_PAGE = 8;
const MOBILE_VN_SEARCH_RESULTS_PER_PAGE = 1;

function effectiveMetaCount(items: Meta[]) {
  return items.filter((item) => item.applicable !== false).length;
}

function vnResultScore(vn: Recommendation<Vn>) {
  return vn.similarity * 100 + vn.rating / 10 + Math.log10(vn.votes || 1);
}

function characterResultScore(character: Recommendation<Character>, vns: Map<number, Vn>, preferAverage: boolean) {
  return character.similarity * 100 + (preferAverage ? characterAverageScore(character, vns) / 10 : character.score / 100);
}

function mixedResultScore(result: MixedTagResult, vns: Map<number, Vn>, preferAverage: boolean) {
  return result.similarity * 100 + result.vn.rating / 10 + (preferAverage ? characterAverageForMatchedVns(result.character, vns, new Set([result.vn.id])) / 10 : result.character.score / 100);
}

function itemTitle(item: Vn | Character) {
  return ('title' in item ? item.original || item.title : item.original || item.name).toLocaleLowerCase();
}

function sortNumberByDirection(value: number, direction: SortDirection) {
  return direction === 'desc' ? -value : value;
}

function sortTextByDirection(left: string, right: string, direction: SortDirection) {
  return direction === 'desc' ? right.localeCompare(left) : left.localeCompare(right);
}

function similarityBucket(value: number) {
  if (value >= 0.75) return 5;
  if (value >= 0.6) return 4;
  if (value >= 0.45) return 3;
  if (value >= 0.3) return 2;
  if (value >= 0.15) return 1;
  return 0;
}

function compareSimilarityBucket(a: { similarity: number }, b: { similarity: number }) {
  return similarityBucket(b.similarity) - similarityBucket(a.similarity) || b.similarity - a.similarity;
}

function vnRatingSortScore(vn: Recommendation<Vn>) {
  return vnResultScore(vn) + vn.rating / 20 + Math.log10(vn.votes || 1) / 5;
}

function vnVotesSortScore(vn: Recommendation<Vn>) {
  return vnResultScore(vn) + Math.log10(vn.votes || 1) * 0.7 + vn.rating / 40;
}

function characterMaxVotes(character: Character, vns: Map<number, Vn>) {
  return Math.max(0, ...character.vns.map(([id]) => vns.get(id)?.votes ?? 0));
}

function characterRatingSortScore(character: Recommendation<Character>, vns: Map<number, Vn>, preferAverage: boolean) {
  return characterResultScore(character, vns, preferAverage) + characterAverageScore(character, vns) / 20 + Math.log10(characterMaxVotes(character, vns) || 1) / 5;
}

function characterVotesSortScore(character: Recommendation<Character>, vns: Map<number, Vn>, preferAverage: boolean) {
  return characterResultScore(character, vns, preferAverage) + Math.log10(characterMaxVotes(character, vns) || 1) * 0.7 + characterAverageScore(character, vns) / 40;
}

function confidenceSortScore(item: Recommendation<Vn> | Recommendation<Character>, baseScore: number) {
  if (!item.priorityTotal) return baseScore;
  return baseScore + item.priorityConfidence * 12 + item.priorityMatched * 2 + item.overlap * 0.1;
}

function mixedConfidenceSortScore(result: MixedTagResult, baseScore: number) {
  if (!result.priorityTotal) return baseScore;
  return baseScore + result.priorityMatched / result.priorityTotal * 12 + result.priorityMatched * 2;
}

function sortVnResults(items: Recommendation<Vn>[], sort: ResultSort, direction: SortDirection) {
  return [...items].sort((a, b) => {
    if (sort === 'title') return compareSimilarityBucket(a, b) || sortTextByDirection(itemTitle(a), itemTitle(b), direction) || a.id - b.id;
    const left = sort === 'rating' ? vnRatingSortScore(a) : sort === 'votes' ? vnVotesSortScore(a) : sort === 'confidence' ? confidenceSortScore(a, vnResultScore(a)) : vnResultScore(a);
    const right = sort === 'rating' ? vnRatingSortScore(b) : sort === 'votes' ? vnVotesSortScore(b) : sort === 'confidence' ? confidenceSortScore(b, vnResultScore(b)) : vnResultScore(b);
    return sortNumberByDirection(left - right, direction) || a.id - b.id;
  });
}

function sortCharacterResults(items: Recommendation<Character>[], sort: ResultSort, direction: SortDirection, vns: Map<number, Vn>, preferAverage: boolean) {
  return [...items].sort((a, b) => {
    if (sort === 'title') return compareSimilarityBucket(a, b) || sortTextByDirection(itemTitle(a), itemTitle(b), direction) || a.id - b.id;
    const left = sort === 'rating' ? characterRatingSortScore(a, vns, preferAverage) : sort === 'votes' ? characterVotesSortScore(a, vns, preferAverage) : sort === 'confidence' ? confidenceSortScore(a, characterResultScore(a, vns, preferAverage)) : characterResultScore(a, vns, preferAverage);
    const right = sort === 'rating' ? characterRatingSortScore(b, vns, preferAverage) : sort === 'votes' ? characterVotesSortScore(b, vns, preferAverage) : sort === 'confidence' ? confidenceSortScore(b, characterResultScore(b, vns, preferAverage)) : characterResultScore(b, vns, preferAverage);
    return sortNumberByDirection(left - right, direction) || a.id - b.id;
  });
}

function sortMixedResults(items: MixedTagResult[], sort: ResultSort, direction: SortDirection, vns: Map<number, Vn>, preferAverage: boolean) {
  return [...items].sort((a, b) => {
    if (sort === 'title') return compareSimilarityBucket(a, b) || sortTextByDirection(`${itemTitle(a.vn)} ${itemTitle(a.character)}`, `${itemTitle(b.vn)} ${itemTitle(b.character)}`, direction) || a.character.id - b.character.id;
    const left = sort === 'rating' ? mixedResultScore(a, vns, preferAverage) + a.vn.rating / 20 + Math.log10(a.vn.votes || 1) / 5 : sort === 'votes' ? mixedResultScore(a, vns, preferAverage) + Math.log10(a.vn.votes || 1) * 0.7 + a.vn.rating / 40 : sort === 'confidence' ? mixedConfidenceSortScore(a, mixedResultScore(a, vns, preferAverage)) : mixedResultScore(a, vns, preferAverage);
    const right = sort === 'rating' ? mixedResultScore(b, vns, preferAverage) + b.vn.rating / 20 + Math.log10(b.vn.votes || 1) / 5 : sort === 'votes' ? mixedResultScore(b, vns, preferAverage) + Math.log10(b.vn.votes || 1) * 0.7 + b.vn.rating / 40 : sort === 'confidence' ? mixedConfidenceSortScore(b, mixedResultScore(b, vns, preferAverage)) : mixedResultScore(b, vns, preferAverage);
    return sortNumberByDirection(left - right, direction) || a.character.id - b.character.id;
  });
}

function pageCount(total: number, perPage = RESULTS_PER_PAGE) {
  return Math.max(1, Math.ceil(total / perPage));
}

function pageItems<T>(items: T[], page: number, perPage = RESULTS_PER_PAGE) {
  return items.slice((page - 1) * perPage, page * perPage);
}

function App() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('vn');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedVns, setSelectedVns] = useState<Vn[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([]);
  const [vnDetails, setVnDetails] = useState<Record<number, Detail>>({});
  const [characterDetails, setCharacterDetails] = useState<Record<number, Detail>>({});
  const [recommendationDetails, setRecommendationDetails] = useState<Record<string, Detail>>({});
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showSexual, setShowSexual] = useState(false);
  const [showSpoiler, setShowSpoiler] = useState(false);
  const [showBlockedTags, setShowBlockedTags] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [metaLanguage, setMetaLanguage] = useState<MetaLanguage>('zh');
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('zh');
  const t = UI_TEXT[uiLanguage];
  const [minVotes, setMinVotes] = useState(50);
  const [tagLimit, setTagLimit] = useState(12);
  const [traitLimit, setTraitLimit] = useState(16);
  const [preferCharacterAverage, setPreferCharacterAverage] = useState(false);
  const [tagRoleFilter, setTagRoleFilter] = useState<CharacterRoleFilter>({ primary: true, main: true, side: true, appears: true });
  const [resultSort, setResultSort] = useState<ResultSort>('relevance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [darkMode, setDarkMode] = useState(false);
  const [githubStars, setGithubStars] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [resultPage, setResultPage] = useState(1);
  const [localSearchPage, setLocalSearchPage] = useState(1);
  const [priorityTags, setPriorityTags] = useState<Set<number>>(() => new Set());
  const [priorityTraits, setPriorityTraits] = useState<Set<number>>(() => new Set());
  const [tagSearchTags, setTagSearchTags] = useState<Set<number>>(() => new Set());
  const [tagSearchTraits, setTagSearchTraits] = useState<Set<number>>(() => new Set());
  const detailQueueRef = useRef<QueuedDetailRequest[]>([]);
  const detailQueueVersionRef = useRef(0);
  const detailQueueRunningRef = useRef<number | null>(null);
  const lastDetailRequestAtRef = useRef(0);
  const recommendationDetailVersionRef = useRef(0);
  const recommendationWorkerRef = useRef<Worker | null>(null);
  const recommendationRequestIdRef = useRef(0);
  const localResultsRef = useRef<HTMLDivElement | null>(null);
  const recommendationResultsRef = useRef<HTMLElement | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [workerComputing, setWorkerComputing] = useState(false);
  const [workerResult, setWorkerResult] = useState<WorkerResult>({ vnRecommendations: [], characterRecommendations: [], tagSearchVnResults: [], tagSearchCharacterResults: [], mixedTagResults: [] });

  useEffect(() => {
    document.title = 'VNDB Profile Search';
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL('./computeWorker.ts', import.meta.url), { type: 'module' });
    recommendationWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ type: string; requestId?: number; result?: WorkerResult; error?: string }>) => {
      if (event.data.type === 'ready') {
        setWorkerReady(true);
        return;
      }
      if (event.data.type === 'result' && event.data.requestId === recommendationRequestIdRef.current && event.data.result) {
        setWorkerResult(event.data.result);
        setWorkerComputing(false);
      }
      if (event.data.type === 'error' && event.data.requestId === recommendationRequestIdRef.current) {
        setWorkerComputing(false);
        console.error(event.data.error);
      }
    };
    return () => {
      worker.terminate();
      recommendationWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    fetch(GITHUB_REPO_API)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ stargazers_count?: number }>;
      })
      .then((repo) => setGithubStars(typeof repo.stargazers_count === 'number' ? repo.stargazers_count : null))
      .catch(() => setGithubStars(null));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const updateProgress = (progress: number) => {
      if (!cancelled) setLoadProgress(progress);
    };
    const load = async () => {
      try {
        const textValue = await loadDataText(DATA_GZIP_PATH, true, controller.signal, updateProgress);
        if (cancelled) return;
        setLoadProgress(96);
        const raw = JSON.parse(textValue) as Data;
        if (cancelled) return;
        setData(decodeLocalData(raw));
        setLoadProgress(100);
      } catch (reason) {
        if (!controller.signal.aborted) setError(String(reason));
      }
    };
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    recommendationDetailVersionRef.current += 1;
    detailQueueRef.current = detailQueueRef.current.filter((item) => !item.key.startsWith('recommendation-'));
    setShowRecommendations(false);
    setRecommendationDetails({});
    setResultPage(1);
  }, [mode, selectedVns, selectedCharacters, showSexual, showSpoiler, showBlockedTags, minVotes, tagLimit, traitLimit, preferCharacterAverage, tagRoleFilter, priorityTags, priorityTraits, tagSearchTags, tagSearchTraits]);

  useEffect(() => {
    setResultPage(1);
  }, [resultSort, sortDirection]);

  useEffect(() => {
    setLocalSearchPage(1);
  }, [mode, submittedQuery, selectedVns, selectedCharacters, isMobile]);

  const tagMeta = useMemo(() => new Map(data?.tags.map((tag) => [tag.id, tag]) ?? []), [data]);
  const traitMeta = useMemo(() => new Map(data?.traits.map((trait) => [trait.id, trait]) ?? []), [data]);
  const visibleSexualTagIds = useMemo(() => new Set(data?.tags.filter((tag) => showSexual && tag.sexual).map((tag) => tag.id) ?? []), [data, showSexual]);
  const visibleSexualTraitIds = useMemo(() => new Set(data?.traits.filter((trait) => showSexual && trait.sexual).map((trait) => trait.id) ?? []), [data, showSexual]);
  const vnById = useMemo(() => new Map(data?.vns.map((vn) => [vn.id, vn]) ?? []), [data]);
  const characterById = useMemo(() => new Map(data?.characters.map((character) => [character.id, character]) ?? []), [data]);
  const tagUsageCounts = useMemo(() => searchableMetaUsageCounts(data?.vns ?? [], data?.tags ?? [], tagMeta, 'tags', 'tag', showSexual, showSpoiler, (vn) => (vn.votes ?? 0) >= minVotes), [data, tagMeta, showSexual, showSpoiler, minVotes]);
  const traitUsageCounts = useMemo(() => searchableMetaUsageCounts(data?.characters ?? [], data?.traits ?? [], traitMeta, 'traits', 'trait', showSexual, showSpoiler, (character) => character.vns?.some(([id, role]) => (vnById.get(id)?.votes ?? 0) >= minVotes && roleAllowed(role, tagRoleFilter)) ?? false), [data, traitMeta, showSexual, showSpoiler, vnById, minVotes, tagRoleFilter]);

  const searchResults = useMemo(() => {
    if (!data) return [];
    const q = text(submittedQuery);
    if (!q) return [];
    if (mode === 'vn') {
      const excluded = new Set(selectedVns.map((vn) => vn.id));
      if (isVnId(q)) return data.vns.filter((vn) => vn.id === idOf(q) && !excluded.has(vn.id));
      return data.vns
        .filter((vn) => !excluded.has(vn.id) && vnSearchRank(vn, q) > 0)
        .sort(compareVnSearchResult(q));
    }
    const excluded = new Set(selectedCharacters.map((character) => character.id));
    if (isCharId(q)) return data.characters.filter((character) => character.id === idOf(q) && !excluded.has(character.id));
    const directCharacters = data.characters
      .filter((character) => !excluded.has(character.id) && character.search.includes(q))
      .sort(compareCharacterScore);
    if (directCharacters.length) return directCharacters;
    const matchedVns = data.vns.filter((vn) => vn.search.includes(q)).sort(compareVnScore).slice(0, 30);
    const matchedVnRank = new Map(matchedVns.map((vn, index) => [vn.id, matchedVns.length - index]));
    if (!matchedVnRank.size) return [];
    return data.characters
      .filter((character) => !excluded.has(character.id) && character.vns.some(([id]) => matchedVnRank.has(id)))
      .sort((a, b) => {
        const left = Math.max(0, ...b.vns.map(([id]) => matchedVnRank.get(id) ?? 0)) * 1000 + characterDisplayScore(b, vnById, false);
        const right = Math.max(0, ...a.vns.map(([id]) => matchedVnRank.get(id) ?? 0)) * 1000 + characterDisplayScore(a, vnById, false);
        return left - right;
      });
  }, [data, mode, submittedQuery, vnById, selectedVns, selectedCharacters]);

  const localSearchPerPage = isMobile && mode === 'vn' ? MOBILE_VN_SEARCH_RESULTS_PER_PAGE : LOCAL_SEARCH_RESULTS_PER_PAGE;
  const localSearchPageCount = pageCount(searchResults.length, localSearchPerPage);
  const currentLocalSearchPage = Math.min(localSearchPage, localSearchPageCount);
  const visibleSearchResults = pageItems<Vn | Character>(searchResults as (Vn | Character)[], currentLocalSearchPage, localSearchPerPage);
  const scrollToPanelTop = (target: HTMLElement | null) => target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const changeLocalSearchPage = (page: number) => {
    setLocalSearchPage(Math.min(localSearchPageCount, Math.max(1, page)));
    window.requestAnimationFrame(() => scrollToPanelTop(localResultsRef.current));
  };

  const vnProfile = useMemo(() => {
    if (!selectedVns.length) return new Map<number, number>();
    return mergeVectors(selectedVns.map((vn) => makeVector(vn.tags, tagMeta, 'tag', showSpoiler, false, visibleSexualTagIds)));
  }, [selectedVns, tagMeta, showSpoiler, visibleSexualTagIds]);

  const vnProfileSpoilers = useMemo(() => mergeSpoilers(selectedVns.map((vn) => vn.tags), 'tag', tagMeta, showSexual, showSpoiler), [selectedVns, tagMeta, showSexual, showSpoiler]);

  const characterProfile = useMemo(() => {
    if (!selectedCharacters.length) return new Map<number, number>();
    return mergeVectors(selectedCharacters.map((character) => makeVector(character.traits, traitMeta, 'trait', showSpoiler, false, visibleSexualTraitIds)));
  }, [selectedCharacters, traitMeta, showSpoiler, visibleSexualTraitIds]);

  const characterProfileSpoilers = useMemo(() => mergeSpoilers(selectedCharacters.map((character) => character.traits), 'trait', traitMeta, showSexual, showSpoiler), [selectedCharacters, traitMeta, showSexual, showSpoiler]);

  const activePriorityTags = useMemo(() => new Set([...priorityTags].filter((id) => vnProfile.has(id))), [priorityTags, vnProfile]);
  const activePriorityTraits = useMemo(() => new Set([...priorityTraits].filter((id) => characterProfile.has(id))), [priorityTraits, characterProfile]);
  const activeVnProfile = useMemo(() => omitUnprioritizedSpecialTags(expandVectorParents(searchVector(vnProfile, tagLimit, activePriorityTags, tagMeta), tagMeta, showSpoiler, activePriorityTags), tagMeta, activePriorityTags), [vnProfile, tagLimit, activePriorityTags, tagMeta, showSpoiler]);
  const activeCharacterProfile = useMemo(() => expandVectorParents(searchVector(characterProfile, traitLimit, activePriorityTraits, traitMeta), traitMeta, showSpoiler, activePriorityTraits), [characterProfile, traitLimit, activePriorityTraits, traitMeta, showSpoiler]);
  const tagSearchTagGroups = useMemo(() => data ? metaSearchGroups(tagSearchTags, data.tags, tagMeta, showSexual, showSpoiler, false) : [], [data, tagSearchTags, tagMeta, showSexual, showSpoiler]);
  const tagSearchTraitGroups = useMemo(() => data ? metaSearchGroups(tagSearchTraits, data.traits, traitMeta, showSexual, showSpoiler) : [], [data, tagSearchTraits, traitMeta, showSexual, showSpoiler]);
  const tagSearchSexualTagIds = useMemo(() => selectedSexualAlternativeIds(tagSearchTagGroups, tagMeta), [tagSearchTagGroups, tagMeta]);
  const tagSearchSexualTraitIds = useMemo(() => selectedSexualAlternativeIds(tagSearchTraitGroups, traitMeta), [tagSearchTraitGroups, traitMeta]);

  useEffect(() => {
    if (!data || !recommendationWorkerRef.current) return;
    setWorkerReady(false);
    setWorkerComputing(false);
    recommendationWorkerRef.current.postMessage({ type: 'init', data });
  }, [data]);

  useEffect(() => {
    if (!data || !workerReady || !recommendationWorkerRef.current) return;
    const requestId = recommendationRequestIdRef.current + 1;
    recommendationRequestIdRef.current = requestId;
    setWorkerComputing(true);
    recommendationWorkerRef.current.postMessage({
      type: 'compute',
      requestId,
      params: {
        selectedVnIds: selectedVns.map((vn) => vn.id),
        selectedCharacterIds: selectedCharacters.map((character) => character.id),
        activeVnProfile: [...activeVnProfile.entries()],
        activeCharacterProfile: [...activeCharacterProfile.entries()],
        activePriorityTags: [...activePriorityTags],
        activePriorityTraits: [...activePriorityTraits],
        tagSearchTags: [...tagSearchTags],
        tagSearchTraits: [...tagSearchTraits],
        tagSearchTagGroups: tagSearchTagGroups.map((group) => ({ selectedId: group.selectedId, alternatives: [...group.alternatives] })),
        tagSearchTraitGroups: tagSearchTraitGroups.map((group) => ({ selectedId: group.selectedId, alternatives: [...group.alternatives] })),
        tagSearchSexualTagIds: [...tagSearchSexualTagIds],
        tagSearchSexualTraitIds: [...tagSearchSexualTraitIds],
        minVotes,
        showSpoiler,
        tagRoleFilter,
        preferCharacterAverage,
        resultSort,
        sortDirection
      }
    });
  }, [data, workerReady, selectedVns, selectedCharacters, activeVnProfile, activeCharacterProfile, activePriorityTags, activePriorityTraits, tagSearchTags, tagSearchTraits, tagSearchTagGroups, tagSearchTraitGroups, tagSearchSexualTagIds, tagSearchSexualTraitIds, minVotes, showSpoiler, tagRoleFilter, preferCharacterAverage, resultSort, sortDirection]);

  const vnRecommendations = useMemo<Recommendation<Vn>[]>(() => workerResult.vnRecommendations
    .map((item) => {
      const vn = vnById.get(item.id);
      return vn ? { ...vn, ...item } : null;
    })
    .filter(Boolean)
    .map((item) => item as Recommendation<Vn>), [workerResult.vnRecommendations, vnById]);

  const characterRecommendations = useMemo<Recommendation<Character>[]>(() => workerResult.characterRecommendations
    .map((item) => {
      const character = characterById.get(item.id);
      return character ? { ...character, ...item } : null;
    })
    .filter(Boolean)
    .map((item) => item as Recommendation<Character>), [workerResult.characterRecommendations, characterById]);

  const tagSearchVnResults = useMemo<Recommendation<Vn>[]>(() => workerResult.tagSearchVnResults
    .map((item) => {
      const vn = vnById.get(item.id);
      return vn ? { ...vn, ...item } : null;
    })
    .filter(Boolean)
    .map((item) => item as Recommendation<Vn>), [workerResult.tagSearchVnResults, vnById]);

  const tagSearchCharacterResults = useMemo<Recommendation<Character>[]>(() => workerResult.tagSearchCharacterResults
    .map((item) => {
      const character = characterById.get(item.id);
      return character ? { ...character, ...item } : null;
    })
    .filter(Boolean)
    .map((item) => item as Recommendation<Character>), [workerResult.tagSearchCharacterResults, characterById]);

  const mixedTagResults = useMemo<MixedTagResult[]>(() => workerResult.mixedTagResults
    .map((item) => {
      const vn = vnById.get(item.vnId);
      const character = characterById.get(item.characterId);
      if (!vn || !character) return null;
      const vnRef = workerResult.tagSearchVnResults.find((result) => result.id === item.vnId);
      const characterRef = workerResult.tagSearchCharacterResults.find((result) => result.id === item.characterId);
      if (!vnRef || !characterRef) return null;
      return { vn: { ...vn, ...vnRef }, character: { ...character, ...characterRef }, similarity: item.similarity, priorityMatched: item.priorityMatched, priorityTotal: item.priorityTotal, priorityConfidence: item.priorityConfidence };
    })
    .filter(Boolean)
    .map((item) => item as MixedTagResult), [workerResult.mixedTagResults, workerResult.tagSearchVnResults, workerResult.tagSearchCharacterResults, vnById, characterById]);

  if (error) return <main className="shell"><section className="panel error">{error}</section></main>;
  if (!data) return <main className="shell loadingShell"><section className="panel loadingPanel"><div className="progressRing" style={{ '--progress': `${loadProgress}%` } as React.CSSProperties}><span>{loadProgress}%</span></div><strong>{t.loading}</strong></section></main>;

  const processDetailQueue = async (version: number) => {
    if (detailQueueRunningRef.current !== null) return;
    detailQueueRunningRef.current = version;
    while (detailQueueVersionRef.current === version && detailQueueRef.current.length) {
      const item = detailQueueRef.current.shift();
      if (!item) continue;
      const elapsed = Date.now() - lastDetailRequestAtRef.current;
      if (elapsed < DETAIL_REQUEST_INTERVAL) await sleep(DETAIL_REQUEST_INTERVAL - elapsed);
      if (detailQueueVersionRef.current !== version) break;
      try {
        lastDetailRequestAtRef.current = Date.now();
        await item.run();
      } catch (reason) {
        if (detailQueueVersionRef.current !== version) break;
        if (item.attempts + 1 < DETAIL_RETRY_LIMIT) {
          await sleep(DETAIL_RETRY_DELAY);
          if (detailQueueVersionRef.current === version) detailQueueRef.current.unshift({ ...item, attempts: item.attempts + 1 });
        } else {
          item.fail(reason);
        }
      }
    }
    if (detailQueueRunningRef.current === version) detailQueueRunningRef.current = null;
  };

  const enqueueDetailRequest = (request: Omit<QueuedDetailRequest, 'attempts'>) => {
    const version = detailQueueVersionRef.current;
    if (detailQueueRef.current.some((item) => item.key === request.key)) return;
    detailQueueRef.current.push({ ...request, attempts: 0 });
    void processDetailQueue(version);
  };

  const requestVnDetail = (id: number, target: 'sample' | 'recommendation') => {
    const key = `v${id}`;
    if (target === 'sample' && vnDetails[id]) return;
    if (target === 'recommendation' && recommendationDetails[key]) return;
    const version = target === 'recommendation' ? recommendationDetailVersionRef.current : null;
    if (target === 'sample') setVnDetails((details) => ({ ...details, [id]: { loading: true } }));
    else setRecommendationDetails((details) => ({ ...details, [key]: { loading: true } }));
    enqueueDetailRequest({
      key: `${target}-${key}`,
      run: async () => {
        const detail = await fetchVnDetail(id);
        if (version !== null && recommendationDetailVersionRef.current !== version) return;
        if (target === 'sample') setVnDetails((details) => ({ ...details, [id]: detail }));
        else setRecommendationDetails((details) => ({ ...details, [key]: detail }));
      },
      fail: (reason) => {
        if (version !== null && recommendationDetailVersionRef.current !== version) return;
        if (target === 'sample') setVnDetails((details) => ({ ...details, [id]: { error: String(reason) } }));
        else setRecommendationDetails((details) => ({ ...details, [key]: { error: String(reason) } }));
      }
    });
  };

  const requestCharacterDetail = (id: number, target: 'sample' | 'recommendation') => {
    const key = `c${id}`;
    if (target === 'sample' && characterDetails[id]) return;
    if (target === 'recommendation' && recommendationDetails[key]) return;
    const version = target === 'recommendation' ? recommendationDetailVersionRef.current : null;
    if (target === 'sample') setCharacterDetails((details) => ({ ...details, [id]: { loading: true } }));
    else setRecommendationDetails((details) => ({ ...details, [key]: { loading: true } }));
    enqueueDetailRequest({
      key: `${target}-${key}`,
      run: async () => {
        const detail = await fetchCharacterDetail(id);
        if (version !== null && recommendationDetailVersionRef.current !== version) return;
        if (target === 'sample') setCharacterDetails((details) => ({ ...details, [id]: detail }));
        else setRecommendationDetails((details) => ({ ...details, [key]: detail }));
      },
      fail: (reason) => {
        if (version !== null && recommendationDetailVersionRef.current !== version) return;
        if (target === 'sample') setCharacterDetails((details) => ({ ...details, [id]: { error: String(reason) } }));
        else setRecommendationDetails((details) => ({ ...details, [key]: { error: String(reason) } }));
      }
    });
  };

  const addSelection = (item: Vn | Character) => {
    if (mode === 'vn') {
      const vn = item as Vn;
      setSelectedVns((list) => list.some((it) => it.id === vn.id) ? list : [...list, vn]);
      requestVnDetail(vn.id, 'sample');
    } else {
      const character = item as Character;
      setSelectedCharacters((list) => list.some((it) => it.id === character.id) ? list : [...list, character]);
      requestCharacterDetail(character.id, 'sample');
    }
  };

  const sortedVnRecommendations = vnRecommendations;
  const sortedCharacterRecommendations = characterRecommendations;
  const sortedTagSearchVnResults = tagSearchVnResults;
  const sortedTagSearchCharacterResults = tagSearchCharacterResults;
  const sortedMixedTagResults = mixedTagResults;
  const tagModeResultCount = tagSearchTags.size && tagSearchTraits.size ? sortedMixedTagResults.length : tagSearchTags.size ? sortedTagSearchVnResults.length : sortedTagSearchCharacterResults.length;
  const activeResultCount = mode === 'vn' ? sortedVnRecommendations.length : mode === 'character' ? sortedCharacterRecommendations.length : tagModeResultCount;
  const activePageCount = pageCount(activeResultCount);
  const currentResultPage = Math.min(resultPage, activePageCount);
  const recommendationStatusText = workerComputing
    ? t.computing
    : `${t.candidates}：${activeResultCount.toLocaleString()}，${t.perPage} ${RESULTS_PER_PAGE}，${t.currentPage} ${currentResultPage} / ${activePageCount} ${t.page}`;
  const visibleVnRecommendations = pageItems(sortedVnRecommendations, currentResultPage);
  const visibleCharacterRecommendations = pageItems(sortedCharacterRecommendations, currentResultPage);
  const visibleTagSearchVnResults = pageItems(sortedTagSearchVnResults, currentResultPage);
  const visibleTagSearchCharacterResults = pageItems(sortedTagSearchCharacterResults, currentResultPage);
  const visibleMixedTagResults = pageItems(sortedMixedTagResults, currentResultPage);

  const requestRecommendationDetailsForPage = (page: number) => {
    if (mode === 'vn') pageItems(sortedVnRecommendations, page).forEach((vn) => requestVnDetail(vn.id, 'recommendation'));
    else if (mode === 'character') pageItems(sortedCharacterRecommendations, page).forEach((character) => requestCharacterDetail(character.id, 'recommendation'));
    else if (tagSearchTags.size && tagSearchTraits.size) pageItems(sortedMixedTagResults, page).forEach((result) => {
      requestVnDetail(result.vn.id, 'recommendation');
      requestCharacterDetail(result.character.id, 'recommendation');
    });
    else if (tagSearchTags.size) pageItems(sortedTagSearchVnResults, page).forEach((vn) => requestVnDetail(vn.id, 'recommendation'));
    else pageItems(sortedTagSearchCharacterResults, page).forEach((character) => requestCharacterDetail(character.id, 'recommendation'));
  };

  const requestVisibleRecommendationDetails = () => {
    requestRecommendationDetailsForPage(currentResultPage);
  };

  const showRecommendationResults = () => {
    setShowRecommendations(true);
    requestVisibleRecommendationDetails();
  };

  const changeResultPage = (page: number) => {
    const nextPage = Math.min(activePageCount, Math.max(1, page));
    setResultPage(nextPage);
    window.requestAnimationFrame(() => scrollToPanelTop(recommendationResultsRef.current));
    if (showRecommendations) requestRecommendationDetailsForPage(nextPage);
  };

  const profileItems = mode === 'vn'
    ? [...vnProfile.entries()].filter(([id]) => showBlockedTags || !tagMeta.get(id)?.blocked).sort((a, b) => b[1] - a[1])
    : [...characterProfile.entries()].sort((a, b) => b[1] - a[1]);
  const groupedProfileTraits = mode === 'character' ? profileTraitGroups(profileItems, traitMeta, showSexual) : [];

  const togglePriority = (id: number) => {
    const setter = mode === 'vn' ? setPriorityTags : setPriorityTraits;
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main className={`shell ${darkMode ? 'themeDark' : 'themeLight'}`}>
      <header className="hero">
        <div>
          <div className="heroContent">
            <div>
              <p className="eyebrow">{t.source}</p>
              <h1>VNDB Profile Search</h1>
              <button className="themeToggle" onClick={() => setDarkMode((value) => !value)}>{darkMode ? t.themeLight : t.themeDark}</button>
            </div>
            <div className="heroLinks" aria-label={t.projectLinks}>
              <a className="heroLinkCard" href={README_URL} target="_blank" rel="noreferrer">
                <span>README</span>
                <strong>{t.readmeTitle}</strong>
              </a>
              <a className="heroLinkCard repoStarCard" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
                <span>GitHub</span>
                <strong>{githubStars === null ? t.githubStarFallback : `${githubStars.toLocaleString()} ★`}</strong>
                <small>{t.githubStarHelp}</small>
              </a>
            </div>
          </div>
        </div>
        <div className="stats">
          <strong>{data.stats.vns.toLocaleString()}</strong><span>{t.statsVn}</span>
          <strong>{data.stats.characters.toLocaleString()}</strong><span>{t.statsCharacters}</span>
          <strong>{(effectiveMetaCount(data.tags) + effectiveMetaCount(data.traits)).toLocaleString()}</strong><span>{t.statsMeta}</span>
          <strong>{data.stats.producers?.toLocaleString() ?? 0}</strong><span>{t.statsProducers}</span>
        </div>
      </header>

      <section className="toolbar panel">
        <div className="toolbarRow toolbarCommon">
          <div className="tabs">
            <button className={mode === 'vn' ? 'active' : ''} onClick={() => setMode('vn')}>{t.vnMode}</button>
            <button className={mode === 'character' ? 'active' : ''} onClick={() => setMode('character')}>{t.characterMode}</button>
            <button className={mode === 'tag' ? 'active' : ''} onClick={() => setMode('tag')}>{t.tagMode}</button>
          </div>
          <label><input type="checkbox" checked={showSexual} onChange={(event) => setShowSexual(event.target.checked)} /> {t.showR18}</label>
          <label><input type="checkbox" checked={showSpoiler} onChange={(event) => setShowSpoiler(event.target.checked)} /> {t.allowSpoiler}</label>
          {(mode === 'vn' || mode === 'tag') ? <label><input type="checkbox" checked={showBlockedTags} onChange={(event) => setShowBlockedTags(event.target.checked)} /> {t.showBlockedTags}</label> : null}
          <div className="languageTools" aria-label={t.metaLanguageLabel}>
            <span>{t.metaLanguage}</span>
            <button className={metaLanguage === 'zh' ? 'active' : ''} onClick={() => setMetaLanguage('zh')}>中文</button>
            <button className={metaLanguage === 'ja' ? 'active' : ''} onClick={() => setMetaLanguage('ja')}>日本語</button>
            <button className={metaLanguage === 'origin' ? 'active' : ''} onClick={() => setMetaLanguage('origin')}>origin</button>
          </div>
          <div className="languageTools" aria-label={t.uiLanguageLabel}>
            <span>{t.uiLanguage}</span>
            <button className={uiLanguage === 'zh' ? 'active' : ''} onClick={() => setUiLanguage('zh')}>中文</button>
            <button className={uiLanguage === 'ja' ? 'active' : ''} onClick={() => setUiLanguage('ja')}>日本語</button>
            <button className={uiLanguage === 'en' ? 'active' : ''} onClick={() => setUiLanguage('en')}>English</button>
          </div>
        </div>
        <div className="toolbarRow toolbarSpecific">
          {mode !== 'tag' ? <label className="searchBox">
            <span>{mode === 'vn' ? t.searchVn : t.searchCharacter}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setSubmittedQuery(query); }} />
          </label> : null}
          {mode !== 'tag' ? <button onClick={() => setSubmittedQuery(query)}>{t.searchLocal}</button> : null}
        </div>
      </section>

      {mode === 'tag' ? <TagSearchPanel tags={data.tags} traits={data.traits} tagMeta={tagMeta} traitMeta={traitMeta} tagUsageCounts={tagUsageCounts} traitUsageCounts={traitUsageCounts} selectedTags={tagSearchTags} selectedTraits={tagSearchTraits} setSelectedTags={setTagSearchTags} setSelectedTraits={setTagSearchTraits} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags={showBlockedTags} metaLanguage={metaLanguage} t={t} /> : <section className="grid two">
        <div className="panel" ref={localResultsRef}>
          <h2>{t.localResults}</h2>
          <p className="resultMeta">{t.candidates}：{searchResults.length.toLocaleString()}，{t.currentPage} {currentLocalSearchPage} / {localSearchPageCount} {t.page}</p>
          <div className="resultActions localSearchActions">
            <button onClick={() => changeLocalSearchPage(currentLocalSearchPage - 1)} disabled={currentLocalSearchPage <= 1}>{isMobile && mode === 'vn' ? t.previousItem : t.previous}</button>
            <button onClick={() => changeLocalSearchPage(currentLocalSearchPage + 1)} disabled={currentLocalSearchPage >= localSearchPageCount}>{isMobile && mode === 'vn' ? t.nextItem : t.next}</button>
          </div>
          <div className="list">
            {visibleSearchResults.map((item) => mode === 'vn'
              ? <VnCard key={`vn-${(item as Vn).id}`} vn={item as Vn} meta={tagMeta} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags={showBlockedTags} metaLanguage={metaLanguage} onAdd={() => addSelection(item)} />
              : <CharacterCard key={`ch-${(item as Character).id}`} character={item as Character} vns={vnById} meta={traitMeta} showSexual={showSexual} showSpoiler={showSpoiler} metaLanguage={metaLanguage} preferAverage={preferCharacterAverage} onAdd={() => addSelection(item)} />)}
          </div>
        </div>
        <div className="panel">
          <h2>{t.selectedSamples}</h2>
          <div className="list compact">
            {mode === 'vn'
              ? selectedVns.map((vn) => <VnCard key={`selected-vn-${vn.id}`} vn={vn} meta={tagMeta} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags={showBlockedTags} metaLanguage={metaLanguage} detail={vnDetails[vn.id]} showMedia showDescription={false} onRemove={() => setSelectedVns((list) => list.filter((it) => it.id !== vn.id))} />)
              : selectedCharacters.map((character) => <CharacterCard key={`selected-ch-${character.id}`} character={character} vns={vnById} meta={traitMeta} showSexual={showSexual} showSpoiler={showSpoiler} metaLanguage={metaLanguage} preferAverage={preferCharacterAverage} detail={characterDetails[character.id]} showMedia showDescription={false} onRemove={() => setSelectedCharacters((list) => list.filter((it) => it.id !== character.id))} />)}
          </div>
          <div className="profileHead">
            <h3>{t.profile}</h3>
          </div>
          {mode === 'vn' ? <div className="chips profileChips">
            {profileItems.map(([id, value]) => {
              const meta = tagMeta.get(id);
              if (!meta) return null;
              const name = metaName(meta, showSexual, metaLanguage);
              const priority = priorityTags.has(id);
              const chipSpoilerClass = spoilerClass(vnProfileSpoilers.get(id) ?? 0);
              return <button key={`g-${id}`} className={`chip ${meta.sexual ? 'sexual' : ''} ${meta.tech ? 'technical' : ''} ${meta.blocked ? 'blocked' : ''} ${chipSpoilerClass} ${priority ? 'priority' : ''}`} onClick={() => togglePriority(id)} title={metaTooltip(meta, showSexual, metaLanguage)}>{priority ? '★ ' : ''}{name} {value.toFixed(2)}</button>;
            })}
          </div> : <div className="traitGroupList profileChips">
            {groupedProfileTraits.map(([label, items]) => <div className="traitGroup" key={`profile-group-${label}`}>
              <div className="traitGroupLabel">{label}</div>
              <div className="chips">
                {items.map(([id, value]) => {
                  const meta = traitMeta.get(id);
                  if (!meta) return null;
                  const name = metaName(meta, showSexual, metaLanguage);
                  const priority = priorityTraits.has(id);
                  const chipSpoilerClass = spoilerClass(characterProfileSpoilers.get(id) ?? 0);
                  return <button key={`i-${id}`} className={`chip ${meta.sexual ? 'sexual' : ''} ${chipSpoilerClass} ${priority ? 'priority' : ''}`} onClick={() => togglePriority(id)} title={metaTooltip(meta, showSexual, metaLanguage)}>{priority ? '★ ' : ''}{name} {value.toFixed(2)}</button>;
                })}
              </div>
            </div>)}
          </div>}
        </div>
      </section>}

      <section className="panel" ref={recommendationResultsRef}>
        <div className="sectionHead">
          <div>
            <h2>{mode === 'vn' ? t.vnRecommendations : mode === 'character' ? t.characterRecommendations : t.tagResults}</h2>
            <p>{recommendationStatusText}</p>
          </div>
          <div className="resultControlBar">
            <label className="selectControl">{t.sort}
              <select value={resultSort} onChange={(event) => setResultSort(event.target.value as ResultSort)}>
                <option value="relevance">{t.relevance}</option>
                <option value="confidence">{t.confidence}</option>
                <option value="rating">{t.rating}</option>
                <option value="votes">{t.votes}</option>
                <option value="title">{t.title}</option>
              </select>
            </label>
            <label className="selectControl">{t.direction}
              <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}>
                <option value="desc">{t.desc}</option>
                <option value="asc">{t.asc}</option>
              </select>
            </label>
            {(mode === 'vn' || mode === 'character' || mode === 'tag') ? <label className="votes">{t.minVotes} <input type="number" min={0} value={minVotes} onChange={(event) => setMinVotes(Number(event.target.value))} /></label> : null}
            {mode === 'vn'
              ? <label className="votes limitControl">{t.tagLimit} <input type="number" min={1} max={60} value={tagLimit} onChange={(event) => setTagLimit(Number(event.target.value))} /></label>
              : mode === 'character' ? <label className="votes limitControl">{t.traitLimit} <input type="number" min={1} max={80} value={traitLimit} onChange={(event) => setTraitLimit(Number(event.target.value))} /></label> : null}
            {(mode === 'character' || mode === 'tag') ? <label><input type="checkbox" checked={preferCharacterAverage} onChange={(event) => setPreferCharacterAverage(event.target.checked)} /> {t.preferAverage}</label> : null}
            {mode === 'tag' ? <div className="roleFilters" aria-label={t.roleType}>
              <span>{t.roleType}</span>
              <label><input type="checkbox" checked={tagRoleFilter.primary} onChange={(event) => setTagRoleFilter((current) => ({ ...current, primary: event.target.checked }))} /> {t.primary}</label>
              <label><input type="checkbox" checked={tagRoleFilter.main} onChange={(event) => setTagRoleFilter((current) => ({ ...current, main: event.target.checked }))} /> {t.main}</label>
              <label><input type="checkbox" checked={tagRoleFilter.side} onChange={(event) => setTagRoleFilter((current) => ({ ...current, side: event.target.checked }))} /> {t.side}</label>
              <label><input type="checkbox" checked={tagRoleFilter.appears} onChange={(event) => setTagRoleFilter((current) => ({ ...current, appears: event.target.checked }))} /> {t.appears}</label>
            </div> : null}
          </div>
          <div className="resultActions">
            <button onClick={() => changeResultPage(currentResultPage - 1)} disabled={currentResultPage <= 1}>{t.previous}</button>
            <button onClick={() => changeResultPage(currentResultPage + 1)} disabled={currentResultPage >= activePageCount}>{t.next}</button>
            <button onClick={showRecommendationResults} disabled={workerComputing || !activeResultCount}>{t.loadPage}</button>
          </div>
        </div>
        {showRecommendations ? <div className="list results">
          {mode === 'vn'
            ? visibleVnRecommendations.map((vn) => <VnCard key={`rec-vn-${vn.id}`} vn={vn} meta={tagMeta} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags={showBlockedTags} metaLanguage={metaLanguage} detail={recommendationDetails[`v${vn.id}`]} showMedia similarity={vn.similarity} overlap={vn.overlap} priorityMatched={vn.priorityMatched} priorityTotal={vn.priorityTotal} priorityConfidence={vn.priorityConfidence} relations={vn.relations.map(([id, relation]) => vnById.get(id) ? `${relation}: ${vnById.get(id)?.title}` : null).filter(Boolean) as string[]} />)
            : mode === 'character'
              ? visibleCharacterRecommendations.map((character) => <CharacterCard key={`rec-ch-${character.id}`} character={character} vns={vnById} meta={traitMeta} showSexual={showSexual} showSpoiler={showSpoiler} metaLanguage={metaLanguage} preferAverage={preferCharacterAverage} detail={recommendationDetails[`c${character.id}`]} showMedia similarity={character.similarity} overlap={character.overlap} priorityMatched={character.priorityMatched} priorityTotal={character.priorityTotal} priorityConfidence={character.priorityConfidence} />)
              : tagSearchTags.size && tagSearchTraits.size
                ? visibleMixedTagResults.map((result) => <MixedTagCard key={`mixed-${result.vn.id}-${result.character.id}`} result={result} tagMeta={tagMeta} traitMeta={traitMeta} vns={vnById} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags={showBlockedTags} metaLanguage={metaLanguage} vnDetail={recommendationDetails[`v${result.vn.id}`]} characterDetail={recommendationDetails[`c${result.character.id}`]} minVotes={minVotes} roleFilter={tagRoleFilter} />)
                : tagSearchTags.size
                  ? visibleTagSearchVnResults.map((vn) => <VnCard key={`tag-vn-${vn.id}`} vn={vn} meta={tagMeta} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags={showBlockedTags} metaLanguage={metaLanguage} detail={recommendationDetails[`v${vn.id}`]} showMedia similarity={vn.similarity} overlap={vn.overlap} priorityMatched={vn.priorityMatched} priorityTotal={vn.priorityTotal} priorityConfidence={vn.priorityConfidence} />)
                  : visibleTagSearchCharacterResults.map((character) => <CharacterCard key={`tag-ch-${character.id}`} character={character} vns={vnById} meta={traitMeta} showSexual={showSexual} showSpoiler={showSpoiler} metaLanguage={metaLanguage} preferAverage={preferCharacterAverage} detail={recommendationDetails[`c${character.id}`]} showMedia similarity={character.similarity} overlap={character.overlap} priorityMatched={character.priorityMatched} priorityTotal={character.priorityTotal} priorityConfidence={character.priorityConfidence} minVotes={minVotes} roleFilter={tagRoleFilter} />)}
        </div> : workerComputing ? null : <div className="empty">{`${t.candidates}：${activeResultCount.toLocaleString()}。${t.choosePage}`}</div>}
      </section>

      <footer className="footer">
        {t.license}
      </footer>
    </main>
  );
}

function metaAllNames(metaItem: Meta) {
  return [
    decodedMetaField(metaItem.name, metaItem.nameEncoded),
    decodedMetaField(metaItem.nameZh, metaItem.nameZhEncoded),
    decodedMetaField(metaItem.nameJa, metaItem.nameJaEncoded),
    decodedMetaField(metaItem.alias, metaItem.nameEncoded)
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

function metaAllDescriptions(metaItem: Meta) {
  return [
    decodedMetaField(metaItem.description, metaItem.descriptionEncoded),
    decodedMetaField(metaItem.descriptionZh, metaItem.descriptionZhEncoded),
    decodedMetaField(metaItem.descriptionJa, metaItem.descriptionJaEncoded)
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

function metaTreeCount(item: Meta, children: Map<number, Meta[]>, path = new Set<number>()) {
  if (path.has(item.id)) return 0;
  const nextPath = new Set(path);
  nextPath.add(item.id);
  let count = 1;
  for (const child of children.get(item.id) ?? []) count += metaTreeCount(child, children, nextPath);
  return count;
}

function metaTreeHasSelectedDescendant(item: Meta, children: Map<number, Meta[]>, selected: Set<number>, path = new Set<number>()) {
  if (path.has(item.id)) return false;
  const nextPath = new Set(path);
  nextPath.add(item.id);
  for (const child of children.get(item.id) ?? []) {
    if (selected.has(child.id) || metaTreeHasSelectedDescendant(child, children, selected, nextPath)) return true;
  }
  return false;
}

function metaAncestors(item: Meta, meta: Map<number, Meta>, path = new Set<number>()) {
  const result: Meta[] = [];
  for (const parentId of item.parents ?? []) {
    if (path.has(parentId)) continue;
    const parent = meta.get(parentId);
    if (!parent) continue;
    const nextPath = new Set(path);
    nextPath.add(parentId);
    result.push(...metaAncestors(parent, meta, nextPath), parent);
  }
  return result.filter((ancestor, index, list) => list.findIndex((candidate) => candidate.id === ancestor.id) === index);
}

function metaSortUnitCount(name: string, language: MetaLanguage) {
  const normalized = name.trim();
  if (!normalized) return 0;
  if (language === 'origin') return normalized.split(/[\s\-_/]+/).filter(Boolean).length;
  return Array.from(normalized.replace(/\s+/g, '')).length;
}

function compareMetaTreeName(a: Meta, b: Meta, showSexual: boolean, language: MetaLanguage) {
  const leftName = metaName(a, showSexual, language);
  const rightName = metaName(b, showSexual, language);
  const lengthDiff = metaSortUnitCount(leftName, language) - metaSortUnitCount(rightName, language);
  if (lengthDiff) return lengthDiff;
  const locale = language === 'zh' ? 'zh-Hans-u-co-pinyin' : language === 'ja' ? 'ja' : 'en';
  return leftName.localeCompare(rightName, locale, { sensitivity: 'base', numeric: true });
}

function metaChipClass(item: Meta) {
  return `chip ${item.sexual ? 'sexual' : ''} ${item.tech ? 'technical' : ''} ${item.blocked ? 'blocked' : ''}`;
}

function searchableMetaUsageCounts(items: Array<{ id: number; votes?: number; vns?: [number, string, number][]; tags?: Pair[]; traits?: TraitPair[] }>, metas: Meta[], meta: Map<number, Meta>, field: 'tags' | 'traits', kind: 'tag' | 'trait', includeSexual: boolean, includeSpoiler: boolean, itemAllowed: (item: { id: number; votes?: number; vns?: [number, string, number][]; tags?: Pair[]; traits?: TraitPair[] }) => boolean) {
  const direct = new Map<number, Set<number>>();
  for (const item of items) {
    if (!itemAllowed(item)) continue;
    const ids = new Set<number>();
    for (const pair of item[field] ?? []) {
      const metaItem = meta.get(pair[0]);
      if (!metaItem || itemLie(pair, kind)) continue;
      if (!includeSpoiler && Math.max(itemSpoiler(pair, kind), metaItem.defaultspoil ?? 0) > 0) continue;
      ids.add(pair[0]);
    }
    for (const id of ids) {
      if (!direct.has(id)) direct.set(id, new Set());
      direct.get(id)?.add(item.id);
    }
  }
  const children = metaChildrenMap(metas);
  return new Map(metas.map((metaItem) => {
    if (!includeSexual && metaItem.sexual) return [metaItem.id, 0];
    if (!includeSpoiler && metaItem.defaultspoil && metaItem.defaultspoil > 0) return [metaItem.id, 0];
    const alternatives = new Set<number>([metaItem.id]);
    const includeSexualDescendants = includeSexual && metaItem.sexual === true;
    const includeBlockedDescendants = kind === 'trait' || metaItem.blocked === true;
    for (const child of metaSearchDescendants(metaItem, children, includeSexualDescendants, includeSpoiler, includeBlockedDescendants)) alternatives.add(child.id);
    const used = new Set<number>();
    for (const id of alternatives) for (const itemId of direct.get(id) ?? []) used.add(itemId);
    return [metaItem.id, used.size];
  }));
}

function TagSearchPanel({ tags, traits, tagMeta, traitMeta, tagUsageCounts, traitUsageCounts, selectedTags, selectedTraits, setSelectedTags, setSelectedTraits, showSexual, showSpoiler, showBlockedTags, metaLanguage, t }: { tags: Meta[]; traits: Meta[]; tagMeta: Map<number, Meta>; traitMeta: Map<number, Meta>; tagUsageCounts: Map<number, number>; traitUsageCounts: Map<number, number>; selectedTags: Set<number>; selectedTraits: Set<number>; setSelectedTags: React.Dispatch<React.SetStateAction<Set<number>>>; setSelectedTraits: React.Dispatch<React.SetStateAction<Set<number>>>; showSexual: boolean; showSpoiler: boolean; showBlockedTags: boolean; metaLanguage: MetaLanguage; t: Record<string, string> }) {
  const [tagSelectorHeight, setTagSelectorHeight] = useState(520);
  const [traitSelectorHeight, setTraitSelectorHeight] = useState(520);
  return <section className="tagSearchGrid">
    <div className="panel">
      <div className="sectionHead compactHead">
        <div><h2>{t.tagPanelTitle}</h2><p>{t.tagPanelDesc}</p></div>
        <button onClick={() => setSelectedTags(new Set())} disabled={!selectedTags.size}>{t.clear}</button>
      </div>
      <MetaSelector kind="tag" items={tags} meta={tagMeta} usageCounts={tagUsageCounts} selected={selectedTags} setSelected={setSelectedTags} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags={showBlockedTags} metaLanguage={metaLanguage} t={t} height={tagSelectorHeight} setHeight={setTagSelectorHeight} />
    </div>
    <div className="panel">
      <div className="sectionHead compactHead">
        <div><h2>{t.traitPanelTitle}</h2><p>{t.traitPanelDesc}</p></div>
        <button onClick={() => setSelectedTraits(new Set())} disabled={!selectedTraits.size}>{t.clear}</button>
      </div>
      <MetaSelector kind="trait" items={traits} meta={traitMeta} usageCounts={traitUsageCounts} selected={selectedTraits} setSelected={setSelectedTraits} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags metaLanguage={metaLanguage} t={t} height={traitSelectorHeight} setHeight={setTraitSelectorHeight} />
    </div>
  </section>;
}

function metaSelectorGroupTooltip(kind: 'tag' | 'trait', label: string, groupItems: Meta[], meta: Map<number, Meta>, showSexual: boolean, metaLanguage: MetaLanguage) {
  if (kind === 'trait') {
    const group = groupItems.map((item) => traitGroupMeta(item, meta)).find(Boolean);
    if (group) return metaTooltip(group, showSexual, metaLanguage);
  }
  const descriptions: Record<string, string> = {
    cont: '作品内容相关标签，用于描述题材、设定、剧情元素与表现形式。',
    ero: 'R18 相关标签。默认仅用于展示，不参与搜索；只有被选为重点标签时才参与搜索。',
    tech: '技术性标签。默认仅展示，不参与搜索；只有被选为重点标签时才参与搜索。',
    other: '其他未归入主要分类的标签。'
  };
  return descriptions[label] ?? label;
}

function SelectedMetaSummary({ selected, meta, showSexual, metaLanguage, t, toggle }: { selected: Set<number>; meta: Map<number, Meta>; showSexual: boolean; metaLanguage: MetaLanguage; t: Record<string, string>; toggle: (id: number) => void }) {
  const selectedItems = [...selected].map((id) => meta.get(id)).filter((item): item is Meta => Boolean(item)).sort((a, b) => metaName(a, showSexual, metaLanguage).localeCompare(metaName(b, showSexual, metaLanguage)));
  if (!selectedItems.length) return null;
  return <div className="selectedMetaBox">
    <div className="selectedMetaTitle">{t.selectedMeta} <span>{selectedItems.length}</span></div>
    <div className="selectedMetaList">
      {selectedItems.map((item) => {
        const ancestors = metaAncestors(item, meta);
        return <div className="selectedMetaItem" key={`selected-meta-${item.id}`}>
          <button className={`${metaChipClass(item)} priority`} title={metaTooltip(item, showSexual, metaLanguage)} onClick={() => toggle(item.id)}>★ {metaName(item, showSexual, metaLanguage)}</button>
          {ancestors.length ? <div className="selectedMetaParents"><span>{t.parentMeta}</span>{ancestors.map((parent) => <span key={`selected-meta-${item.id}-parent-${parent.id}`} className={metaChipClass(parent)} title={metaTooltip(parent, showSexual, metaLanguage)}>{metaName(parent, showSexual, metaLanguage)}</span>)}</div> : null}
        </div>;
      })}
    </div>
  </div>;
}

function MetaSelector({ kind, items, meta, usageCounts, selected, setSelected, showSexual, showSpoiler, showBlockedTags, metaLanguage, t, height, setHeight }: { kind: 'tag' | 'trait'; items: Meta[]; meta: Map<number, Meta>; usageCounts: Map<number, number>; selected: Set<number>; setSelected: React.Dispatch<React.SetStateAction<Set<number>>>; showSexual: boolean; showSpoiler: boolean; showBlockedTags: boolean; metaLanguage: MetaLanguage; t: Record<string, string>; height: number; setHeight: React.Dispatch<React.SetStateAction<number>> }) {
  const [query, setQuery] = useState('');
  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    const move = (moveEvent: PointerEvent) => setHeight(Math.max(260, startHeight + moveEvent.clientY - startY));
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };
  const baseVisible = items.filter((item) => {
    if (!showSexual && item.sexual) return false;
    if (!showSpoiler && item.defaultspoil && item.defaultspoil > 0) return false;
    if (kind === 'tag' && item.blocked && !showBlockedTags) return false;
    return item.applicable !== false;
  });
  const q = text(query);
  const titleMatches = q ? baseVisible.filter((item) => metaAllNames(item).includes(q)) : [];
  const matchedItems = q ? (titleMatches.length ? titleMatches : baseVisible.filter((item) => metaAllDescriptions(item).includes(q))) : baseVisible;
  const matchedIds = new Set(matchedItems.map((item) => item.id));
  const visibleIds = new Set<number>();
  for (const item of matchedItems) {
    visibleIds.add(item.id);
    const stack = [...(item.parents ?? [])];
    while (stack.length) {
      const id = stack.pop();
      if (!id || visibleIds.has(id)) continue;
      const parent = meta.get(id);
      if (!parent) continue;
      if (!showSexual && parent.sexual) continue;
      if (!showSpoiler && parent.defaultspoil && parent.defaultspoil > 0) continue;
      if (kind === 'tag' && parent.blocked && !showBlockedTags) continue;
      visibleIds.add(id);
      stack.push(...(parent.parents ?? []));
    }
  }
  const visible = baseVisible.filter((item) => !q || visibleIds.has(item.id));
  const visibleSet = new Set(visible.map((item) => item.id));
  const children = new Map<number, Meta[]>();
  for (const item of visible) {
    for (const parentId of item.parents ?? []) {
      if (!visibleSet.has(parentId)) continue;
      children.set(parentId, [...(children.get(parentId) ?? []), item]);
    }
  }
  const roots = visible.filter((item) => !(item.parents ?? []).some((parentId) => visibleSet.has(parentId)));
  const groups = new Map<string, Meta[]>();
  for (const item of roots) {
    const label = kind === 'tag' ? item.cat ?? 'other' : traitGroupLabel(item, meta);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  const labels: Record<string, string> = { cont: '内容', ero: 'R18', tech: '技术', other: '其他' };
  const toggle = (id: number) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const sortMeta = (list: Meta[]) => [...list].sort((a, b) => compareMetaTreeName(a, b, showSexual, metaLanguage));
  return <div className="metaSelectorWrap">
    <label className="metaFilter"><span>{kind === 'tag' ? t.tagFilter : t.traitFilter}</span><input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <SelectedMetaSummary selected={selected} meta={meta} showSexual={showSexual} metaLanguage={metaLanguage} t={t} toggle={toggle} />
    <div className="metaSelector" style={{ height }}>
      {[...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, groupItems]) => <details key={`${kind}-group-${label}`} open={q ? true : undefined}>
        <summary title={metaSelectorGroupTooltip(kind, label, groupItems, meta, showSexual, metaLanguage)}>{labels[label] ?? label} <span>{groupItems.reduce((sum, item) => sum + metaTreeCount(item, children), 0)}</span></summary>
        <div className="metaTree">
          {sortMeta(groupItems).map((item) => <MetaTreeNode key={`${kind}-tree-${label}-${item.id}`} item={item} children={children} usageCounts={usageCounts} selected={selected} toggle={toggle} showSexual={showSexual} metaLanguage={metaLanguage} matchedIds={matchedIds} query={q} sortMeta={sortMeta} path={new Set()} />)}
        </div>
      </details>)}
    </div>
    <button className="resizeHandle" type="button" onPointerDown={startResize}>拖动调整列表高度</button>
  </div>;
}

function MetaTreeNode({ item, children, usageCounts, selected, toggle, showSexual, metaLanguage, matchedIds, query, sortMeta, path }: { item: Meta; children: Map<number, Meta[]>; usageCounts: Map<number, number>; selected: Set<number>; toggle: (id: number) => void; showSexual: boolean; metaLanguage: MetaLanguage; matchedIds: Set<number>; query: string; sortMeta: (items: Meta[]) => Meta[]; path: Set<number> }) {
  const childItems = sortMeta((children.get(item.id) ?? []).filter((child) => !path.has(child.id)));
  const highlighted = query && matchedIds.has(item.id);
  const descendantSelected = selected.size > 0 && !selected.has(item.id) && metaTreeHasSelectedDescendant(item, children, selected);
  const childCountText = childItems.length ? ` ${childItems.length}` : '';
  const chip = <button className={`chip ${item.sexual ? 'sexual' : ''} ${item.tech ? 'technical' : ''} ${item.blocked ? 'blocked' : ''} ${selected.has(item.id) ? 'priority' : ''} ${descendantSelected ? 'descendantSelected' : ''} ${highlighted ? 'matched' : ''}`} title={metaTooltip(item, showSexual, metaLanguage)} onClick={(event) => { event.preventDefault(); toggle(item.id); }}>{selected.has(item.id) ? '★ ' : ''}{descendantSelected ? '◆ ' : ''}{metaName(item, showSexual, metaLanguage)}{childCountText}</button>;
  const usage = <span className="metaUsageCount">{(usageCounts.get(item.id) ?? 0).toLocaleString()}</span>;
  if (!childItems.length) return <div className="metaTreeLeaf"><div className="metaTreeRow"><span className="metaTreeLeft"><span className="metaExpandPlaceholder" />{chip}</span>{usage}</div></div>;
  const nextPath = new Set(path);
  nextPath.add(item.id);
  return <details className="metaTreeNode" open={query ? true : undefined}>
    <summary><div className="metaTreeRow"><span className="metaTreeLeft"><span className="metaExpandArrow">▸</span>{chip}</span>{usage}</div></summary>
    <div className="metaTreeChildren">
      {childItems.map((child) => <MetaTreeNode key={`tree-child-${item.id}-${child.id}`} item={child} children={children} usageCounts={usageCounts} selected={selected} toggle={toggle} showSexual={showSexual} metaLanguage={metaLanguage} matchedIds={matchedIds} query={query} sortMeta={sortMeta} path={nextPath} />)}
    </div>
  </details>;
}

function MixedTagCard({ result, tagMeta, traitMeta, vns, showSexual, showSpoiler, showBlockedTags, metaLanguage, vnDetail, characterDetail, minVotes, roleFilter }: { result: MixedTagResult; tagMeta: Map<number, Meta>; traitMeta: Map<number, Meta>; vns: Map<number, Vn>; showSexual: boolean; showSpoiler: boolean; showBlockedTags: boolean; metaLanguage: MetaLanguage; vnDetail?: Detail; characterDetail?: Detail; minVotes?: number; roleFilter?: CharacterRoleFilter }) {
  return <article className="mixedCard">
    <div className="metrics"><span>组合相似 {(result.similarity * 100).toFixed(1)}%</span><span>重点置信 {result.priorityMatched}/{result.priorityTotal}（{(Math.min(result.priorityConfidence, 1) * 100).toFixed(0)}%）</span></div>
    <div className="mixedColumns">
      <VnCard vn={result.vn} meta={tagMeta} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags={showBlockedTags} metaLanguage={metaLanguage} detail={vnDetail} showMedia similarity={result.vn.similarity} overlap={result.vn.overlap} priorityMatched={result.vn.priorityMatched} priorityTotal={result.vn.priorityTotal} priorityConfidence={result.vn.priorityConfidence} />
      <CharacterCard character={result.character} vns={vns} meta={traitMeta} showSexual={showSexual} showSpoiler={showSpoiler} metaLanguage={metaLanguage} detail={characterDetail} showMedia similarity={result.character.similarity} overlap={result.character.overlap} priorityMatched={result.character.priorityMatched} priorityTotal={result.character.priorityTotal} priorityConfidence={result.character.priorityConfidence} minVotes={minVotes} roleFilter={roleFilter} />
    </div>
  </article>;
}

function MetaChip({ item, meta, kind, showSexual, metaLanguage }: { item: Pair | TraitPair; meta: Map<number, Meta>; kind: 'tag' | 'trait'; showSexual: boolean; metaLanguage: MetaLanguage }) {
  const metaItem = meta.get(item[0]);
  if (!metaItem) return null;
  const name = metaName(metaItem, showSexual, metaLanguage);
  const score = kind === 'tag' ? ` ${Number(item[1]).toFixed(1)}` : '';
  const spoilerValue = itemSpoiler(item, kind);
  return <a className={`chip ${metaItem.sexual ? 'sexual' : ''} ${metaItem.tech ? 'technical' : ''} ${metaItem.blocked ? 'blocked' : ''} ${spoilerClass(spoilerValue)}`} href={vndbUrl(kind === 'tag' ? 'g' : 'i', item[0])} target="_blank" rel="noreferrer" title={metaTooltip(metaItem, showSexual, metaLanguage)}>{name}{score}</a>;
}

function ProducerLinks({ producers }: { producers: Producer[] }) {
  const unique = producers.filter((producer, index, list) => list.findIndex((item) => item.id === producer.id) === index);
  if (!unique.length) return null;
  return <div className="mini">厂商：{unique.slice(0, 5).map((producer, index) => <React.Fragment key={`producer-${producer.id}-${index}`}>{index ? ' / ' : ''}<a href={vndbUrl('p', producer.id)} target="_blank" rel="noreferrer">{producer.name}</a></React.Fragment>)}</div>;
}

function VnCard({ vn, meta, showSexual, showSpoiler, showBlockedTags = true, metaLanguage, onAdd, onRemove, detail, showMedia = false, showDescription = true, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence, relations = [] }: { vn: Vn; meta: Map<number, Meta>; showSexual: boolean; showSpoiler: boolean; showBlockedTags?: boolean; metaLanguage: MetaLanguage; onAdd?: () => void; onRemove?: () => void; detail?: Detail; showMedia?: boolean; showDescription?: boolean; similarity?: number; overlap?: number; priorityMatched?: number; priorityTotal?: number; priorityConfidence?: number; relations?: string[] }) {
  const producers = detail?.developers?.length ? detail.developers : [...vn.developers, ...vn.publishers];
  return (
    <article className={`card ${showMedia ? '' : 'noMedia'}`}>
      {showMedia ? detail?.imageUrl ? <img src={detail.imageUrl} loading="lazy" /> : <div className="placeholder">VN</div> : null}
      <div className="cardBody">
        <div className="cardHead">
          <div><h3><a href={vndbUrl('v', vn.id)} target="_blank" rel="noreferrer">{vn.title}</a></h3>{vn.original && vn.original !== vn.title ? <p>{vn.original}</p> : null}</div>
          {onAdd ? <button onClick={onAdd}>加入样本</button> : null}
          {onRemove ? <button className="danger" onClick={onRemove}>移除</button> : null}
        </div>
        <div className="metrics"><span>v{vn.id}</span><span>rating {vn.rating.toFixed(1)}</span><span>{vn.votes} votes</span>{detail?.loading ? <span>详情加载中</span> : null}{detail?.error ? <span>详情失败</span> : null}{similarity !== undefined ? <span>相似 {(similarity * 100).toFixed(1)}%</span> : null}{overlap !== undefined ? <span>重合 {overlap}</span> : null}{priorityTotal ? <span>重点置信 {priorityMatched}/{priorityTotal}（{(Math.min(priorityConfidence ?? ((priorityMatched ?? 0) / priorityTotal), 1) * 100).toFixed(0)}%）</span> : null}</div>
        <ProducerLinks producers={producers} />
        {showDescription && detail?.description ? <p className="description">{cleanDescription(detail.description)}</p> : null}
        <div className="chips">{visibleItems(vn.tags, meta, 'tag', showSexual, showSpoiler, showBlockedTags).map((tag, index) => <MetaChip key={`vn-tag-${vn.id}-${tag[0]}-${index}`} item={tag} meta={meta} kind="tag" showSexual={showSexual} metaLanguage={metaLanguage} />)}</div>
        {relations.length ? <div className="relations">相关：{relations.slice(0, 5).join(' / ')}</div> : null}
      </div>
    </article>
  );
}

function CharacterCard({ character, vns, meta, showSexual, showSpoiler, metaLanguage, preferAverage = false, onAdd, onRemove, detail, showMedia = false, showDescription = true, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence, minVotes, roleFilter }: { character: Character; vns: Map<number, Vn>; meta: Map<number, Meta>; showSexual: boolean; showSpoiler: boolean; metaLanguage: MetaLanguage; preferAverage?: boolean; onAdd?: () => void; onRemove?: () => void; detail?: Detail; showMedia?: boolean; showDescription?: boolean; similarity?: number; overlap?: number; priorityMatched?: number; priorityTotal?: number; priorityConfidence?: number; minVotes?: number; roleFilter?: CharacterRoleFilter }) {
  const displayedVns = character.vns.filter(([id, role]) => (minVotes === undefined || (vns.get(id)?.votes ?? 0) >= minVotes) && (!roleFilter || roleAllowed(role, roleFilter)));
  const displayedScores = displayedVns.map(([id]) => vns.get(id)?.average ?? 0).filter((score) => score > 0);
  const averageScore = displayedScores.length ? displayedScores.reduce((sum, score) => sum + score, 0) / displayedScores.length : characterAverageScore(character, vns);
  return (
    <article className={`card ${showMedia ? '' : 'noMedia'}`}>
      {showMedia ? detail?.imageUrl ? <img src={detail.imageUrl} loading="lazy" /> : <div className="placeholder">CH</div> : null}
      <div className="cardBody">
        <div className="cardHead">
          <div><h3><a href={vndbUrl('c', character.id)} target="_blank" rel="noreferrer">{character.name}</a></h3>{character.original && character.original !== character.name ? <p>{character.original}</p> : null}</div>
          {onAdd ? <button onClick={onAdd}>加入样本</button> : null}
          {onRemove ? <button className="danger" onClick={onRemove}>移除</button> : null}
        </div>
        <div className="metrics"><span>c{character.id}</span><span>关联分 {character.score.toFixed(1)}</span>{averageScore ? <span>VN均分 {averageScore.toFixed(1)}</span> : null}{preferAverage ? <span>均分加权</span> : null}{detail?.loading ? <span>详情加载中</span> : null}{detail?.error ? <span>详情失败</span> : null}{similarity !== undefined ? <span>相似 {(similarity * 100).toFixed(1)}%</span> : null}{overlap !== undefined ? <span>重合 {overlap}</span> : null}{priorityTotal ? <span>重点置信 {priorityMatched}/{priorityTotal}（{(Math.min(priorityConfidence ?? ((priorityMatched ?? 0) / priorityTotal), 1) * 100).toFixed(0)}%）</span> : null}</div>
        {showDescription && detail?.description ? <p className="description">{cleanDescription(detail.description)}</p> : null}
        <div className="mini">VN：{displayedVns.slice(0, 4).map(([id, role], index) => <React.Fragment key={`character-vn-${character.id}-${id}-${index}`}>{index ? ' / ' : ''}<a href={vndbUrl('v', id)} target="_blank" rel="noreferrer">{vns.get(id)?.title ?? `v${id}`}</a>({role})</React.Fragment>)}</div>
        <div className="traitGroupList">{traitGroups(character.traits, meta, showSexual, showSpoiler).map(([label, items]) => <div className="traitGroup" key={`character-group-${character.id}-${label}`}>
          <div className="traitGroupLabel">{label}</div>
          <div className="chips">{items.map((trait, index) => <MetaChip key={`character-trait-${character.id}-${trait[0]}-${index}`} item={trait} meta={meta} kind="trait" showSexual={showSexual} metaLanguage={metaLanguage} />)}</div>
        </div>)}</div>
      </div>
    </article>
  );
}

const container = document.getElementById('root')!;
const globalWithRoot = globalThis as typeof globalThis & { __vndbPrototypeRoot?: Root };
const root = globalWithRoot.__vndbPrototypeRoot ?? createRoot(container);
globalWithRoot.__vndbPrototypeRoot = root;
root.render(<App />);
