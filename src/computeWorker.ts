type Pair = [number, number, number, number];
type TraitPair = [number, number, number];
type VnRelation = [number, string, number];
type Producer = { id: number; name: string; nameEncoded?: boolean; original: string | null; originalEncoded?: boolean; type: string; lang: string };
type Vn = { id: number; title: string; titleEncoded?: boolean; original: string | null; originalEncoded?: boolean; olang: string | null; rating: number; average: number; votes: number; image: string | null; aliases: string; aliasesEncoded?: boolean; developers: Producer[]; publishers: Producer[]; search: string; searchEncoded?: boolean; tags: Pair[]; relations: VnRelation[] };
type Character = { id: number; name: string; nameEncoded?: boolean; original: string | null; originalEncoded?: boolean; image: string | null; sex: string | null; gender: string | null; blood: string | null; birthday: string | null; bust: number | null; waist: number | null; hip: number | null; score: number; search: string; searchEncoded?: boolean; aliases: string[]; aliasesEncoded?: boolean; vns: [number, string, number][]; traits: TraitPair[] };
type Meta = { id: number; cat?: string; group?: number | null; defaultspoil?: number; sexual: boolean; tech?: boolean; searchable: boolean; applicable: boolean; name: string; nameEncoded: boolean; parents?: number[]; blocked?: boolean };
type Data = { generatedAt: string; source: string; limits: Record<string, number>; stats: Record<string, number>; usageIndex?: { directTagVns?: [number, number[]][]; directTraitCharacters?: [number, number[]][] }; vns: Vn[]; characters: Character[]; tags: Meta[]; traits: Meta[] };
type CharacterRoleFilter = { primary: boolean; main: boolean; side: boolean; appears: boolean };
type ResultSort = 'relevance' | 'rating' | 'votes' | 'title' | 'confidence';
type SortDirection = 'desc' | 'asc';
type RecRef = { id: number; similarity: number; overlap: number; priorityMatched: number; priorityTotal: number; priorityConfidence: number };
type MixedRef = { vnId: number; characterId: number; similarity: number; priorityMatched: number; priorityTotal: number; priorityConfidence: number };
type MetaSearchGroupRef = { selectedId: number; alternatives: number[] };
type WorkerResultVariant = { vnRecommendations: RecRef[]; characterRecommendations: RecRef[]; tagSearchVnResults: RecRef[]; tagSearchCharacterResults: RecRef[]; mixedTagResults: MixedRef[] };
type WorkerResult = { spoilerOff: WorkerResultVariant; spoilerOn: WorkerResultVariant };
type TagSearchIndex = { vectors: Map<number, number>[]; postings: Map<number, number[]> };
type TraitSearchIndex = { vectors: Map<number, number>[]; postings: Map<number, number[]> };

type ComputeParams = {
  selectedVnIds: number[];
  selectedCharacterIds: number[];
  activeVnProfileSpoilerOff: [number, number][];
  activeVnProfileSpoilerOn: [number, number][];
  activeCharacterProfileSpoilerOff: [number, number][];
  activeCharacterProfileSpoilerOn: [number, number][];
  activePriorityTags: number[];
  activePriorityTraits: number[];
  tagLimit: number;
  traitLimit: number;
  profileSampleRounds: number;
  includeSpoiler: boolean;
  tagSearchTags: number[];
  tagSearchTraits: number[];
  tagSearchTagGroupsSpoilerOff: MetaSearchGroupRef[];
  tagSearchTagGroupsSpoilerOn: MetaSearchGroupRef[];
  tagSearchTraitGroupsSpoilerOff: MetaSearchGroupRef[];
  tagSearchTraitGroupsSpoilerOn: MetaSearchGroupRef[];
  tagSearchSexualTagIdsSpoilerOff: number[];
  tagSearchSexualTagIdsSpoilerOn: number[];
  tagSearchSexualTraitIdsSpoilerOff: number[];
  tagSearchSexualTraitIdsSpoilerOn: number[];
  minVotes: number;
  tagRoleFilter: CharacterRoleFilter;
  preferCharacterAverage: boolean;
  resultSort: ResultSort;
  sortDirection: SortDirection;
};

type WorkerInput = { type: 'init'; data: Data } | { type: 'compute'; requestId: number; params: ComputeParams };

let data: Data | null = null;
let tagMeta = new Map<number, Meta>();
let traitMeta = new Map<number, Meta>();
let vnById = new Map<number, Vn>();
let characterById = new Map<number, Character>();
let tagSearchIndexSpoilerOff: TagSearchIndex | null = null;
let tagSearchIndexSpoilerOn: TagSearchIndex | null = null;
let traitSearchIndexSpoilerOff: TraitSearchIndex | null = null;
let traitSearchIndexSpoilerOn: TraitSearchIndex | null = null;

const normalizeTitle = (value: string) => value.toLocaleLowerCase().replace(/[\s\-_~:：!！?？()[\]（）【】「」『』,，.。]/g, '');

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

function characterDeveloperIds(character: Character) {
  const ids = new Set<number>();
  for (const [vnId] of character.vns) {
    const vn = vnById.get(vnId);
    if (!vn) continue;
    for (const developer of vn.developers) ids.add(developer.id);
  }
  return ids;
}

function selectedCharacterDeveloperIds(characterIds: number[]) {
  const ids = new Set<number>();
  for (const id of characterIds) {
    const character = characterById.get(id);
    if (!character) continue;
    for (const developerId of characterDeveloperIds(character)) ids.add(developerId);
  }
  return ids;
}

function characterCompanyBoost(character: Character, referenceDeveloperIds: Set<number>) {
  if (!referenceDeveloperIds.size) return 1;
  for (const [vnId] of character.vns) {
    const vn = vnById.get(vnId);
    if (!vn) continue;
    if (vn.developers.some((developer) => referenceDeveloperIds.has(developer.id))) return 1.33;
  }
  return 1;
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

function makeVector(items: Pair[] | TraitPair[], meta: Map<number, Meta>, kind: 'tag' | 'trait', includeSpoiler: boolean, includeParents = false, allowedSexualIds?: Set<number>, capParentWeight = false) {
  const vector = new Map<number, number>();
  for (const item of items) {
    const id = item[0];
    const metaItem = meta.get(id);
    const spoiler = itemSpoiler(item, kind);
    const lie = itemLie(item, kind);
    if (!metaItem || lie) continue;
    if (!canUseMetaForSearch(metaItem, spoiler, includeSpoiler, allowedSexualIds)) continue;
    const weight = kind === 'tag' ? ((item as Pair)[1] ?? 1) : 1;
    vector.set(id, Math.max(vector.get(id) ?? 0, weight));
    if (includeParents) {
      for (const parentId of metaItem.parents ?? []) {
        const parent = meta.get(parentId);
        if (!parent) continue;
        if (!canUseMetaForSearch(parent, 0, includeSpoiler, allowedSexualIds)) continue;
        const parentWeight = capParentWeight ? Math.min(weight * 0.55, 0.55) : weight * 0.55;
        vector.set(parentId, Math.max(vector.get(parentId) ?? 0, parentWeight));
      }
    }
  }
  return vector;
}

function addPosting(postings: Map<number, number[]>, metaId: number, index: number) {
  const list = postings.get(metaId) ?? [];
  list.push(index);
  postings.set(metaId, list);
}

function buildTagSearchIndex(includeSpoiler: boolean): TagSearchIndex {
  if (!data) return { vectors: [], postings: new Map() };
  const vectors: Map<number, number>[] = [];
  const postings = new Map<number, number[]>();
  const sexualIds = new Set([...tagMeta.values()].filter((item) => item.sexual).map((item) => item.id));
  for (let index = 0; index < data.vns.length; index += 1) {
    const vn = data.vns[index];
    const vector = makeVector(vn.tags, tagMeta, 'tag', includeSpoiler, true, sexualIds, true);
    vectors[index] = vector;
    for (const id of vector.keys()) addPosting(postings, id, index);
  }
  return { vectors, postings };
}

function buildTraitSearchIndex(includeSpoiler: boolean): TraitSearchIndex {
  if (!data) return { vectors: [], postings: new Map() };
  const vectors: Map<number, number>[] = [];
  const postings = new Map<number, number[]>();
  const sexualIds = new Set([...traitMeta.values()].filter((item) => item.sexual).map((item) => item.id));
  for (let index = 0; index < data.characters.length; index += 1) {
    const character = data.characters[index];
    const vector = makeVector(character.traits, traitMeta, 'trait', includeSpoiler, true, sexualIds);
    vectors[index] = vector;
    for (const id of vector.keys()) addPosting(postings, id, index);
  }
  return { vectors, postings };
}

function collectCandidateIndexes(groups: MetaSearchGroupRef[], postings: Map<number, number[]>) {
  const indexes = new Set<number>();
  for (const group of groups) for (const id of group.alternatives) for (const index of postings.get(id) ?? []) indexes.add(index);
  return indexes;
}

function metaIsAutoIgnored(metaItem?: Meta) {
  return Boolean(metaItem?.tech || metaItem?.blocked);
}

function omitUnprioritizedSpecialTags(vector: Map<number, number>, meta: Map<number, Meta>, priorityIds: Set<number>) {
  const result = new Map<number, number>();
  for (const [id, value] of vector) {
    if (!metaIsAutoIgnored(meta.get(id)) || priorityIds.has(id)) result.set(id, value);
  }
  return result;
}

function mergeVectors(vectors: Map<number, number>[]) {
  const merged = new Map<number, number>();
  for (const vector of vectors) for (const [id, value] of vector) merged.set(id, (merged.get(id) ?? 0) + value);
  return merged;
}

function expandVectorParents(vector: Map<number, number>, meta: Map<number, Meta>, allowedSexualIds?: Set<number>) {
  const result = new Map(vector);
  for (const [id, value] of vector) {
    const metaItem = meta.get(id);
    if (!metaItem) continue;
    for (const parentId of metaItem.parents ?? []) {
      const parent = meta.get(parentId);
      if (!parent || !canUseMetaForSearch(parent, 0, true, allowedSexualIds)) continue;
      result.set(parentId, Math.max(result.get(parentId) ?? 0, value * 0.55));
    }
  }
  return result;
}

function searchVector(vector: Map<number, number>, limit: number, meta: Map<number, Meta>, allowedSexualIds?: Set<number>) {
  return sampledSearchVector(vector, limit, meta, new Set(), 0, allowedSexualIds);
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableUnitRandom(seed: string, key: string) {
  return (hashText(`${seed}|${key}`) + 1) / 4294967297;
}

function sampledSearchVector(vector: Map<number, number>, limit: number, meta: Map<number, Meta>, priorityIds: Set<number>, round: number, allowedSexualIds?: Set<number>) {
  const expanded = expandVectorParents(vector, meta, allowedSexualIds);
  const count = Math.max(1, limit);
  const entries = [...expanded.entries()].sort((a, b) => b[1] - a[1]);
  const candidates = entries.filter(([id]) => !priorityIds.has(id) && !metaIsAutoIgnored(meta.get(id)) && !meta.get(id)?.sexual);
  const seed = entries.map(([id, value]) => `${id}:${value}`).join('|');
  const selected = new Set<number>();
  const pool = [...candidates];
  while (selected.size < count && pool.length) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < pool.length; index += 1) {
      const [id, value] = pool[index];
      const weight = Math.max(value, 0.000001);
      const random = Math.max(stableUnitRandom(seed, `${round}|${selected.size}|${id}`), 0.000001);
      const score = -Math.log(random) / weight;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    selected.add(pool[bestIndex][0]);
    pool.splice(bestIndex, 1);
  }
  if (round <= 0 || candidates.length <= count) for (const [id] of candidates.slice(0, count)) selected.add(id);
  const result = new Map<number, number>();
  for (const [id, value] of entries) if (selected.has(id)) result.set(id, value);
  const topWeight = entries.reduce((max, [, value]) => Math.max(max, value), 1);
  for (const id of priorityIds) if (expanded.has(id)) result.set(id, Math.max(expanded.get(id) ?? 0, topWeight * 2));
  return result;
}

function buildActiveVnProfile(selectedIds: number[], includeSpoiler: boolean, priorityIds: Set<number>, limit: number, round = 0) {
  const selected = selectedIds.map((id) => vnById.get(id)).filter(Boolean) as Vn[];
  if (!selected.length) return new Map<number, number>();
  const direct = mergeVectors(selected.map((vn) => makeVector(vn.tags, tagMeta, 'tag', includeSpoiler, false, priorityIds)));
  return sampledSearchVector(omitUnprioritizedSpecialTags(direct, tagMeta, priorityIds), limit, tagMeta, priorityIds, round, priorityIds);
}

function buildActiveCharacterProfile(selectedIds: number[], includeSpoiler: boolean, priorityIds: Set<number>, limit: number, round = 0) {
  const selected = selectedIds.map((id) => characterById.get(id)).filter(Boolean) as Character[];
  if (!selected.length) return new Map<number, number>();
  const direct = mergeVectors(selected.map((character) => makeVector(character.traits, traitMeta, 'trait', includeSpoiler, false, priorityIds)));
  return sampledSearchVector(direct, limit, traitMeta, priorityIds, round, priorityIds);
}

function priorityMatch(query: Set<number>, candidate: Map<number, number>) {
  let matched = 0;
  for (const id of query) if (candidate.has(id)) matched += 1;
  return matched;
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

function overlap(a: Map<number, number>, b: Map<number, number>) {
  let count = 0;
  for (const id of a.keys()) if (b.has(id)) count += 1;
  return count;
}

function groupedPriorityMatch(groups: MetaSearchGroupRef[], candidate: Map<number, number>) {
  let matched = 0;
  for (const group of groups) if (groupedMetaConfidence([group], candidate) > 0) matched += 1;
  return matched;
}

function groupedMetaConfidence(groups: MetaSearchGroupRef[], candidate: Map<number, number>) {
  if (!groups.length) return 0;
  let confidence = 0;
  for (const group of groups) {
    let best = 0;
    for (const id of group.alternatives) best = Math.max(best, candidate.get(id) ?? 0);
    confidence += Math.min(best, 1);
  }
  return Math.min(confidence / groups.length, 1);
}

function groupedMetaScore(groups: MetaSearchGroupRef[], candidate: Map<number, number>) {
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

function roleAllowed(role: string, filter: CharacterRoleFilter) {
  if (role === 'primary') return filter.primary;
  if (role === 'main') return filter.main;
  if (role === 'side') return filter.side;
  if (role === 'appears') return filter.appears;
  return filter.appears;
}

function characterHasQualifiedVn(character: Character, minVotes: number, roleFilter?: CharacterRoleFilter) {
  return character.vns.some(([id, role]) => (vnById.get(id)?.votes ?? 0) >= minVotes && (!roleFilter || roleAllowed(role, roleFilter)));
}

function characterRoleFilteredVnIds(character: Character, roleFilter: CharacterRoleFilter) {
  return new Set(character.vns.filter(([, role]) => roleAllowed(role, roleFilter)).map(([id]) => id));
}

function characterAverageScore(character: Character) {
  const scores = character.vns.map(([id]) => vnById.get(id)?.average ?? 0).filter((score) => score > 0);
  if (!scores.length) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function vnResultScore(vn: Vn & RecRef) {
  return vn.similarity * 100 + vn.rating / 10 + Math.log10(vn.votes || 1);
}

function characterResultScore(character: Character & RecRef & { consensusBonus?: number; companyBoost?: number }, preferAverage: boolean) {
  return (character.similarity * 100 + (preferAverage ? characterAverageScore(character) / 10 : character.score / 100) + (character.consensusBonus ?? 0) * 0.8) * (character.companyBoost ?? 1);
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

function vnRatingSortScore(vn: Vn & RecRef) {
  return vnResultScore(vn) + vn.rating / 20 + Math.log10(vn.votes || 1) / 5;
}

function vnVotesSortScore(vn: Vn & RecRef) {
  return vnResultScore(vn) + Math.log10(vn.votes || 1) * 0.7 + vn.rating / 40;
}

function characterMaxVotes(character: Character) {
  return Math.max(0, ...character.vns.map(([id]) => vnById.get(id)?.votes ?? 0));
}

function characterRatingSortScore(character: Character & RecRef, preferAverage: boolean) {
  return characterResultScore(character, preferAverage) + characterAverageScore(character) / 20 + Math.log10(characterMaxVotes(character) || 1) / 5;
}

function characterVotesSortScore(character: Character & RecRef, preferAverage: boolean) {
  return characterResultScore(character, preferAverage) + Math.log10(characterMaxVotes(character) || 1) * 0.7 + characterAverageScore(character) / 40;
}

function confidenceSortScore(item: RecRef, baseScore: number) {
  if (!item.priorityTotal) return baseScore;
  return baseScore + item.priorityConfidence * 12 + item.priorityMatched * 2 + item.overlap * 0.1;
}

function mixedResultScore(result: MixedRef, preferAverage: boolean) {
  const vn = vnById.get(result.vnId);
  const character = data?.characters.find((item) => item.id === result.characterId);
  if (!vn || !character) return result.similarity * 100;
  return result.similarity * 100 + vn.rating / 10 + (preferAverage ? characterAverageForMatchedVns(character, new Set([vn.id])) / 10 : character.score / 100);
}

function mixedConfidenceSortScore(result: MixedRef, baseScore: number) {
  if (!result.priorityTotal) return baseScore;
  return baseScore + result.priorityConfidence * 12 + result.priorityMatched * 2;
}

function characterAverageForMatchedVns(character: Character, matchedVnIds: Set<number>) {
  const scores = character.vns.filter(([id]) => matchedVnIds.has(id)).map(([id]) => vnById.get(id)?.average ?? 0).filter((score) => score > 0);
  if (!scores.length) return characterAverageScore(character);
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function sortVnRefs(items: Array<RecRef & Pick<Vn, 'rating' | 'votes'>>, sort: ResultSort, direction: SortDirection) {
  return [...items].sort((a, b) => {
    const leftVn = vnById.get(a.id);
    const rightVn = vnById.get(b.id);
    if (sort === 'title' && leftVn && rightVn) return compareSimilarityBucket(a, b) || sortTextByDirection(itemTitle(leftVn), itemTitle(rightVn), direction) || a.id - b.id;
    const left = sort === 'rating' ? vnRatingSortScore({ ...(leftVn as Vn), ...a }) : sort === 'votes' ? vnVotesSortScore({ ...(leftVn as Vn), ...a }) : sort === 'confidence' ? confidenceSortScore(a, vnResultScore({ ...(leftVn as Vn), ...a })) : vnResultScore({ ...(leftVn as Vn), ...a });
    const right = sort === 'rating' ? vnRatingSortScore({ ...(rightVn as Vn), ...b }) : sort === 'votes' ? vnVotesSortScore({ ...(rightVn as Vn), ...b }) : sort === 'confidence' ? confidenceSortScore(b, vnResultScore({ ...(rightVn as Vn), ...b })) : vnResultScore({ ...(rightVn as Vn), ...b });
    return sortNumberByDirection(left - right, direction) || a.id - b.id;
  });
}

function sortCharacterRefs(items: Array<RecRef & { character: Character; score: number; consensusBonus?: number; companyBoost?: number }>, sort: ResultSort, direction: SortDirection, preferAverage: boolean) {
  return [...items].sort((a, b) => {
    if (sort === 'title') return compareSimilarityBucket(a, b) || sortTextByDirection(itemTitle(a.character), itemTitle(b.character), direction) || a.id - b.id;
    const left = sort === 'rating' ? characterRatingSortScore({ ...a.character, ...a }, preferAverage) : sort === 'votes' ? characterVotesSortScore({ ...a.character, ...a }, preferAverage) : sort === 'confidence' ? confidenceSortScore(a, characterResultScore({ ...a.character, ...a }, preferAverage)) : characterResultScore({ ...a.character, ...a }, preferAverage);
    const right = sort === 'rating' ? characterRatingSortScore({ ...b.character, ...b }, preferAverage) : sort === 'votes' ? characterVotesSortScore({ ...b.character, ...b }, preferAverage) : sort === 'confidence' ? confidenceSortScore(b, characterResultScore({ ...b.character, ...b }, preferAverage)) : characterResultScore({ ...b.character, ...b }, preferAverage);
    return sortNumberByDirection(left - right, direction) || a.id - b.id;
  });
}

function sortMixedRefs(items: MixedRef[], sort: ResultSort, direction: SortDirection, preferAverage: boolean) {
  return [...items].sort((a, b) => {
    const leftVn = vnById.get(a.vnId);
    const rightVn = vnById.get(b.vnId);
    const leftCharacter = data?.characters.find((item) => item.id === a.characterId);
    const rightCharacter = data?.characters.find((item) => item.id === b.characterId);
    if (sort === 'title' && leftVn && rightVn && leftCharacter && rightCharacter) return compareSimilarityBucket(a, b) || sortTextByDirection(`${itemTitle(leftVn)} ${itemTitle(leftCharacter)}`, `${itemTitle(rightVn)} ${itemTitle(rightCharacter)}`, direction) || a.characterId - b.characterId;
    const leftBase = mixedResultScore(a, preferAverage);
    const rightBase = mixedResultScore(b, preferAverage);
    const left = sort === 'rating' ? leftBase + (leftVn?.rating ?? 0) / 20 + Math.log10(leftVn?.votes || 1) / 5 : sort === 'votes' ? leftBase + Math.log10(leftVn?.votes || 1) * 0.7 + (leftVn?.rating ?? 0) / 40 : sort === 'confidence' ? mixedConfidenceSortScore(a, leftBase) : leftBase;
    const right = sort === 'rating' ? rightBase + (rightVn?.rating ?? 0) / 20 + Math.log10(rightVn?.votes || 1) / 5 : sort === 'votes' ? rightBase + Math.log10(rightVn?.votes || 1) * 0.7 + (rightVn?.rating ?? 0) / 40 : sort === 'confidence' ? mixedConfidenceSortScore(b, rightBase) : rightBase;
    return sortNumberByDirection(left - right, direction) || a.characterId - b.characterId;
  });
}

function priorityBucketedResults<T extends RecRef>(candidates: T[], total: number, score: (item: T) => number) {
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

function topRecommendations<T extends RecRef>(candidates: T[], total: number, score: (item: T) => number) {
  return priorityBucketedResults(candidates, total, score);
}

function topTagMatches<T extends RecRef>(candidates: T[], total: number, score: (item: T) => number) {
  if (!total) return [];
  return priorityBucketedResults(candidates, total, score);
}

function characterConsensusBonuses(candidates: Array<{ id: number; vector: Map<number, number> }>, sampleProfiles: Map<number, number>[]) {
  if (!sampleProfiles.length || !candidates.length) return new Map<number, number>();
  const totals = new Map<number, number>();
  for (const profile of sampleProfiles) {
    const ranked = candidates
      .map((candidate) => ({ id: candidate.id, score: vectorScore(profile, candidate.vector) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.id - b.id);
    const denominator = Math.max(1, ranked.length);
    ranked.forEach((candidate, index) => {
      const rankScore = (denominator - index) / denominator;
      totals.set(candidate.id, (totals.get(candidate.id) ?? 0) + rankScore);
    });
  }
  return new Map([...totals.entries()].map(([id, value]) => [id, value / sampleProfiles.length]));
}

function emptyWorkerResultVariant(): WorkerResultVariant {
  return { vnRecommendations: [], characterRecommendations: [], tagSearchVnResults: [], tagSearchCharacterResults: [], mixedTagResults: [] };
}

function profileSignature(profile: Map<number, number>) {
  return [...profile.entries()].sort((a, b) => a[0] - b[0]).map(([id, value]) => `${id}:${value}`).join('|');
}

function aggregateRefs<T extends RecRef>(lists: T[][], score: (item: T) => number) {
  const merged = new Map<number, T & { runs: number }>();
  for (const list of lists) {
    for (const item of list) {
      const current = merged.get(item.id);
      if (!current) merged.set(item.id, { ...item, runs: 1 });
      else {
        current.similarity += item.similarity;
        current.overlap += item.overlap;
        current.priorityMatched += item.priorityMatched;
        current.priorityConfidence += item.priorityConfidence;
        current.runs += 1;
      }
    }
  }
  return [...merged.values()].map((item) => ({
    ...item,
    similarity: item.similarity / item.runs,
    overlap: item.overlap / item.runs,
    priorityMatched: item.priorityMatched / item.runs,
    priorityConfidence: item.priorityConfidence / item.runs
  })).sort((a, b) => score(b as T) - score(a as T)).map(({ runs, ...item }) => item as T);
}

function postProgress(requestId: number, phase: 'randomize' | 'search' | 'fit', current: number, total: number) {
  self.postMessage({ type: 'progress', requestId, phase, current, total });
}

function buildDistinctProfiles(rounds: number, requestId: number, buildProfile: (round: number) => Map<number, number>) {
  const profiles: Map<number, number>[] = [];
  const signatures = new Set<string>();
  for (let round = 0; round < rounds; round += 1) {
    const profile = buildProfile(round);
    if (!profile.size) break;
    const signature = profileSignature(profile);
    if (signatures.has(signature)) break;
    signatures.add(signature);
    profiles.push(profile);
    postProgress(requestId, 'randomize', profiles.length, rounds);
  }
  if (profiles.length < rounds) postProgress(requestId, 'randomize', profiles.length || 1, profiles.length || 1);
  return profiles;
}

function computeVnRecommendations(params: ComputeParams, includeSpoiler: boolean, selectedVnIdSet: Set<number>, selectedVns: Vn[], activePriorityTags: Set<number>, requestId: number): Array<RecRef & Pick<Vn, 'rating' | 'votes'>> {
  if (!params.selectedVnIds.length) return [];
  const rounds = Math.max(1, Math.floor(params.profileSampleRounds || 1));
  const activeVnProfiles = buildDistinctProfiles(rounds, requestId, (round) => buildActiveVnProfile(params.selectedVnIds, includeSpoiler, activePriorityTags, params.tagLimit, round));
  const lists: Array<Array<RecRef & Pick<Vn, 'rating' | 'votes'>>> = [];
  for (let index = 0; index < activeVnProfiles.length; index += 1) {
    const activeVnProfile = activeVnProfiles[index];
    postProgress(requestId, 'search', index + 1, activeVnProfiles.length);
    lists.push(topRecommendations(data!.vns
      .filter((vn) => !selectedVnIdSet.has(vn.id) && vn.votes >= params.minVotes && !isSameCompanyPrefixDuplicate(vn, selectedVns))
      .map((vn) => {
        const vector = omitUnprioritizedSpecialTags(makeVector(vn.tags, tagMeta, 'tag', includeSpoiler, true, activePriorityTags), tagMeta, activePriorityTags);
        const priorityMatched = priorityMatch(activePriorityTags, vector);
        const priorityTotal = activePriorityTags.size;
        const priorityConfidence = priorityTotal ? priorityMatched / priorityTotal : 1;
        const similarity = vectorScore(activeVnProfile, vector) * (priorityTotal ? 0.65 + priorityConfidence * 0.35 : 1);
        return { id: vn.id, similarity, overlap: overlap(activeVnProfile, vector), priorityMatched, priorityTotal, priorityConfidence, rating: vn.rating, votes: vn.votes };
      })
      .filter((vn) => vn.similarity > 0), activePriorityTags.size, (vn) => vn.similarity * 100 + vn.rating / 10 + Math.log10(vn.votes || 1)));
  }
  postProgress(requestId, 'fit', lists.length || 1, lists.length || 1);
  return aggregateRefs(lists, (vn) => vn.similarity * 100 + (vn as RecRef & { rating?: number; votes?: number }).rating! / 10 + Math.log10((vn as RecRef & { votes?: number }).votes || 1));
}

function computeCharacterRecommendations(params: ComputeParams, includeSpoiler: boolean, selectedCharacterIdSet: Set<number>, activePriorityTraits: Set<number>, requestId: number) {
  if (!params.selectedCharacterIds.length) return [];
  const rounds = Math.max(1, Math.floor(params.profileSampleRounds || 1));
  const sampleProfiles = params.selectedCharacterIds
    .map((id) => characterById.get(id))
    .filter(Boolean)
    .map((character) => makeVector((character as Character).traits, traitMeta, 'trait', includeSpoiler, true, activePriorityTraits));
  const activeCharacterProfiles = buildDistinctProfiles(rounds, requestId, (round) => buildActiveCharacterProfile(params.selectedCharacterIds, includeSpoiler, activePriorityTraits, params.traitLimit, round));
  const referenceDeveloperIds = selectedCharacterDeveloperIds(params.selectedCharacterIds);
  const lists: Array<Array<RecRef & { score: number; character: Character; vector: Map<number, number>; consensusBonus?: number; companyBoost?: number }>> = [];
  for (let index = 0; index < activeCharacterProfiles.length; index += 1) {
    const activeCharacterProfile = activeCharacterProfiles[index];
    postProgress(requestId, 'search', index + 1, activeCharacterProfiles.length);
    const candidates = data!.characters
      .filter((character) => !selectedCharacterIdSet.has(character.id) && characterHasQualifiedVn(character, params.minVotes))
      .map((character) => {
        const vector = makeVector(character.traits, traitMeta, 'trait', includeSpoiler, true, activePriorityTraits);
        const priorityMatched = priorityMatch(activePriorityTraits, vector);
        const priorityTotal = activePriorityTraits.size;
        const priorityConfidence = priorityTotal ? priorityMatched / priorityTotal : 1;
        const similarity = vectorScore(activeCharacterProfile, vector) * (priorityTotal ? 0.65 + priorityConfidence * 0.35 : 1);
        const companyBoost = characterCompanyBoost(character, referenceDeveloperIds);
        return { id: character.id, similarity, overlap: overlap(activeCharacterProfile, vector), priorityMatched, priorityTotal, priorityConfidence, score: character.score, character, vector, companyBoost };
      })
      .filter((character) => character.similarity > 0);
    const consensusBonuses = characterConsensusBonuses(candidates, sampleProfiles);
    lists.push(topRecommendations(candidates.map((character) => ({ ...character, consensusBonus: consensusBonuses.get(character.id) ?? 0 })), activePriorityTraits.size, (character) => characterResultScore({ ...character.character, ...character }, params.preferCharacterAverage)));
  }
  postProgress(requestId, 'fit', lists.length || 1, lists.length || 1);
  return aggregateRefs(lists, (character) => characterResultScore({ ...(character as RecRef & { character?: Character }).character!, ...character }, params.preferCharacterAverage));
}

function computeVariant(params: ComputeParams, includeSpoiler: boolean, requestId: number): WorkerResultVariant {
  if (!data) return emptyWorkerResultVariant();
  const selectedVnIdSet = new Set(params.selectedVnIds);
  const selectedCharacterIdSet = new Set(params.selectedCharacterIds);
  const selectedVns = params.selectedVnIds.map((id) => vnById.get(id)).filter(Boolean) as Vn[];
  const activePriorityTags = new Set(params.activePriorityTags);
  const activePriorityTraits = new Set(params.activePriorityTraits);
  const tagSearchTagGroups = includeSpoiler ? params.tagSearchTagGroupsSpoilerOn : params.tagSearchTagGroupsSpoilerOff;
  const tagSearchTraitGroups = includeSpoiler ? params.tagSearchTraitGroupsSpoilerOn : params.tagSearchTraitGroupsSpoilerOff;
  const tagSearchTagAlternativeIds = new Set(params.tagSearchTags);
  for (const group of tagSearchTagGroups) for (const id of group.alternatives) tagSearchTagAlternativeIds.add(id);
  const tagSearchSexualTagIds = new Set(includeSpoiler ? params.tagSearchSexualTagIdsSpoilerOn : params.tagSearchSexualTagIdsSpoilerOff);
  const tagSearchSexualTraitIds = new Set(includeSpoiler ? params.tagSearchSexualTraitIdsSpoilerOn : params.tagSearchSexualTraitIdsSpoilerOff);

  const vnRecommendations = computeVnRecommendations(params, includeSpoiler, selectedVnIdSet, selectedVns, activePriorityTags, requestId);
  const characterRecommendations = computeCharacterRecommendations(params, includeSpoiler, selectedCharacterIdSet, activePriorityTraits, requestId);

  const tagSearchIndex = includeSpoiler ? tagSearchIndexSpoilerOn : tagSearchIndexSpoilerOff;
  const tagSearchVnCandidates = !tagSearchTagGroups.length || !tagSearchIndex ? [] : [...collectCandidateIndexes(tagSearchTagGroups, tagSearchIndex.postings)]
    .map((index) => {
      const vn = data!.vns[index];
      if (vn.votes < params.minVotes) return null;
      const vector = omitUnprioritizedSpecialTags(tagSearchIndex.vectors[index], tagMeta, tagSearchTagAlternativeIds);
      const priorityMatched = groupedPriorityMatch(tagSearchTagGroups, vector);
      const priorityTotal = tagSearchTagGroups.length;
      const priorityConfidence = groupedMetaConfidence(tagSearchTagGroups, vector);
      const similarity = groupedMetaScore(tagSearchTagGroups, vector) * (0.65 + priorityConfidence * 0.35);
      return similarity > 0 ? { id: vn.id, similarity, overlap: priorityMatched, priorityMatched, priorityTotal, priorityConfidence, rating: vn.rating, votes: vn.votes } : null;
    })
    .filter(Boolean)
    .map((vn) => vn as RecRef & { rating: number; votes: number });

  const tagSearchVnResults = topTagMatches(tagSearchVnCandidates, tagSearchTagGroups.length, (vn) => vn.similarity * 100 + vn.rating / 10 + Math.log10(vn.votes || 1));

  const traitSearchIndex = includeSpoiler ? traitSearchIndexSpoilerOn : traitSearchIndexSpoilerOff;
  const tagSearchCharacterCandidates = !tagSearchTraitGroups.length || !traitSearchIndex ? [] : [...collectCandidateIndexes(tagSearchTraitGroups, traitSearchIndex.postings)]
    .map((index) => {
      const character = data!.characters[index];
      if (!characterHasQualifiedVn(character, params.minVotes, params.tagRoleFilter)) return null;
      const vector = traitSearchIndex.vectors[index];
      const priorityMatched = groupedPriorityMatch(tagSearchTraitGroups, vector);
      const priorityTotal = tagSearchTraitGroups.length;
      const priorityConfidence = groupedMetaConfidence(tagSearchTraitGroups, vector);
      const similarity = groupedMetaScore(tagSearchTraitGroups, vector) * (0.65 + priorityConfidence * 0.35);
      return similarity > 0 ? { id: character.id, similarity, overlap: priorityMatched, priorityMatched, priorityTotal, priorityConfidence, score: character.score, character } : null;
    })
    .filter(Boolean)
    .map((character) => character as RecRef & { score: number; character: Character });

  const tagSearchCharacterResults = topTagMatches(tagSearchCharacterCandidates, tagSearchTraitGroups.length, (character) => character.similarity * 100 + (params.preferCharacterAverage ? characterAverageScore(character.character) / 10 : character.score / 100));

  const mixedTagResults: MixedRef[] = (() => {
    if (!params.tagSearchTags.length || !params.tagSearchTraits.length) return [];
    const vnMatches = new Map(tagSearchVnCandidates.filter((vn) => vn.priorityMatched === vn.priorityTotal).map((vn) => [vn.id, vn]));
    if (!vnMatches.size) return [];
    return tagSearchCharacterCandidates
      .filter((character) => character.priorityMatched === character.priorityTotal)
      .map((character) => {
        const source = data?.characters.find((item) => item.id === character.id);
        if (!source) return null;
        const vn = [...characterRoleFilteredVnIds(source, params.tagRoleFilter)].map((id) => vnMatches.get(id)).filter(Boolean).sort((a, b) => (a as RecRef).id - (b as RecRef).id)[0];
        return vn ? { vnId: vn.id, characterId: character.id, similarity: (vn.similarity + character.similarity) / 2, priorityMatched: vn.priorityMatched + character.priorityMatched, priorityTotal: vn.priorityTotal + character.priorityTotal, priorityConfidence: (vn.priorityConfidence * vn.priorityTotal + character.priorityConfidence * character.priorityTotal) / (vn.priorityTotal + character.priorityTotal) } : null;
      })
      .filter(Boolean)
      .map((result) => result as MixedRef)
      .sort((a, b) => b.similarity - a.similarity);
  })();

  const sortedVnRecommendations = sortVnRefs(vnRecommendations, params.resultSort, params.sortDirection);
  const sortedCharacterRecommendations = sortCharacterRefs(characterRecommendations, params.resultSort, params.sortDirection, params.preferCharacterAverage);
  const sortedTagSearchVnResults = sortVnRefs(tagSearchVnResults, params.resultSort, params.sortDirection);
  const sortedTagSearchCharacterResults = sortCharacterRefs(tagSearchCharacterResults, params.resultSort, params.sortDirection, params.preferCharacterAverage);
  const sortedMixedTagResults = sortMixedRefs(mixedTagResults, params.resultSort, params.sortDirection, params.preferCharacterAverage);

  return {
    vnRecommendations: sortedVnRecommendations.map(({ id, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence }) => ({ id, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence })),
    characterRecommendations: sortedCharacterRecommendations.map(({ id, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence }) => ({ id, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence })),
    tagSearchVnResults: sortedTagSearchVnResults.map(({ id, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence }) => ({ id, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence })),
    tagSearchCharacterResults: sortedTagSearchCharacterResults.map(({ id, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence }) => ({ id, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence })),
    mixedTagResults: sortedMixedTagResults
  };
}

function compute(params: ComputeParams, requestId: number): WorkerResult {
  const variant = computeVariant(params, params.includeSpoiler, requestId);
  return params.includeSpoiler ? { spoilerOff: emptyWorkerResultVariant(), spoilerOn: variant } : { spoilerOff: variant, spoilerOn: emptyWorkerResultVariant() };
}

self.onmessage = (event: MessageEvent<WorkerInput>) => {
  if (event.data.type === 'init') {
    data = event.data.data;
    tagMeta = new Map(data.tags.map((tag) => [tag.id, tag]));
    traitMeta = new Map(data.traits.map((trait) => [trait.id, trait]));
    vnById = new Map(data.vns.map((vn) => [vn.id, vn]));
    characterById = new Map(data.characters.map((character) => [character.id, character]));
    tagSearchIndexSpoilerOff = buildTagSearchIndex(false);
    tagSearchIndexSpoilerOn = buildTagSearchIndex(true);
    traitSearchIndexSpoilerOff = buildTraitSearchIndex(false);
    traitSearchIndexSpoilerOn = buildTraitSearchIndex(true);
    self.postMessage({ type: 'ready' });
    return;
  }
  try {
    self.postMessage({ type: 'result', requestId: event.data.requestId, result: compute(event.data.params, event.data.requestId) });
  } catch (reason) {
    self.postMessage({ type: 'error', requestId: event.data.requestId, error: String(reason) });
  }
};

export {};