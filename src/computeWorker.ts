type Pair = [number, number, number, number];
type TraitPair = [number, number, number];
type VnRelation = [number, string, number];
type Producer = { id: number; name: string; nameEncoded?: boolean; original: string | null; originalEncoded?: boolean; type: string; lang: string };
type Vn = { id: number; title: string; titleEncoded?: boolean; original: string | null; originalEncoded?: boolean; olang: string | null; rating: number; average: number; votes: number; image: string | null; aliases: string; aliasesEncoded?: boolean; developers: Producer[]; publishers: Producer[]; search: string; searchEncoded?: boolean; tags: Pair[]; relations: VnRelation[] };
type Character = { id: number; name: string; nameEncoded?: boolean; original: string | null; originalEncoded?: boolean; image: string | null; sex: string | null; gender: string | null; blood: string | null; birthday: string | null; bust: number | null; waist: number | null; hip: number | null; score: number; search: string; searchEncoded?: boolean; aliases: string[]; aliasesEncoded?: boolean; vns: [number, string, number][]; traits: TraitPair[] };
type Meta = { id: number; cat?: string; group?: number | null; defaultspoil?: number; sexual: boolean; tech?: boolean; searchable: boolean; applicable: boolean; name: string; nameEncoded: boolean; parents?: number[]; blocked?: boolean };
type Data = { generatedAt: string; source: string; limits: Record<string, number>; stats: Record<string, number>; vns: Vn[]; characters: Character[]; tags: Meta[]; traits: Meta[] };
type CharacterRoleFilter = { primary: boolean; main: boolean; side: boolean; appears: boolean };
type ResultSort = 'relevance' | 'rating' | 'votes' | 'title' | 'confidence';
type SortDirection = 'desc' | 'asc';
type RecRef = { id: number; similarity: number; overlap: number; priorityMatched: number; priorityTotal: number; priorityConfidence: number };
type MixedRef = { vnId: number; characterId: number; similarity: number; priorityMatched: number; priorityTotal: number; priorityConfidence: number };
type MetaSearchGroupRef = { selectedId: number; alternatives: number[] };
type WorkerResultVariant = { vnRecommendations: RecRef[]; characterRecommendations: RecRef[]; tagSearchVnResults: RecRef[]; tagSearchCharacterResults: RecRef[]; mixedTagResults: MixedRef[] };
type WorkerResult = { spoilerOff: WorkerResultVariant; spoilerOn: WorkerResultVariant };
type ComputeParams = {
  selectedVnIds: number[];
  selectedCharacterIds: number[];
  activeVnProfileSpoilerOff: [number, number][];
  activeVnProfileSpoilerOn: [number, number][];
  activeCharacterProfileSpoilerOff: [number, number][];
  activeCharacterProfileSpoilerOn: [number, number][];
  activePriorityTags: number[];
  activePriorityTraits: number[];
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

function characterResultScore(character: Character & RecRef & { consensusBonus?: number }, preferAverage: boolean) {
  return character.similarity * 100 + (preferAverage ? characterAverageScore(character) / 10 : character.score / 100) + (character.consensusBonus ?? 0) * 0.8;
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

function sortCharacterRefs(items: Array<RecRef & { character: Character; score: number; consensusBonus?: number }>, sort: ResultSort, direction: SortDirection, preferAverage: boolean) {
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

function computeVariant(params: ComputeParams, includeSpoiler: boolean): WorkerResultVariant {
  if (!data) return emptyWorkerResultVariant();
  const selectedVnIdSet = new Set(params.selectedVnIds);
  const selectedCharacterIdSet = new Set(params.selectedCharacterIds);
  const selectedVns = params.selectedVnIds.map((id) => vnById.get(id)).filter(Boolean) as Vn[];
  const activeVnProfile = new Map(includeSpoiler ? params.activeVnProfileSpoilerOn : params.activeVnProfileSpoilerOff);
  const activeCharacterProfile = new Map(includeSpoiler ? params.activeCharacterProfileSpoilerOn : params.activeCharacterProfileSpoilerOff);
  const activePriorityTags = new Set(params.activePriorityTags);
  const activePriorityTraits = new Set(params.activePriorityTraits);
  const tagSearchTagGroups = includeSpoiler ? params.tagSearchTagGroupsSpoilerOn : params.tagSearchTagGroupsSpoilerOff;
  const tagSearchTraitGroups = includeSpoiler ? params.tagSearchTraitGroupsSpoilerOn : params.tagSearchTraitGroupsSpoilerOff;
  const tagSearchTagAlternativeIds = new Set(params.tagSearchTags);
  for (const group of tagSearchTagGroups) for (const id of group.alternatives) tagSearchTagAlternativeIds.add(id);
  const tagSearchSexualTagIds = new Set(includeSpoiler ? params.tagSearchSexualTagIdsSpoilerOn : params.tagSearchSexualTagIdsSpoilerOff);
  const tagSearchSexualTraitIds = new Set(includeSpoiler ? params.tagSearchSexualTraitIdsSpoilerOn : params.tagSearchSexualTraitIdsSpoilerOff);

  const vnRecommendations = (!params.selectedVnIds.length || !activeVnProfile.size) ? [] : topRecommendations(data.vns
    .filter((vn) => !selectedVnIdSet.has(vn.id) && vn.votes >= params.minVotes && !isSameCompanyPrefixDuplicate(vn, selectedVns))
    .map((vn) => {
      const vector = omitUnprioritizedSpecialTags(makeVector(vn.tags, tagMeta, 'tag', includeSpoiler, true, activePriorityTags), tagMeta, activePriorityTags);
      const priorityMatched = priorityMatch(activePriorityTags, vector);
      const priorityTotal = activePriorityTags.size;
      const priorityConfidence = priorityTotal ? priorityMatched / priorityTotal : 1;
      const similarity = vectorScore(activeVnProfile, vector) * (priorityTotal ? 0.65 + priorityConfidence * 0.35 : 1);
      return { id: vn.id, similarity, overlap: overlap(activeVnProfile, vector), priorityMatched, priorityTotal, priorityConfidence, rating: vn.rating, votes: vn.votes };
    })
    .filter((vn) => vn.similarity > 0), activePriorityTags.size, (vn) => vn.similarity * 100 + vn.rating / 10 + Math.log10(vn.votes || 1));

  const characterRecommendations = (!params.selectedCharacterIds.length || !activeCharacterProfile.size) ? [] : (() => {
    const sampleProfiles = params.selectedCharacterIds
      .map((id) => data?.characters.find((character) => character.id === id))
      .filter(Boolean)
      .map((character) => makeVector((character as Character).traits, traitMeta, 'trait', includeSpoiler, true, activePriorityTraits));
    const candidates = data.characters
      .filter((character) => !selectedCharacterIdSet.has(character.id) && characterHasQualifiedVn(character, params.minVotes))
      .map((character) => {
        const vector = makeVector(character.traits, traitMeta, 'trait', includeSpoiler, true, activePriorityTraits);
        const priorityMatched = priorityMatch(activePriorityTraits, vector);
        const priorityTotal = activePriorityTraits.size;
        const priorityConfidence = priorityTotal ? priorityMatched / priorityTotal : 1;
        const similarity = vectorScore(activeCharacterProfile, vector) * (priorityTotal ? 0.65 + priorityConfidence * 0.35 : 1);
        return { id: character.id, similarity, overlap: overlap(activeCharacterProfile, vector), priorityMatched, priorityTotal, priorityConfidence, score: character.score, character, vector };
      })
      .filter((character) => character.similarity > 0);
    const consensusBonuses = characterConsensusBonuses(candidates, sampleProfiles);
    return topRecommendations(candidates.map((character) => ({ ...character, consensusBonus: consensusBonuses.get(character.id) ?? 0 })), activePriorityTraits.size, (character) => character.similarity * 100 + (params.preferCharacterAverage ? characterAverageScore(character.character) / 10 : character.score / 100) + (character.consensusBonus ?? 0) * 0.8);
  })();

  const tagSearchVnCandidates = !tagSearchTagGroups.length ? [] : data.vns
    .filter((vn) => vn.votes >= params.minVotes)
    .map((vn) => {
      const vector = omitUnprioritizedSpecialTags(makeVector(vn.tags, tagMeta, 'tag', includeSpoiler, true, tagSearchSexualTagIds, true), tagMeta, tagSearchTagAlternativeIds);
      const priorityMatched = groupedPriorityMatch(tagSearchTagGroups, vector);
      const priorityTotal = tagSearchTagGroups.length;
      const priorityConfidence = groupedMetaConfidence(tagSearchTagGroups, vector);
      const similarity = groupedMetaScore(tagSearchTagGroups, vector) * (0.65 + priorityConfidence * 0.35);
      return { id: vn.id, similarity, overlap: priorityMatched, priorityMatched, priorityTotal, priorityConfidence, rating: vn.rating, votes: vn.votes };
    })
    .filter((vn) => vn.similarity > 0);

  const tagSearchVnResults = topTagMatches(tagSearchVnCandidates, tagSearchTagGroups.length, (vn) => vn.similarity * 100 + vn.rating / 10 + Math.log10(vn.votes || 1));

  const tagSearchCharacterCandidates = !tagSearchTraitGroups.length ? [] : data.characters
    .filter((character) => characterHasQualifiedVn(character, params.minVotes, params.tagRoleFilter))
    .map((character) => {
      const vector = makeVector(character.traits, traitMeta, 'trait', includeSpoiler, true, tagSearchSexualTraitIds);
      const priorityMatched = groupedPriorityMatch(tagSearchTraitGroups, vector);
      const priorityTotal = tagSearchTraitGroups.length;
      const priorityConfidence = groupedMetaConfidence(tagSearchTraitGroups, vector);
      const similarity = groupedMetaScore(tagSearchTraitGroups, vector) * (0.65 + priorityConfidence * 0.35);
      return { id: character.id, similarity, overlap: priorityMatched, priorityMatched, priorityTotal, priorityConfidence, score: character.score, character };
    })
    .filter((character) => character.similarity > 0);

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

function compute(params: ComputeParams): WorkerResult {
  return { spoilerOff: computeVariant(params, false), spoilerOn: computeVariant(params, true) };
}

self.onmessage = (event: MessageEvent<WorkerInput>) => {
  if (event.data.type === 'init') {
    data = event.data.data;
    tagMeta = new Map(data.tags.map((tag) => [tag.id, tag]));
    traitMeta = new Map(data.traits.map((trait) => [trait.id, trait]));
    vnById = new Map(data.vns.map((vn) => [vn.id, vn]));
    self.postMessage({ type: 'ready' });
    return;
  }
  try {
    self.postMessage({ type: 'result', requestId: event.data.requestId, result: compute(event.data.params) });
  } catch (reason) {
    self.postMessage({ type: 'error', requestId: event.data.requestId, error: String(reason) });
  }
};

export {};