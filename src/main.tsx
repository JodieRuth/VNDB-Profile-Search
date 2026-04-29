import React, { Component, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import './styles.css';

type Pair = [number, number, number, number, number?];
type TraitPair = [number, number, number];
type VnRelation = [number, VnRelationType, number];
type VnRelationType = 'seq' | 'preq' | 'set' | 'alt' | 'char' | 'side' | 'par' | 'ser' | 'fan' | 'orig' | string;
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
  buildDateUtc8?: string;
  source: string;
  limits: Record<string, number>;
  stats: Record<string, number>;
  usageIndex?: {
    directTagVns?: [number, number[]][];
    directTagVnsNoSpoiler?: [number, number[]][];
    directTraitCharacters?: [number, number[]][];
    directTraitCharactersNoSpoiler?: [number, number[]][];
  };
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
type WorkerResultVariant = { vnRecommendations: RecommendationRef[]; characterRecommendations: RecommendationRef[]; tagSearchVnResults: RecommendationRef[]; tagSearchCharacterResults: RecommendationRef[]; mixedTagResults: MixedTagRef[] };
type WorkerResult = { spoilerOff: WorkerResultVariant; spoilerOn: WorkerResultVariant };
type WorkerProgressPhase = 'randomize' | 'search' | 'fit';
type WorkerProgress = { phase: WorkerProgressPhase; current: number; total: number };
type WorkerProgressState = Partial<Record<WorkerProgressPhase, { current: number; total: number }>>;
type MetaSearchGroup = { selectedId: number; alternatives: Set<number> };
type MetaFilterClass = 'sexual' | 'spoiler' | 'blocked' | 'technical' | 'normal';
type DataManifest = { dataPath?: string; path?: string; sha256?: string; generatedAt?: string; buildDateUtc8?: string; size?: number };
type LoadStageKey = 'loadingStageReady' | 'loadingStageReadManifest' | 'loadingStagePrepareDownload' | 'loadingStageCompressedDownloadComplete' | 'loadingStageDownloadGzip' | 'loadingStageReadPlainText' | 'loadingStageDecompressGzip' | 'loadingStageParseJsonPrepare' | 'loadingStageParseJson' | 'loadingStageDecodeFields' | 'loadingStageRestoreState' | 'loadingStageCommitData' | 'loadingStagePrepareIndex' | 'loadingStageComplete' | 'errorRenderMain' | 'errorRuntime';
type LoadProgressDetail = { loaded: number; total: number; speed: number };
type LoadState = { progress: number; stage: LoadStageKey; detail?: LoadProgressDetail | null };
type LoadProgressUpdate = { progress: number; stage: LoadStageKey; detail?: LoadProgressDetail | null };
type LoadError = { message: string; stack?: string; stage: LoadStageKey | string; progress: number; detail?: LoadProgressDetail | null };
type PersistedState = {
  version: number;
  mode: Mode;
  vnQuery: string;
  characterQuery: string;
  vnSubmittedQuery: string;
  characterSubmittedQuery: string;
  selectedVnIds: number[];
  selectedCharacterIds: number[];
  showSexual: boolean;
  showSpoiler: boolean;
  showBlockedTags: boolean;
  showTechnicalTags: boolean;
  metaLanguage: MetaLanguage;
  uiLanguage: UiLanguage;
  minVotes: number;
  tagLimit: number;
  traitLimit: number;
  profileSampleRounds: number;
  preferCharacterAverage: boolean;
  tagRoleFilter: CharacterRoleFilter;
  resultSort: ResultSort;
  sortDirection: SortDirection;
  darkMode: boolean;
  resultPage: number;
  localSearchPage: number;
  priorityTagIds: number[];
  priorityTraitIds: number[];
  tagSearchTagIds: number[];
  tagSearchTraitIds: number[];
};
type MetaSelectorPersistedState = { query: string; openNodeIds: number[]; openGroupLabels: string[]; scrollTop: number; height: number };

const REPOSITORY_URL = 'https://github.com/JodieRuth/VNDB-Profile-Search';
const README_URL = `${REPOSITORY_URL}#readme`;
const ISSUE_URL = `${REPOSITORY_URL}/issues/new`;
const GITHUB_REPO_API = 'https://api.github.com/repos/JodieRuth/VNDB-Profile-Search';
const DATA_MANIFEST_PATH = './data/manifest.json';
const STORAGE_KEY = 'vndb-profile-search-state-v1';
const META_SELECTOR_STORAGE_PREFIX = 'vndb-profile-search-meta-selector-v1';
const PERSISTED_STATE_VERSION = 1;
const TAG_TREE_GROUP_ROOT_IDS = new Set([1, 20, 22, 24, 674]);
const emptyWorkerResultVariant = (): WorkerResultVariant => ({ vnRecommendations: [], characterRecommendations: [], tagSearchVnResults: [], tagSearchCharacterResults: [], mixedTagResults: [] });
const emptyWorkerResult = (): WorkerResult => ({ spoilerOff: emptyWorkerResultVariant(), spoilerOn: emptyWorkerResultVariant() });

const UI_TEXT: Record<UiLanguage, Record<string, string>> = {
  zh: {
    source: '基于 VNDB 数据源',
    themeDark: '切换黑夜模式',
    themeLight: '切换白天模式',
    vnMode: 'VN 检索',
    characterMode: '角色检索',
    tagMode: '标签检索',
    showR18: '显示 R18 标签名',
    allowSpoiler: '允许剧透标签',
    metaLanguage: 'tag/traits',
    uiLanguage: '语言',
    searchVn: '搜索 VN',
    searchCharacter: '搜索角色',
    searchLocal: '搜索本地索引',
    localResults: '本地搜索结果',
    selectedSamples: '已选参考条目',
    profile: '合成画像',
    vnRecommendations: '相似 VN 推荐',
    characterRecommendations: '相似角色推荐',
    tagResults: 'tag/traits 检索结果',
    candidates: '候选数量',
    perPage: '每页',
    currentPage: '当前第',
    page: '页',
    sort: '排序',
    direction: '方向',
    minVotes: '最低票数',
    profileSampleRounds: '搜索次数',
    tagLimit: '搜索前 N 个 tag',
    traitLimit: '搜索前 N 个 trait',
    preferAverage: '按关联 VN 平均分加权',
    roleType: '角色类型',
    characterAppearances: '登场作品',
    relatedVns: '相关作品',
    noRecommendationResults: '没有找到符合当前条件的候选结果。请尝试降低最低票数、放宽角色类型，或减少重点 tag/trait 后重新查看。',
    primary: '主要角色',
    main: '核心角色',
    side: '次要角色/配角',
    appears: '仅登场/提及',
    previous: '上一页',
    next: '下一页',
    previousItem: '上一个',
    nextItem: '下一个',
    loadPage: '启动搜索',
    choosePage: '请设置条件后点击启动搜索。',
    license: 'VNDB 数据遵循 VNDB Data License（Open Database License / Database Contents License）；图片与外部详情仍以 VNDB 原站记录为准。',
    relevance: '相关值',
    confidence: '置信度',
    rating: 'VN rating',
    votes: '投票数',
    title: '标题',
    desc: '上到下',
    asc: '下到上',
    clear: '清空',
    collapseAll: '收起所有',
    tagPanelTitle: 'VN tag',
    traitPanelTitle: '角色 traits',
    tagPanelDesc: '选择作品 tag；与角色 traits 同时选择时输出作品 + 角色组合。',
    traitPanelDesc: '选择角色 trait；与 VN tag 同时选择时输出作品 + 角色组合。',
    tagFilter: '检索 VN tag',
    traitFilter: '检索角色 trait',
    showBlockedTags: '显示 Character/Scene 标签',
    showTechnicalTags: '显示技术性标签',
    loading: '正在加载本地 VNDB 索引……',
    computing: '正在计算候选结果……',
    randomizingProfile: '正在随机化画像……',
    fittingResults: '正在拟合搜索结果……',
    selectedMeta: '已选中',
    parentMeta: '父级',
    projectLinks: '项目链接',
    readmeTitle: '使用说明',
    githubStarFallback: 'Star',
    githubStarHelp: '如果这个项目对你有帮助，请考虑点个 star',
    statsVn: 'VN',
    statsCharacters: '角色',
    statsMeta: '标签数量',
    statsProducers: '厂商',
    metaLanguageLabel: 'tag/trait 显示语言',
    uiLanguageLabel: '语言设置',
    dataLastUpdated: '数据最后更新时间',
    resizeListHeight: '拖动调整列表高度',
    resizeListHeightHelp: '拖动上方按钮可调整高度',
    loadingDetailLoaded: '已获取',
    loadingDetailTotal: '总大小',
    loadingDetailSpeed: '速度',
    loadingUnknown: '未知',
    loadingCalculating: '计算中',
    loadingStageReady: '准备加载本地 VNDB 索引',
    loadingStageReadManifest: '读取数据清单',
    loadingStagePrepareDownload: '准备下载压缩数据',
    loadingStageCompressedDownloadComplete: '压缩数据下载完成',
    loadingStageDownloadGzip: '下载 gzip 压缩数据',
    loadingStageReadPlainText: '读取未压缩数据文本',
    loadingStageDecompressGzip: '解压 gzip 数据',
    loadingStageParseJsonPrepare: '解压完成，准备解析 JSON',
    loadingStageParseJson: '解析 JSON 数据',
    loadingStageDecodeFields: '解码压缩字段与多语言文本',
    loadingStageRestoreState: '恢复上次选择与筛选状态',
    loadingStageCommitData: '提交数据并初始化界面',
    loadingStagePrepareIndex: '准备本地索引与搜索界面',
    loadingStageComplete: '加载完成',
    errorTitle: '加载失败',
    errorDescription: '网页在加载本地 VNDB 索引时发生错误。你可以先尝试刷新页面；如果问题持续出现，请提交 issue，并附上下面的错误信息。',
    errorReload: '刷新页面',
    errorSubmitIssue: '提交 issue',
    errorStage: '失败阶段',
    errorProgress: '加载进度',
    errorLoaded: '已获取',
    errorTotal: '总大小',
    errorSpeed: '下载速度',
    errorRenderMain: '渲染主界面',
    errorRuntime: '网页运行时',
    errorUnsupportedGzip: '当前浏览器不支持 gzip 解压',
    errorDataManifestPathMissing: '数据清单缺少数据文件路径',
    errorDataFileReadFailed: '数据文件读取失败',
    r18Hidden: 'R18 已隐藏',
    addSample: '加入参考',
    remove: '移除',
    producers: '厂商',
    detailsLoading: '详情加载中',
    detailsFailed: '详情失败',
    similarity: '相似',
    overlap: '重合',
    priorityConfidence: '重点置信',
    associationScore: '关联分',
    vnAverage: 'VN均分',
    averageWeighted: '均分加权',
    combinedSimilarity: '组合相似',
    metaCategoryContent: '内容',
    metaCategoryTechnical: '技术',
    metaCategoryOther: '其他',
    metaCategoryContentTooltip: '作品内容相关标签，用于描述题材、设定、剧情元素与表现形式。',
    metaCategoryR18Tooltip: 'R18 相关标签。默认仅用于展示，不参与搜索；只有被选为重点标签时才参与搜索。',
    metaCategoryTechnicalTooltip: '技术性标签。默认仅展示，不参与搜索；只有被选为重点标签时才参与搜索。',
    metaCategoryOtherTooltip: '其他未归入主要分类的标签。'
  },
  ja: {
    source: 'VNDB データソースに基づく',
    themeDark: 'ダークモードへ',
    themeLight: 'ライトモードへ',
    vnMode: 'VN検索',
    characterMode: 'キャラクター検索',
    tagMode: 'タグ検索',
    showR18: 'R18 タグ名',
    allowSpoiler: 'ネタバレ許可',
    metaLanguage: 'tag/traits',
    uiLanguage: '言語',
    searchVn: 'VN を検索',
    searchCharacter: 'キャラクターを検索',
    searchLocal: 'ローカル検索',
    localResults: 'ローカル検索結果',
    selectedSamples: '選択中の参考項目',
    profile: '合成プロファイル',
    vnRecommendations: '類似 VN 推薦',
    characterRecommendations: '類似キャラクター推薦',
    tagResults: 'tag/traits 検索結果',
    candidates: '候補数',
    perPage: '1ページ',
    currentPage: '現在',
    page: 'ページ',
    sort: 'ソート',
    direction: '方向',
    minVotes: '最低票数',
    profileSampleRounds: '検索回数',
    tagLimit: '検索 tag 数',
    traitLimit: '検索 trait 数',
    preferAverage: '関連 VN 平均点で重み付け',
    roleType: '役割',
    characterAppearances: '登場作品',
    relatedVns: '関連作品',
    noRecommendationResults: '現在の条件に一致する候補は見つかりませんでした。最低投票数、役割条件、重点 tag/trait を緩めてから再確認してください。',
    primary: '主要キャラクター',
    main: '中核キャラクター',
    side: '副次キャラクター/脇役',
    appears: '登場/言及のみ',
    previous: '前へ',
    next: '次へ',
    previousItem: '前の項目',
    nextItem: '次の項目',
    loadPage: '検索開始',
    choosePage: '条件を設定して検索開始を押してください。',
    license: 'VNDB データは VNDB Data License（Open Database License / Database Contents License）に従います。画像と外部詳細は VNDB 原本を基準とします。',
    relevance: '関連度',
    confidence: '信頼度',
    rating: 'VN rating',
    votes: '投票数',
    title: 'タイトル',
    desc: '降順',
    asc: '昇順',
    clear: 'クリア',
    collapseAll: 'すべて閉じる',
    tagPanelTitle: 'VN tag',
    traitPanelTitle: 'キャラクター traits',
    tagPanelDesc: '作品 tag を選択します。キャラクター traits と同時に選ぶと VN + キャラクターの組み合わせを出力します。',
    traitPanelDesc: 'キャラクター trait を選択します。VN tag と同時に選ぶと VN + キャラクターの組み合わせを出力します。',
    tagFilter: 'VN tag を検索',
    traitFilter: 'キャラクター trait を検索',
    showBlockedTags: 'Character/Scene tag',
    showTechnicalTags: 'technical tag',
    loading: 'ローカル VNDB 索引を読み込み中……',
    computing: '候補を計算中……',
    randomizingProfile: '画像をランダム化中……',
    fittingResults: '検索結果をフィット中……',
    selectedMeta: '選択中',
    parentMeta: '親',
    projectLinks: 'プロジェクトリンク',
    readmeTitle: '使い方',
    githubStarFallback: 'Star',
    githubStarHelp: 'このプロジェクトが役に立った場合は star をご検討ください',
    statsVn: 'VN',
    statsCharacters: 'キャラクター',
    statsMeta: 'タグ数',
    statsProducers: '制作者',
    metaLanguageLabel: 'tag/trait 表示言語',
    uiLanguageLabel: '言語設定',
    dataLastUpdated: 'データ最終更新時刻',
    resizeListHeight: 'ドラッグしてリストの高さを調整',
    resizeListHeightHelp: '上のボタンをドラッグして高さを調整できます',
    loadingDetailLoaded: '取得済み',
    loadingDetailTotal: '合計サイズ',
    loadingDetailSpeed: '速度',
    loadingUnknown: '不明',
    loadingCalculating: '計算中',
    loadingStageReady: 'ローカル VNDB 索引の読み込みを準備中',
    loadingStageReadManifest: 'データマニフェストを読み込み中',
    loadingStagePrepareDownload: '圧縮データのダウンロードを準備中',
    loadingStageCompressedDownloadComplete: '圧縮データのダウンロードが完了しました',
    loadingStageDownloadGzip: 'gzip 圧縮データをダウンロード中',
    loadingStageReadPlainText: '未圧縮データテキストを読み込み中',
    loadingStageDecompressGzip: 'gzip データを解凍中',
    loadingStageParseJsonPrepare: '解凍完了、JSON 解析を準備中',
    loadingStageParseJson: 'JSON データを解析中',
    loadingStageDecodeFields: '圧縮フィールドと多言語テキストをデコード中',
    loadingStageRestoreState: '前回の選択とフィルター状態を復元中',
    loadingStageCommitData: 'データを反映して画面を初期化中',
    loadingStagePrepareIndex: 'ローカル索引と検索画面を準備中',
    loadingStageComplete: '読み込み完了',
    errorTitle: '読み込みに失敗しました',
    errorDescription: 'ローカル VNDB 索引の読み込み中にエラーが発生しました。まずページの再読み込みを試してください。問題が続く場合は、下のエラー情報を添えて issue を作成してください。',
    errorReload: 'ページを再読み込み',
    errorSubmitIssue: 'issue を作成',
    errorStage: '失敗した段階',
    errorProgress: '読み込み進捗',
    errorLoaded: '取得済み',
    errorTotal: '合計サイズ',
    errorSpeed: 'ダウンロード速度',
    errorRenderMain: 'メイン画面を描画中',
    errorRuntime: 'ページ実行時',
    errorUnsupportedGzip: '現在のブラウザーは gzip 解凍に対応していません',
    errorDataManifestPathMissing: 'データマニフェストにデータファイルのパスがありません',
    errorDataFileReadFailed: 'データファイルの読み込みに失敗しました',
    r18Hidden: 'R18 非表示',
    addSample: '参考に追加',
    remove: '削除',
    producers: '制作者',
    detailsLoading: '詳細を読み込み中',
    detailsFailed: '詳細の読み込みに失敗',
    similarity: '類似度',
    overlap: '重複',
    priorityConfidence: '重点信頼度',
    associationScore: '関連度',
    vnAverage: 'VN平均点',
    averageWeighted: '平均点で重み付け',
    combinedSimilarity: '組み合わせ類似度',
    metaCategoryContent: '内容',
    metaCategoryTechnical: '技術',
    metaCategoryOther: 'その他',
    metaCategoryContentTooltip: '作品内容に関するタグです。題材、設定、ストーリー要素、表現形式を表します。',
    metaCategoryR18Tooltip: 'R18 関連タグです。通常は表示のみで検索には使われず、重点タグとして選択した場合のみ検索に使われます。',
    metaCategoryTechnicalTooltip: '技術的なタグです。通常は表示のみで検索には使われず、重点タグとして選択した場合のみ検索に使われます。',
    metaCategoryOtherTooltip: '主要カテゴリに分類されていないその他のタグです。'
  },
  en: {
    source: 'Based on VNDB data source',
    themeDark: 'Switch to dark mode',
    themeLight: 'Switch to light mode',
    vnMode: 'VN search',
    characterMode: 'Character search',
    tagMode: 'Tag search',
    showR18: 'R18 names',
    allowSpoiler: 'Spoilers',
    metaLanguage: 'tag/traits',
    uiLanguage: 'Language',
    searchVn: 'Search VN',
    searchCharacter: 'Search character',
    searchLocal: 'Search local index',
    localResults: 'Local search results',
    selectedSamples: 'Selected reference items',
    profile: 'Combined profile',
    vnRecommendations: 'Similar VN recommendations',
    characterRecommendations: 'Similar character recommendations',
    tagResults: 'tag/traits results',
    candidates: 'Candidates',
    perPage: 'Per page',
    currentPage: 'Page',
    page: '',
    sort: 'Sort',
    direction: 'Direction',
    minVotes: 'Min votes',
    profileSampleRounds: 'Search runs',
    tagLimit: 'Top N tags',
    traitLimit: 'Top N traits',
    preferAverage: 'Weight by related VN average',
    roleType: 'Character role',
    characterAppearances: 'Appears in',
    relatedVns: 'Related VNs',
    noRecommendationResults: 'No candidates match the current conditions. Try lowering minimum votes, relaxing role filters, or reducing priority tags/traits.',
    primary: 'Major character',
    main: 'Core character',
    side: 'Minor/supporting character',
    appears: 'Appears/mentioned only',
    previous: 'Previous',
    next: 'Next',
    previousItem: 'Previous item',
    nextItem: 'Next item',
    loadPage: 'Start search',
    choosePage: 'Set conditions, then start search.',
    license: 'VNDB data follows the VNDB Data License (Open Database License / Database Contents License); images and external details remain subject to VNDB records.',
    relevance: 'Relevance',
    confidence: 'Confidence',
    rating: 'VN rating',
    votes: 'Votes',
    title: 'Title',
    desc: 'Descending',
    asc: 'Ascending',
    clear: 'Clear',
    collapseAll: 'Collapse all',
    tagPanelTitle: 'VN tag',
    traitPanelTitle: 'Character traits',
    tagPanelDesc: 'Select VN tags. Selecting character traits at the same time outputs VN + character pairs.',
    traitPanelDesc: 'Select character traits. Selecting both VN tags and traits outputs VN + character pairs.',
    tagFilter: 'Search VN tag',
    traitFilter: 'Search character trait',
    showBlockedTags: 'Character/Scene tag',
    showTechnicalTags: 'technical tags',
    loading: 'Loading local VNDB index……',
    computing: 'Computing candidates……',
    fittingResults: 'Fitting search results……',
    selectedMeta: 'Selected',
    parentMeta: 'Parent',
    projectLinks: 'Project links',
    readmeTitle: 'Usage guide',
    githubStarFallback: 'Star',
    githubStarHelp: 'If this project helps you, please consider giving it a star',
    statsVn: 'VN',
    statsCharacters: 'Characters',
    statsMeta: 'Tags',
    statsProducers: 'Producers',
    metaLanguageLabel: 'tag/trait display language',
    uiLanguageLabel: 'Language settings',
    dataLastUpdated: 'Data last updated',
    resizeListHeight: 'Drag to resize list height',
    resizeListHeightHelp: 'Drag the button above to adjust the height',
    loadingDetailLoaded: 'Loaded',
    loadingDetailTotal: 'Total size',
    loadingDetailSpeed: 'Speed',
    loadingUnknown: 'Unknown',
    loadingCalculating: 'Calculating',
    loadingStageReady: 'Preparing local VNDB index',
    loadingStageReadManifest: 'Reading data manifest',
    loadingStagePrepareDownload: 'Preparing compressed data download',
    loadingStageCompressedDownloadComplete: 'Compressed data download complete',
    loadingStageDownloadGzip: 'Downloading gzip-compressed data',
    loadingStageReadPlainText: 'Reading uncompressed data text',
    loadingStageDecompressGzip: 'Decompressing gzip data',
    loadingStageParseJsonPrepare: 'Decompression complete, preparing to parse JSON',
    loadingStageParseJson: 'Parsing JSON data',
    loadingStageDecodeFields: 'Decoding compressed fields and multilingual text',
    loadingStageRestoreState: 'Restoring previous selections and filters',
    loadingStageCommitData: 'Committing data and initializing interface',
    loadingStagePrepareIndex: 'Preparing local index and search interface',
    loadingStageComplete: 'Loading complete',
    errorTitle: 'Loading failed',
    errorDescription: 'An error occurred while loading the local VNDB index. Try refreshing the page first. If the problem persists, submit an issue and include the error information below.',
    errorReload: 'Refresh page',
    errorSubmitIssue: 'Submit issue',
    errorStage: 'Failed stage',
    errorProgress: 'Loading progress',
    errorLoaded: 'Loaded',
    errorTotal: 'Total size',
    errorSpeed: 'Download speed',
    errorRenderMain: 'Rendering main interface',
    errorRuntime: 'Page runtime',
    errorUnsupportedGzip: 'This browser does not support gzip decompression',
    errorDataManifestPathMissing: 'The data manifest does not include a data file path',
    errorDataFileReadFailed: 'Data file read failed',
    r18Hidden: 'R18 hidden',
    addSample: 'Add as reference',
    remove: 'Remove',
    producers: 'Producers',
    detailsLoading: 'Loading details',
    detailsFailed: 'Details failed',
    similarity: 'Similarity',
    overlap: 'Overlap',
    priorityConfidence: 'Priority confidence',
    associationScore: 'Association score',
    vnAverage: 'VN average',
    averageWeighted: 'Average weighted',
    combinedSimilarity: 'Combined similarity',
    metaCategoryContent: 'Content',
    metaCategoryTechnical: 'Technical',
    metaCategoryOther: 'Other',
    metaCategoryContentTooltip: 'Content tags describe themes, settings, story elements, and presentation style.',
    metaCategoryR18Tooltip: 'R18 tags are shown by default but do not participate in search unless selected as priority tags.',
    metaCategoryTechnicalTooltip: 'Technical tags are shown by default but do not participate in search unless selected as priority tags.',
    metaCategoryOtherTooltip: 'Other tags that are not grouped into the main categories.'
  }
};

const isUiLanguage = (value: unknown): value is UiLanguage => value === 'zh' || value === 'ja' || value === 'en';
const storedUiLanguage = (): UiLanguage => {
  try {
    const textValue = window.localStorage.getItem(STORAGE_KEY);
    if (!textValue) return 'zh';
    const value = JSON.parse(textValue) as Partial<PersistedState>;
    return isUiLanguage(value.uiLanguage) ? value.uiLanguage : 'zh';
  } catch {
    return 'zh';
  }
};
const systemPrefersDarkMode = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
const storedDarkMode = () => {
  try {
    const textValue = window.localStorage.getItem(STORAGE_KEY);
    if (!textValue) return systemPrefersDarkMode();
    const value = JSON.parse(textValue) as Partial<PersistedState>;
    return typeof value.darkMode === 'boolean' ? value.darkMode : systemPrefersDarkMode();
  } catch {
    return systemPrefersDarkMode();
  }
};
const localizedText = (key: string, language: UiLanguage) => UI_TEXT[language][key] ?? UI_TEXT.zh[key] ?? key;
const localizedStage = (stage: string, language: UiLanguage) => localizedText(stage, language);

const text = (value: string) => value.trim().toLocaleLowerCase();
const isVnId = (value: string) => /^v\d+$/i.test(value.trim());
const isCharId = (value: string) => /^c\d+$/i.test(value.trim());
const idOf = (value: string) => Number(value.trim().slice(1));
const vndbUrl = (prefix: 'v' | 'c' | 'g' | 'i' | 'p', id: number) => `https://vndb.org/${prefix}${id}`;
const normalizeTitle = (value: string) => value.toLocaleLowerCase().replace(/[\s\-_~:：!！?？()[\]（）【】「」『』,，.。]/g, '');
const numberArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is number => Number.isInteger(item) && item >= 0) : [];
const numberValue = (value: unknown, fallback: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const booleanValue = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const formatUtc8Date = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(date);
  const fields = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day} ${fields.hour}:${fields.minute}:${fields.second}`;
};
const oneOf = <T extends string>(value: unknown, values: readonly T[], fallback: T) => typeof value === 'string' && (values as readonly string[]).includes(value) ? value as T : fallback;
const defaultRoleFilter = (): CharacterRoleFilter => ({ primary: true, main: true, side: true, appears: true });
const nextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
};
const formatSpeed = (value: number) => `${formatBytes(value)}/s`;

function loadPersistedState() {
  try {
    const textValue = window.localStorage.getItem(STORAGE_KEY);
    if (!textValue) return null;
    const value = JSON.parse(textValue) as Partial<PersistedState> & { query?: unknown; submittedQuery?: unknown };
    if (value.version !== PERSISTED_STATE_VERSION) return null;
    const roleFilter = typeof value.tagRoleFilter === 'object' && value.tagRoleFilter ? value.tagRoleFilter as Partial<CharacterRoleFilter> : {};
    const persistedMode = oneOf(value.mode, ['vn', 'character', 'tag'] as const, 'vn');
    const legacyQuery = typeof value.query === 'string' ? value.query : '';
    const legacySubmittedQuery = typeof value.submittedQuery === 'string' ? value.submittedQuery : '';
    return {
      version: PERSISTED_STATE_VERSION,
      mode: persistedMode,
      vnQuery: typeof value.vnQuery === 'string' ? value.vnQuery : persistedMode === 'vn' ? legacyQuery : '',
      characterQuery: typeof value.characterQuery === 'string' ? value.characterQuery : persistedMode === 'character' ? legacyQuery : '',
      vnSubmittedQuery: typeof value.vnSubmittedQuery === 'string' ? value.vnSubmittedQuery : persistedMode === 'vn' ? legacySubmittedQuery : '',
      characterSubmittedQuery: typeof value.characterSubmittedQuery === 'string' ? value.characterSubmittedQuery : persistedMode === 'character' ? legacySubmittedQuery : '',
      selectedVnIds: numberArray(value.selectedVnIds),
      selectedCharacterIds: numberArray(value.selectedCharacterIds),
      showSexual: booleanValue(value.showSexual, false),
      showSpoiler: booleanValue(value.showSpoiler, false),
      showBlockedTags: booleanValue(value.showBlockedTags, false),
      showTechnicalTags: booleanValue(value.showTechnicalTags, false),
      metaLanguage: oneOf(value.metaLanguage, ['zh', 'ja', 'origin'] as const, 'zh'),
      uiLanguage: oneOf(value.uiLanguage, ['zh', 'ja', 'en'] as const, 'zh'),
      minVotes: numberValue(value.minVotes, 50, 0),
      tagLimit: numberValue(value.tagLimit, 12, 1, 60),
      traitLimit: numberValue(value.traitLimit, 16, 1, 80),
      profileSampleRounds: numberValue(value.profileSampleRounds, 1, 1, 1024),
      preferCharacterAverage: booleanValue(value.preferCharacterAverage, false),
      tagRoleFilter: {
        primary: booleanValue(roleFilter.primary, true),
        main: booleanValue(roleFilter.main, true),
        side: booleanValue(roleFilter.side, true),
        appears: booleanValue(roleFilter.appears, true)
      },
      resultSort: oneOf(value.resultSort, ['relevance', 'rating', 'votes', 'title', 'confidence'] as const, 'relevance'),
      sortDirection: oneOf(value.sortDirection, ['desc', 'asc'] as const, 'desc'),
      darkMode: booleanValue(value.darkMode, systemPrefersDarkMode()),
      resultPage: numberValue(value.resultPage, 1, 1),
      localSearchPage: numberValue(value.localSearchPage, 1, 1),
      priorityTagIds: numberArray(value.priorityTagIds),
      priorityTraitIds: numberArray(value.priorityTraitIds),
      tagSearchTagIds: numberArray(value.tagSearchTagIds),
      tagSearchTraitIds: numberArray(value.tagSearchTraitIds)
    } satisfies PersistedState;
  } catch {
    return null;
  }
}

const metaSelectorStorageKey = (kind: 'tag' | 'trait') => `${META_SELECTOR_STORAGE_PREFIX}-${kind}`;

function loadMetaSelectorState(kind: 'tag' | 'trait'): MetaSelectorPersistedState | null {
  try {
    const textValue = window.localStorage.getItem(metaSelectorStorageKey(kind));
    if (!textValue) return null;
    const value = JSON.parse(textValue) as Partial<MetaSelectorPersistedState>;
    return {
      query: typeof value.query === 'string' ? value.query : '',
      openNodeIds: numberArray(value.openNodeIds),
      openGroupLabels: Array.isArray(value.openGroupLabels) ? value.openGroupLabels.filter((item): item is string => typeof item === 'string') : [],
      scrollTop: numberValue(value.scrollTop, 0, 0),
      height: numberValue(value.height, 520, 260)
    };
  } catch {
    return null;
  }
}

function saveMetaSelectorState(kind: 'tag' | 'trait', state: MetaSelectorPersistedState) {
  try {
    window.localStorage.setItem(metaSelectorStorageKey(kind), JSON.stringify(state));
  } catch {
  }
}

function resolveDataPath(manifest: DataManifest) {
  const path = manifest.dataPath ?? manifest.path;
  if (!path) throw new Error(localizedText('errorDataManifestPathMissing', storedUiLanguage()));
  if (/^https?:\/\//i.test(path) || path.startsWith('./') || path.startsWith('../')) return path;
  return `./data/${path.replace(/^\/+/, '')}`;
}

async function loadDataSource(signal: AbortSignal, onProgress: (state: LoadProgressUpdate) => void) {
  onProgress({ progress: 2, stage: 'loadingStageReadManifest' });
  const response = await fetch(DATA_MANIFEST_PATH, { cache: 'no-cache', signal });
  if (!response.ok) throw new Error(String(response.status));
  const manifest = await response.json() as DataManifest;
  onProgress({ progress: 5, stage: 'loadingStagePrepareDownload' });
  return loadDataText(resolveDataPath(manifest), true, signal, onProgress, manifest.size ?? 0);
}

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

async function responseBytes(response: Response, onProgress: (state: LoadProgressUpdate) => void, fallbackTotal = 0) {
  const total = Number(response.headers.get('content-length')) || fallbackTotal || 0;
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress({ progress: 75, stage: 'loadingStageCompressedDownloadComplete', detail: { loaded: buffer.byteLength, total: total || buffer.byteLength, speed: 0 } });
    return new Uint8Array(buffer);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const startedAt = performance.now();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const elapsed = Math.max(0.001, (performance.now() - startedAt) / 1000);
    const speed = loaded / elapsed;
    const ratio = total > 0 ? Math.min(1, loaded / total) : 0;
    onProgress({ progress: total > 0 ? Math.min(75, Math.round(5 + ratio * 70)) : 35, stage: 'loadingStageDownloadGzip', detail: { loaded, total, speed } });
  }
  onProgress({ progress: 75, stage: 'loadingStageCompressedDownloadComplete', detail: { loaded, total: total || loaded, speed: 0 } });
  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function loadDataText(url: string, compressed: boolean, signal: AbortSignal, onProgress: (state: LoadProgressUpdate) => void, manifestSize = 0) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${localizedText('errorDataFileReadFailed', storedUiLanguage())}：${response.status}`);
  const bytes = await responseBytes(response, onProgress, manifestSize);
  const contentEncoding = response.headers.get('content-encoding')?.toLocaleLowerCase() ?? '';
  const hasGzipHeader = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!compressed || contentEncoding.includes('gzip') || !hasGzipHeader) {
    onProgress({ progress: 82, stage: 'loadingStageReadPlainText', detail: null });
    return new TextDecoder().decode(bytes);
  }
  if (typeof DecompressionStream === 'undefined') throw new Error(localizedText('errorUnsupportedGzip', storedUiLanguage()));
  onProgress({ progress: 78, stage: 'loadingStageDecompressGzip', detail: null });
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const textValue = await new Response(stream).text();
  onProgress({ progress: 82, stage: 'loadingStageParseJsonPrepare', detail: null });
  return textValue;
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
  if (kind !== 'tag') return item[2] ?? 0;
  const lieCount = item[3] ?? 0;
  const voteCount = item[4];
  if (voteCount === undefined) return lieCount;
  return voteCount > 50 ? lieCount / voteCount >= 0.05 : lieCount >= 4;
}

function canUseMetaForSearch(metaItem: Meta, spoiler: number, includeSpoiler: boolean, allowedSexualIds?: Set<number>) {
  if (metaItem.sexual && !allowedSexualIds?.has(metaItem.id)) return false;
  if (!includeSpoiler && Math.max(spoiler, metaItem.defaultspoil ?? 0) > 0) return false;
  return true;
}

function metaFilterClass(metaItem: Meta, kind: 'tag' | 'trait'): MetaFilterClass {
  if (metaItem.sexual) return 'sexual';
  if ((metaItem.defaultspoil ?? 0) > 0) return 'spoiler';
  if (kind === 'tag' && metaItem.blocked) return 'blocked';
  if (kind === 'tag' && metaItem.tech) return 'technical';
  return 'normal';
}

function metaAllowedByFilters(metaItem: Meta, kind: 'tag' | 'trait', includeSexual: boolean, includeSpoiler: boolean, includeBlocked = true, includeTechnical = true) {
  switch (metaFilterClass(metaItem, kind)) {
    case 'sexual':
      return includeSexual;
    case 'spoiler':
      return includeSpoiler;
    case 'blocked':
      return includeBlocked;
    case 'technical':
      return includeTechnical;
    default:
      return true;
  }
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

function metaStratum(id: number, meta?: Map<number, Meta>) {
  const item = meta?.get(id);
  return String(item?.parents?.[0] ?? item?.group ?? item?.cat ?? id);
}

function inverseUsageWeight(id: number, usageCounts?: Map<number, number>) {
  const usage = Math.max(0, usageCounts?.get(id) ?? 0);
  return 1 / Math.log2(usage + 2);
}

function weightedChoice(entries: [number, number][], usageCounts: Map<number, number> | undefined, seed: string, round: number, stratum: string) {
  let best = entries[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    const id = entry[0];
    const weight = Math.max(inverseUsageWeight(id, usageCounts), 0.000001);
    const random = Math.max(stableUnitRandom(seed, `${round}|${stratum}|${id}`), 0.000001);
    const score = -Math.log(random) / weight;
    if (score < bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

function stratifiedRepeatedSample(pool: [number, number][], slots: number, meta: Map<number, Meta> | undefined, usageCounts: Map<number, number> | undefined, seed: string) {
  const groups = new Map<string, [number, number][]>();
  for (const entry of pool) {
    const stratum = metaStratum(entry[0], meta);
    groups.set(stratum, [...(groups.get(stratum) ?? []), entry]);
  }
  const totals = new Map<number, number>();
  const rounds = 1024;
  for (let round = 0; round < rounds; round += 1) {
    const remaining = new Map([...groups.entries()].map(([key, entries]) => [key, [...entries]]));
    const selected = new Set<number>();
    while (selected.size < slots) {
      const availableStrata = [...remaining.entries()]
        .filter(([, entries]) => entries.length)
        .map(([stratum]) => stratum)
        .sort((a, b) => stableUnitRandom(seed, `${round}|${selected.size}|stratum|${a}`) - stableUnitRandom(seed, `${round}|${selected.size}|stratum|${b}`));
      if (!availableStrata.length) break;
      for (const stratum of availableStrata) {
        if (selected.size >= slots) break;
        const entries = remaining.get(stratum) ?? [];
        const chosen = weightedChoice(entries, usageCounts, seed, round, stratum);
        selected.add(chosen[0]);
        remaining.set(stratum, entries.filter(([id]) => id !== chosen[0]));
      }
    }
    for (const id of selected) totals.set(id, (totals.get(id) ?? 0) + 1);
  }
  return [...pool].sort((a, b) => {
    const totalDiff = (totals.get(b[0]) ?? 0) - (totals.get(a[0]) ?? 0);
    if (totalDiff) return totalDiff;
    const usageDiff = inverseUsageWeight(b[0], usageCounts) - inverseUsageWeight(a[0], usageCounts);
    if (usageDiff) return usageDiff;
    return stableUnitRandom(seed, `final|${a[0]}`) - stableUnitRandom(seed, `final|${b[0]}`);
  }).slice(0, slots);
}

function selectSearchEntries(entries: [number, number][], limit: number, meta?: Map<number, Meta>, usageCounts?: Map<number, number>) {
  const count = Math.max(1, limit);
  if (entries.length <= count) return entries;
  const boundaryWeight = entries[count - 1][1];
  const before = entries.filter(([, weight]) => weight > boundaryWeight);
  const pool = entries.filter(([, weight]) => weight === boundaryWeight);
  const slots = count - before.length;
  if (slots <= 0 || pool.length - slots < 3) return entries.slice(0, count);
  const seed = entries.map(([id, value]) => `${id}:${value}`).sort().join('|');
  return [...before, ...stratifiedRepeatedSample(pool, slots, meta, usageCounts, seed)];
}

function searchVector(vector: Map<number, number>, limit: number, priorityIds: Set<number>, meta?: Map<number, Meta>, usageCounts?: Map<number, number>) {
  const entries = [...vector.entries()].sort((a, b) => b[1] - a[1]);
  const candidates = entries.filter(([id]) => {
    const metaItem = meta?.get(id);
    return !priorityIds.has(id) && !metaIsAutoIgnored(metaItem) && !metaItem?.sexual;
  });
  const limited = selectSearchEntries(candidates, limit, meta, usageCounts);
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

function metaSearchDescendants(kind: 'tag' | 'trait', item: Meta, children: Map<number, Meta[]>, includeSexual: boolean, includeSpoiler: boolean, includeBlocked: boolean, includeTechnical: boolean, path = new Set<number>()) {
  if (path.has(item.id)) return [];
  const nextPath = new Set(path);
  nextPath.add(item.id);
  const result: Meta[] = [];
  for (const child of children.get(item.id) ?? []) {
    if (!metaAllowedByFilters(child, kind, includeSexual, includeSpoiler, includeBlocked, includeTechnical)) continue;
    result.push(child, ...metaSearchDescendants(kind, child, children, includeSexual, includeSpoiler, includeBlocked, includeTechnical, nextPath));
  }
  return result;
}

function metaSearchGroups(kind: 'tag' | 'trait', selectedIds: Set<number>, items: Meta[], meta: Map<number, Meta>, includeSexual: boolean, includeSpoiler: boolean, includeBlocked = true, includeTechnical = true) {
  const children = metaChildrenMap(items);
  return [...selectedIds].map((selectedId) => {
    const alternatives = new Set<number>([selectedId]);
    const item = meta.get(selectedId);
    const includeSexualDescendants = includeSexual && item?.sexual === true;
    const includeBlockedDescendants = includeBlocked || item?.blocked === true;
    const includeTechnicalDescendants = includeTechnical || item?.tech === true;
    if (item) for (const child of metaSearchDescendants(kind, item, children, includeSexualDescendants, includeSpoiler, includeBlockedDescendants, includeTechnicalDescendants)) alternatives.add(child.id);
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

function visibleItems<T extends Pair | TraitPair>(items: T[], meta: Map<number, Meta>, kind: 'tag' | 'trait', includeSexual: boolean, includeSpoiler: boolean, showBlockedTags = true, showTechnicalTags = true) {
  return items.filter((item) => {
    const metaItem = meta.get(item[0]);
    const spoiler = itemSpoiler(item, kind);
    if (!metaItem) return false;
    if (!metaAllowedByFilters(metaItem, kind, includeSexual, includeSpoiler, showBlockedTags, showTechnicalTags)) return false;
    if (!includeSpoiler && spoiler > 0) return false;
    return true;
  });
}

function decodedMetaField(value?: string, encoded?: boolean) {
  if (!value) return null;
  return encoded ? decode(value) : value;
}

function metaName(metaItem: Meta, showSexual: boolean, language: MetaLanguage, uiLanguage: UiLanguage = 'zh') {
  if (metaItem.sexual && !showSexual) return localizedText('r18Hidden', uiLanguage);
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

function metaTooltip(metaItem: Meta, showSexual: boolean, language: MetaLanguage, uiLanguage: UiLanguage = 'zh') {
  if (metaItem.sexual && !showSexual) return localizedText('r18Hidden', uiLanguage);
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

function traitGroupLabel(metaItem: Meta, meta: Map<number, Meta>, showSexual: boolean, language: MetaLanguage, uiLanguage: UiLanguage) {
  const group = traitGroupMeta(metaItem, meta);
  return metaName(group, showSexual, language, uiLanguage);
}

function traitGroups(items: TraitPair[], meta: Map<number, Meta>, showSexual: boolean, showSpoiler: boolean, metaLanguage: MetaLanguage, uiLanguage: UiLanguage) {
  const groups = new Map<string, TraitPair[]>();
  for (const item of visibleItems(items, meta, 'trait', showSexual, showSpoiler)) {
    const metaItem = meta.get(item[0]);
    if (!metaItem) continue;
    const label = traitGroupLabel(metaItem, meta, showSexual, metaLanguage, uiLanguage);
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  return [...groups.entries()];
}

function profileTraitGroups(items: [number, number][], meta: Map<number, Meta>, showSexual: boolean, metaLanguage: MetaLanguage, uiLanguage: UiLanguage) {
  const groups = new Map<string, [number, number][]>() ;
  for (const item of items) {
    const metaItem = meta.get(item[0]);
    if (!metaItem) continue;
    if (!showSexual && metaItem.sexual) continue;
    const label = traitGroupLabel(metaItem, meta, showSexual, metaLanguage, uiLanguage);
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  return [...groups.entries()];
}

function compareVnScore(a: Vn, b: Vn) {
  return (b.rating - a.rating) || (b.votes - a.votes) || (b.average - a.average);
}

function exactSearchMatch(value: string | null | undefined, query: string) {
  if (!value) return false;
  const field = text(value);
  const compactField = normalizeTitle(value);
  const compactQuery = normalizeTitle(query);
  return field === query || Boolean(compactField && compactField === compactQuery);
}

function exactSearchRank(primaryValues: Array<string | null | undefined>, aliasValues: Array<string | null | undefined>, query: string) {
  if (primaryValues.some((value) => exactSearchMatch(value, query))) return 2;
  if (aliasValues.some((value) => exactSearchMatch(value, query))) return 1;
  return 0;
}

function vnExactSearchRank(vn: Vn, query: string) {
  if (`v${vn.id}` === query) return 3;
  const aliases = vn.aliases.split('\n').map((alias) => alias.trim()).filter(Boolean);
  return exactSearchRank([vn.title, vn.original], aliases, query);
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
    const exactDiff = vnExactSearchRank(b, query) - vnExactSearchRank(a, query);
    const rankDiff = vnSearchRank(b, query) - vnSearchRank(a, query);
    return exactDiff || rankDiff || compareVnScore(a, b) || a.id - b.id;
  };
}

function characterExactSearchRank(character: Character, query: string) {
  if (`c${character.id}` === query) return 3;
  return exactSearchRank([character.name, character.original], character.aliases, query);
}

function characterSearchMatch(character: Character, query: string) {
  return characterExactSearchRank(character, query) > 0 || character.search.includes(query);
}

function compareCharacterSearchResult(query: string) {
  return (a: Character, b: Character) => {
    const exactDiff = characterExactSearchRank(b, query) - characterExactSearchRank(a, query);
    return exactDiff || compareCharacterScore(a, b) || a.id - b.id;
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

function characterRoleText(role: string, t: Record<string, string>) {
  if (role === 'primary') return t.primary;
  if (role === 'main') return t.main;
  if (role === 'side') return t.side;
  if (role === 'appears') return t.appears;
  return role;
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

function LoadingErrorView({ error, language = storedUiLanguage(), darkMode = storedDarkMode() }: { error: LoadError; language?: UiLanguage; darkMode?: boolean }) {
  const t = UI_TEXT[language];
  return <main className={`shell ${darkMode ? 'themeDark' : 'themeLight'}`}><section className="panel error loadErrorPanel"><h1>{t.errorTitle}</h1><p>{t.errorDescription}</p><div className="errorActions"><button onClick={() => window.location.reload()}>{t.errorReload}</button></div><div className="errorMetaRow"><dl className="errorMeta"><div><dt>{t.errorStage}</dt><dd>{localizedStage(error.stage, language)}</dd></div><div><dt>{t.errorProgress}</dt><dd>{error.progress}%</dd></div>{error.detail ? <><div><dt>{t.errorLoaded}</dt><dd>{formatBytes(error.detail.loaded)}</dd></div><div><dt>{t.errorTotal}</dt><dd>{error.detail.total ? formatBytes(error.detail.total) : t.loadingUnknown}</dd></div><div><dt>{t.errorSpeed}</dt><dd>{error.detail.speed ? formatSpeed(error.detail.speed) : t.loadingUnknown}</dd></div></> : null}</dl><a className="errorIssueLink" href={ISSUE_URL} target="_blank" rel="noreferrer">{t.errorSubmitIssue}</a></div><pre className="errorDetails">{error.stack ?? error.message}</pre></section></main>;
}

class AppErrorBoundary extends Component<{ children: React.ReactNode }, { error: LoadError | null }> {
  state: { error: LoadError | null } = { error: null };

  static getDerivedStateFromError(reason: unknown) {
    return { error: { message: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined, stage: 'errorRenderMain', progress: 100, detail: null } };
  }

  componentDidCatch(reason: unknown) {
    console.error(reason);
  }

  render() {
    if (this.state.error) return <LoadingErrorView error={this.state.error} />;
    return this.props.children;
  }
}

function App() {
  const persistedState = useMemo(() => loadPersistedState(), []);
  const [data, setData] = useState<Data | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [error, setError] = useState<LoadError | null>(null);
  const [mode, setMode] = useState<Mode>(() => persistedState?.mode ?? 'vn');
  const [vnQuery, setVnQuery] = useState(() => persistedState?.vnQuery ?? '');
  const [characterQuery, setCharacterQuery] = useState(() => persistedState?.characterQuery ?? '');
  const [vnSubmittedQuery, setVnSubmittedQuery] = useState(() => persistedState?.vnSubmittedQuery ?? '');
  const [characterSubmittedQuery, setCharacterSubmittedQuery] = useState(() => persistedState?.characterSubmittedQuery ?? '');
  const query = mode === 'character' ? characterQuery : vnQuery;
  const submittedQuery = mode === 'character' ? characterSubmittedQuery : vnSubmittedQuery;
  const setActiveQuery = mode === 'character' ? setCharacterQuery : setVnQuery;
  const setActiveSubmittedQuery = mode === 'character' ? setCharacterSubmittedQuery : setVnSubmittedQuery;
  const [selectedVns, setSelectedVns] = useState<Vn[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([]);
  const [vnDetails, setVnDetails] = useState<Record<number, Detail>>({});
  const [characterDetails, setCharacterDetails] = useState<Record<number, Detail>>({});
  const [recommendationDetails, setRecommendationDetails] = useState<Record<string, Detail>>({});
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showSexual, setShowSexual] = useState(() => persistedState?.showSexual ?? false);
  const [showSpoiler, setShowSpoiler] = useState(() => persistedState?.showSpoiler ?? false);
  const [showBlockedTags, setShowBlockedTags] = useState(() => persistedState?.showBlockedTags ?? false);
  const [showTechnicalTags, setShowTechnicalTags] = useState(() => persistedState?.showTechnicalTags ?? false);
  const [loadState, setLoadState] = useState<LoadState>({ progress: 0, stage: 'loadingStageReady', detail: null });
  const loadStateRef = useRef<LoadState>({ progress: 0, stage: 'loadingStageReady', detail: null });
  const [metaLanguage, setMetaLanguage] = useState<MetaLanguage>(() => persistedState?.metaLanguage ?? 'zh');
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() => persistedState?.uiLanguage ?? 'zh');
  const t = UI_TEXT[uiLanguage];
  const [minVotes, setMinVotes] = useState(() => persistedState?.minVotes ?? 50);
  const [tagLimit, setTagLimit] = useState(() => persistedState?.tagLimit ?? 12);
  const [traitLimit, setTraitLimit] = useState(() => persistedState?.traitLimit ?? 16);
  const [profileSampleRounds, setProfileSampleRounds] = useState(() => persistedState?.profileSampleRounds ?? 1);
  const [preferCharacterAverage, setPreferCharacterAverage] = useState(() => persistedState?.preferCharacterAverage ?? false);
  const [tagRoleFilter, setTagRoleFilter] = useState<CharacterRoleFilter>(() => persistedState?.tagRoleFilter ?? defaultRoleFilter());
  const [resultSort, setResultSort] = useState<ResultSort>(() => persistedState?.resultSort ?? 'relevance');
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => persistedState?.sortDirection ?? 'desc');
  const [darkMode, setDarkMode] = useState(() => persistedState?.darkMode ?? storedDarkMode());
  const [githubStars, setGithubStars] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [resultPage, setResultPage] = useState(() => persistedState?.resultPage ?? 1);
  const [localSearchPage, setLocalSearchPage] = useState(() => persistedState?.localSearchPage ?? 1);
  const [priorityTags, setPriorityTags] = useState<Set<number>>(() => new Set(persistedState?.priorityTagIds ?? []));
  const [priorityTraits, setPriorityTraits] = useState<Set<number>>(() => new Set(persistedState?.priorityTraitIds ?? []));
  const [tagSearchTags, setTagSearchTags] = useState<Set<number>>(() => new Set(persistedState?.tagSearchTagIds ?? []));
  const [tagSearchTraits, setTagSearchTraits] = useState<Set<number>>(() => new Set(persistedState?.tagSearchTraitIds ?? []));
  const [persistenceReady, setPersistenceReady] = useState(!persistedState);
  const [deferredDataWorkReady, setDeferredDataWorkReady] = useState(!persistedState);
  const detailQueueRef = useRef<QueuedDetailRequest[]>([]);
  const detailQueueVersionRef = useRef(0);
  const detailQueueRunningRef = useRef<number | null>(null);
  const lastDetailRequestAtRef = useRef(0);
  const recommendationDetailVersionRef = useRef(0);
  const recommendationWorkerRef = useRef<Worker | null>(null);
  const recommendationRequestIdRef = useRef(0);
  const recommendationResultsRef = useRef<HTMLElement | null>(null);
  const localSearchPanelRef = useRef<HTMLDivElement | null>(null);
  const sampleProfilePanelRef = useRef<HTMLDivElement | null>(null);
  const localSearchListRef = useRef<HTMLDivElement | null>(null);
  const recommendationListRef = useRef<HTMLDivElement | null>(null);
  const persistedSelectionsRestoredRef = useRef(!persistedState);
  const recommendationResetReadyRef = useRef(false);
  const localSearchResetReadyRef = useRef(false);
  const requestedSampleDetailsRef = useRef(new Set<string>());
  const [workerReady, setWorkerReady] = useState(false);
  const [workerComputing, setWorkerComputing] = useState(false);
  const [workerProgress, setWorkerProgress] = useState<WorkerProgressState | null>(null);
  const [workerResult, setWorkerResult] = useState<WorkerResult>(() => emptyWorkerResult());
  const renderShowSexual = useDeferredValue(showSexual);
  const renderShowSpoiler = useDeferredValue(showSpoiler);
  const renderShowBlockedTags = useDeferredValue(showBlockedTags);
  const renderShowTechnicalTags = useDeferredValue(showTechnicalTags);

  useEffect(() => {
    document.title = 'VNDB Profile Search';
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL('./computeWorker.ts', import.meta.url), { type: 'module' });
    recommendationWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ type: string; requestId?: number; result?: WorkerResult; progress?: WorkerProgress; phase?: WorkerProgress['phase']; current?: number; total?: number; error?: string }>) => {
      if (event.data.type === 'ready') {
        setWorkerReady(true);
        return;
      }
      if (event.data.type === 'progress' && event.data.requestId === recommendationRequestIdRef.current) {
        const phase = event.data.phase ?? 'search';
        setWorkerProgress((current) => ({
          ...(current ?? {}),
          [phase]: { current: event.data.current ?? 0, total: event.data.total ?? 1 }
        }));
        return;
      }
      if (event.data.type === 'result' && event.data.requestId === recommendationRequestIdRef.current && event.data.result) {
        setWorkerResult(event.data.result);
        setWorkerComputing(false);
        setWorkerProgress(null);
      }
      if (event.data.type === 'error' && event.data.requestId === recommendationRequestIdRef.current) {
        setWorkerComputing(false);
        setWorkerProgress(null);
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
    const updateProgress = (state: LoadProgressUpdate) => {
      if (!cancelled) setLoadState((current) => {
        const next = { ...current, ...state, progress: Math.max(current.progress, state.progress) };
        loadStateRef.current = next;
        return next;
      });
    };
    const load = async () => {
      try {
        const textValue = await loadDataSource(controller.signal, updateProgress);
        if (cancelled) return;
        updateProgress({ progress: 84, stage: 'loadingStageParseJson', detail: null });
        await nextFrame();
        if (cancelled) return;
        const raw = JSON.parse(textValue) as Data;
        if (cancelled) return;
        updateProgress({ progress: 90, stage: 'loadingStageDecodeFields', detail: null });
        await nextFrame();
        if (cancelled) return;
        const decoded = decodeLocalData(raw);
        updateProgress({ progress: 94, stage: 'loadingStageRestoreState', detail: null });
        await nextFrame();
        if (cancelled) return;
        if (persistedState && !persistedSelectionsRestoredRef.current) {
          const restoredVnIds = new Set(persistedState.selectedVnIds);
          const restoredCharacterIds = new Set(persistedState.selectedCharacterIds);
          setSelectedVns(decoded.vns.filter((vn) => restoredVnIds.has(vn.id)));
          setSelectedCharacters(decoded.characters.filter((character) => restoredCharacterIds.has(character.id)));
          persistedSelectionsRestoredRef.current = true;
        }
        updateProgress({ progress: 97, stage: 'loadingStageCommitData', detail: null });
        await nextFrame();
        if (cancelled) return;
        updateProgress({ progress: 99, stage: 'loadingStagePrepareIndex', detail: null });
        await nextFrame();
        if (cancelled) return;
        setData(decoded);
        setPersistenceReady(true);
        setDeferredDataWorkReady(true);
        updateProgress({ progress: 100, stage: 'loadingStageComplete', detail: null });
        await nextFrame();
        if (cancelled) return;
        setAppReady(true);
      } catch (reason) {
          if (controller.signal.aborted) return;
          const currentState = loadStateRef.current;
          setError({
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
            stage: currentState.stage,
            progress: currentState.progress,
            detail: currentState.detail
          });
        }
    };
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!persistedSelectionsRestoredRef.current) return;
    if (!selectedVns.length && !selectedCharacters.length) return;
    for (const vn of selectedVns) {
      const key = `v${vn.id}`;
      if (requestedSampleDetailsRef.current.has(key) || vnDetails[vn.id]) continue;
      requestedSampleDetailsRef.current.add(key);
      requestVnDetail(vn.id, 'sample');
    }
    for (const character of selectedCharacters) {
      const key = `c${character.id}`;
      if (requestedSampleDetailsRef.current.has(key) || characterDetails[character.id]) continue;
      requestedSampleDetailsRef.current.add(key);
      requestCharacterDetail(character.id, 'sample');
    }
  }, [selectedVns, selectedCharacters, vnDetails, characterDetails]);

  useEffect(() => {
    if (!data || !persistenceReady) return;
    const handle = window.setTimeout(() => {
      const state: PersistedState = {
        version: PERSISTED_STATE_VERSION,
        mode,
        vnQuery,
        characterQuery,
        vnSubmittedQuery,
        characterSubmittedQuery,
        selectedVnIds: selectedVns.map((vn) => vn.id),
        selectedCharacterIds: selectedCharacters.map((character) => character.id),
        showSexual,
        showSpoiler,
        showBlockedTags,
        showTechnicalTags,
        metaLanguage,
        uiLanguage,
        minVotes,
        tagLimit,
        traitLimit,
        profileSampleRounds,
        preferCharacterAverage,
        tagRoleFilter,
        resultSort,
        sortDirection,
        darkMode,
        resultPage,
        localSearchPage,
        priorityTagIds: [...priorityTags],
        priorityTraitIds: [...priorityTraits],
        tagSearchTagIds: [...tagSearchTags],
        tagSearchTraitIds: [...tagSearchTraits]
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 120);
    return () => window.clearTimeout(handle);
  }, [data, persistenceReady, mode, vnQuery, characterQuery, vnSubmittedQuery, characterSubmittedQuery, selectedVns, selectedCharacters, showSexual, showSpoiler, showBlockedTags, showTechnicalTags, metaLanguage, uiLanguage, minVotes, tagLimit, traitLimit, profileSampleRounds, preferCharacterAverage, tagRoleFilter, resultSort, sortDirection, darkMode, resultPage, localSearchPage, priorityTags, priorityTraits, tagSearchTags, tagSearchTraits]);

  useEffect(() => {
    if (!persistedSelectionsRestoredRef.current) return;
    if (!recommendationResetReadyRef.current) {
      recommendationResetReadyRef.current = true;
      return;
    }
    recommendationDetailVersionRef.current += 1;
    detailQueueRef.current = detailQueueRef.current.filter((item) => !item.key.startsWith('recommendation-'));
    setShowRecommendations(false);
    setRecommendationDetails({});
    setResultPage(1);
  }, [mode, selectedVns, selectedCharacters, renderShowBlockedTags, minVotes, tagLimit, traitLimit, profileSampleRounds, preferCharacterAverage, tagRoleFilter, priorityTags, priorityTraits, tagSearchTags, tagSearchTraits]);

  useEffect(() => {
    if (!recommendationResetReadyRef.current) return;
    setResultPage(1);
  }, [resultSort, sortDirection]);

  useEffect(() => {
    if (!persistedSelectionsRestoredRef.current) return;
    if (!localSearchResetReadyRef.current) {
      localSearchResetReadyRef.current = true;
      return;
    }
    setLocalSearchPage(1);
  }, [mode, submittedQuery, selectedVns, selectedCharacters, isMobile]);

  const tagMeta = useMemo(() => new Map(data?.tags.map((tag) => [tag.id, tag]) ?? []), [data]);
  const traitMeta = useMemo(() => new Map(data?.traits.map((trait) => [trait.id, trait]) ?? []), [data]);
  const profileSexualTagIds = useMemo(() => new Set<number>(), []);
  const profileSexualTraitIds = useMemo(() => new Set<number>(), []);
  const vnById = useMemo(() => new Map(data?.vns.map((vn) => [vn.id, vn]) ?? []), [data]);
  const characterById = useMemo(() => new Map(data?.characters.map((character) => [character.id, character]) ?? []), [data]);

  useEffect(() => {
    if (!data || !persistedState || persistedSelectionsRestoredRef.current) return;
    const nextSelectedVns = persistedState.selectedVnIds.map((id) => vnById.get(id)).filter((vn): vn is Vn => Boolean(vn));
    const nextSelectedCharacters = persistedState.selectedCharacterIds.map((id) => characterById.get(id)).filter((character): character is Character => Boolean(character));
    setSelectedVns(nextSelectedVns);
    setSelectedCharacters(nextSelectedCharacters);
    persistedSelectionsRestoredRef.current = true;
    setPersistenceReady(true);
  }, [data, persistedState, vnById, characterById]);

  const directTagUsageSets = useMemo(() => {
    if (!deferredDataWorkReady) return new Map<number, Set<number>>();
    const entries = showSpoiler ? data?.usageIndex?.directTagVns : data?.usageIndex?.directTagVnsNoSpoiler;
    return usageEntriesToSetMap(entries, data?.tags ?? []) ?? directMetaUsageSets(data?.vns ?? [], data?.tags ?? [], tagMeta, 'tags', 'tag', showSpoiler);
  }, [deferredDataWorkReady, data, tagMeta, showSpoiler]);
  const directTraitUsageSets = useMemo(() => {
    if (!deferredDataWorkReady) return new Map<number, Set<number>>();
    const entries = showSpoiler ? data?.usageIndex?.directTraitCharacters : data?.usageIndex?.directTraitCharactersNoSpoiler;
    return usageEntriesToSetMap(entries, data?.traits ?? []) ?? directMetaUsageSets(data?.characters ?? [], data?.traits ?? [], traitMeta, 'traits', 'trait', showSpoiler);
  }, [deferredDataWorkReady, data, traitMeta, showSpoiler]);
  const tagUsageCounts = useMemo(() => aggregateMetaUsageCounts(directTagUsageSets, data?.tags ?? [], 'tag', showSexual, showSpoiler, showBlockedTags, showTechnicalTags), [directTagUsageSets, data, showSexual, showSpoiler, showBlockedTags, showTechnicalTags]);
  const traitUsageCounts = useMemo(() => aggregateMetaUsageCounts(directTraitUsageSets, data?.traits ?? [], 'trait', showSexual, showSpoiler), [directTraitUsageSets, data, showSexual, showSpoiler]);
  const deferredSelectedVns = useDeferredValue(selectedVns);
  const deferredSelectedCharacters = useDeferredValue(selectedCharacters);
  const profileComputing = deferredSelectedVns !== selectedVns || deferredSelectedCharacters !== selectedCharacters;

  const baseSearchResults = useMemo(() => {
    if (!data || !deferredDataWorkReady) return [];
    const q = text(submittedQuery);
    if (!q) return [];
    if (mode === 'vn') {
      if (isVnId(q)) return data.vns.filter((vn) => vn.id === idOf(q));
      return data.vns
        .filter((vn) => vnSearchRank(vn, q) > 0)
        .sort(compareVnSearchResult(q));
    }
    if (isCharId(q)) return data.characters.filter((character) => character.id === idOf(q));
    const directCharacters = data.characters
      .filter((character) => characterSearchMatch(character, q))
      .sort(compareCharacterSearchResult(q));
    if (directCharacters.length) return directCharacters;
    const matchedVns = data.vns.filter((vn) => vnSearchRank(vn, q) > 0).sort(compareVnSearchResult(q)).slice(0, 30);
    const matchedVnRank = new Map(matchedVns.map((vn, index) => [vn.id, matchedVns.length - index]));
    if (!matchedVnRank.size) return [];
    return data.characters
      .filter((character) => character.vns.some(([id]) => matchedVnRank.has(id)))
      .sort((a, b) => {
        const left = Math.max(0, ...b.vns.map(([id]) => matchedVnRank.get(id) ?? 0)) * 1000 + characterDisplayScore(b, vnById, false);
        const right = Math.max(0, ...a.vns.map(([id]) => matchedVnRank.get(id) ?? 0)) * 1000 + characterDisplayScore(a, vnById, false);
        return left - right;
      });
  }, [data, deferredDataWorkReady, mode, submittedQuery, vnById]);

  const searchResults = useMemo(() => {
    if (mode === 'vn') {
      const excluded = new Set(selectedVns.map((vn) => vn.id));
      return (baseSearchResults as Vn[]).filter((vn) => !excluded.has(vn.id));
    }
    const excluded = new Set(selectedCharacters.map((character) => character.id));
    return (baseSearchResults as Character[]).filter((character) => !excluded.has(character.id));
  }, [baseSearchResults, mode, selectedVns, selectedCharacters]);

  const localSearchPerPage = isMobile ? MOBILE_VN_SEARCH_RESULTS_PER_PAGE : LOCAL_SEARCH_RESULTS_PER_PAGE;
  const localSearchPageCount = pageCount(searchResults.length, localSearchPerPage);
  const currentLocalSearchPage = Math.min(localSearchPage, localSearchPageCount);
  const visibleSearchResults = pageItems<Vn | Character>(searchResults as (Vn | Character)[], currentLocalSearchPage, localSearchPerPage);
  const scrollToPanelTop = (target: HTMLElement | null) => target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const resetScrollTop = (target: HTMLElement | null) => {
    if (target) target.scrollTop = 0;
  };
  const changeLocalSearchPage = (page: number) => {
    setLocalSearchPage(Math.min(localSearchPageCount, Math.max(1, page)));
    window.requestAnimationFrame(() => {
      resetScrollTop(localSearchListRef.current);
    });
  };

  const vnProfileSpoilerOff = useMemo(() => {
    if (!deferredSelectedVns.length) return new Map<number, number>();
    return mergeVectors(deferredSelectedVns.map((vn) => makeVector(vn.tags, tagMeta, 'tag', false, false, profileSexualTagIds)));
  }, [deferredSelectedVns, tagMeta, profileSexualTagIds]);

  const vnProfileSpoilerOn = useMemo(() => {
    if (!deferredSelectedVns.length) return new Map<number, number>();
    return mergeVectors(deferredSelectedVns.map((vn) => makeVector(vn.tags, tagMeta, 'tag', true, false, profileSexualTagIds)));
  }, [deferredSelectedVns, tagMeta, profileSexualTagIds]);

  const vnProfile = renderShowSpoiler ? vnProfileSpoilerOn : vnProfileSpoilerOff;

  const vnProfileSpoilers = useMemo(() => mergeSpoilers(deferredSelectedVns.map((vn) => vn.tags), 'tag', tagMeta, renderShowSexual, renderShowSpoiler), [deferredSelectedVns, tagMeta, renderShowSexual, renderShowSpoiler]);

  const characterProfileSpoilerOff = useMemo(() => {
    if (!deferredSelectedCharacters.length) return new Map<number, number>();
    return mergeVectors(deferredSelectedCharacters.map((character) => makeVector(character.traits, traitMeta, 'trait', false, false, profileSexualTraitIds)));
  }, [deferredSelectedCharacters, traitMeta, profileSexualTraitIds]);

  const characterProfileSpoilerOn = useMemo(() => {
    if (!deferredSelectedCharacters.length) return new Map<number, number>();
    return mergeVectors(deferredSelectedCharacters.map((character) => makeVector(character.traits, traitMeta, 'trait', true, false, profileSexualTraitIds)));
  }, [deferredSelectedCharacters, traitMeta, profileSexualTraitIds]);

  const characterProfile = renderShowSpoiler ? characterProfileSpoilerOn : characterProfileSpoilerOff;

  const characterProfileSpoilers = useMemo(() => mergeSpoilers(deferredSelectedCharacters.map((character) => character.traits), 'trait', traitMeta, renderShowSexual, renderShowSpoiler), [deferredSelectedCharacters, traitMeta, renderShowSexual, renderShowSpoiler]);

  const activePriorityTags = useMemo(() => new Set([...priorityTags].filter((id) => vnProfileSpoilerOn.has(id) || vnProfileSpoilerOff.has(id))), [priorityTags, vnProfileSpoilerOn, vnProfileSpoilerOff]);
  const activePriorityTraits = useMemo(() => new Set([...priorityTraits].filter((id) => characterProfileSpoilerOn.has(id) || characterProfileSpoilerOff.has(id))), [priorityTraits, characterProfileSpoilerOn, characterProfileSpoilerOff]);
  const tagSearchTagGroupsSpoilerOff = useMemo(() => data ? metaSearchGroups('tag', tagSearchTags, data.tags, tagMeta, true, false, false, false) : [], [data, tagSearchTags, tagMeta]);
  const tagSearchTagGroupsSpoilerOn = useMemo(() => data ? metaSearchGroups('tag', tagSearchTags, data.tags, tagMeta, true, true, false, false) : [], [data, tagSearchTags, tagMeta]);
  const tagSearchTraitGroupsSpoilerOff = useMemo(() => data ? metaSearchGroups('trait', tagSearchTraits, data.traits, traitMeta, true, false) : [], [data, tagSearchTraits, traitMeta]);
  const tagSearchTraitGroupsSpoilerOn = useMemo(() => data ? metaSearchGroups('trait', tagSearchTraits, data.traits, traitMeta, true, true) : [], [data, tagSearchTraits, traitMeta]);
  const tagSearchTagGroups = renderShowSpoiler ? tagSearchTagGroupsSpoilerOn : tagSearchTagGroupsSpoilerOff;
  const tagSearchTraitGroups = renderShowSpoiler ? tagSearchTraitGroupsSpoilerOn : tagSearchTraitGroupsSpoilerOff;
  const tagSearchSexualTagIdsSpoilerOff = useMemo(() => selectedSexualAlternativeIds(tagSearchTagGroupsSpoilerOff, tagMeta), [tagSearchTagGroupsSpoilerOff, tagMeta]);
  const tagSearchSexualTagIdsSpoilerOn = useMemo(() => selectedSexualAlternativeIds(tagSearchTagGroupsSpoilerOn, tagMeta), [tagSearchTagGroupsSpoilerOn, tagMeta]);
  const tagSearchSexualTraitIdsSpoilerOff = useMemo(() => selectedSexualAlternativeIds(tagSearchTraitGroupsSpoilerOff, traitMeta), [tagSearchTraitGroupsSpoilerOff, traitMeta]);
  const tagSearchSexualTraitIdsSpoilerOn = useMemo(() => selectedSexualAlternativeIds(tagSearchTraitGroupsSpoilerOn, traitMeta), [tagSearchTraitGroupsSpoilerOn, traitMeta]);

  useEffect(() => {
    if (!data || !deferredDataWorkReady || !recommendationWorkerRef.current) return;
    setWorkerReady(false);
    setWorkerComputing(false);
    recommendationWorkerRef.current.postMessage({ type: 'init', data });
  }, [data, deferredDataWorkReady]);

  const startRecommendationSearch = useCallback(() => {
    if (!data || !persistenceReady || !workerReady || !recommendationWorkerRef.current) return;
    const hasRecommendationCriteria = mode === 'vn' ? deferredSelectedVns.length > 0 : mode === 'character' ? deferredSelectedCharacters.length > 0 : tagSearchTags.size > 0 || tagSearchTraits.size > 0;
    if (!hasRecommendationCriteria) {
      recommendationRequestIdRef.current += 1;
      setWorkerComputing(false);
      setWorkerProgress(null);
      setWorkerResult(emptyWorkerResult());
      setShowRecommendations(false);
      return;
    }
    const requestId = recommendationRequestIdRef.current + 1;
    recommendationRequestIdRef.current = requestId;
    recommendationDetailVersionRef.current += 1;
    detailQueueRef.current = detailQueueRef.current.filter((item) => !item.key.startsWith('recommendation-'));
    setRecommendationDetails({});
    setWorkerComputing(true);
    const hasProfileSearch = mode === 'vn' ? deferredSelectedVns.length > 0 : mode === 'character' ? deferredSelectedCharacters.length > 0 : false;
    const progressTotal = hasProfileSearch ? Math.max(1, profileSampleRounds) : 1;
    setWorkerProgress(hasProfileSearch
      ? { randomize: { current: 0, total: progressTotal }, search: { current: 0, total: progressTotal } }
      : { search: { current: 0, total: progressTotal } });
    setShowRecommendations(true);
    recommendationWorkerRef.current.postMessage({
      type: 'compute',
      requestId,
      params: {
        selectedVnIds: mode === 'vn' ? deferredSelectedVns.map((vn) => vn.id) : [],
        selectedCharacterIds: mode === 'character' ? deferredSelectedCharacters.map((character) => character.id) : [],
        activePriorityTags: mode === 'vn' ? [...activePriorityTags] : [],
        activePriorityTraits: mode === 'character' ? [...activePriorityTraits] : [],
        tagLimit,
        traitLimit,
        profileSampleRounds,
        includeSpoiler: renderShowSpoiler,
        tagSearchTags: [...tagSearchTags],
        tagSearchTraits: [...tagSearchTraits],
        tagSearchTagGroupsSpoilerOff: tagSearchTagGroupsSpoilerOff.map((group) => ({ selectedId: group.selectedId, alternatives: [...group.alternatives] })),
        tagSearchTagGroupsSpoilerOn: tagSearchTagGroupsSpoilerOn.map((group) => ({ selectedId: group.selectedId, alternatives: [...group.alternatives] })),
        tagSearchTraitGroupsSpoilerOff: tagSearchTraitGroupsSpoilerOff.map((group) => ({ selectedId: group.selectedId, alternatives: [...group.alternatives] })),
        tagSearchTraitGroupsSpoilerOn: tagSearchTraitGroupsSpoilerOn.map((group) => ({ selectedId: group.selectedId, alternatives: [...group.alternatives] })),
        tagSearchSexualTagIdsSpoilerOff: [...tagSearchSexualTagIdsSpoilerOff],
        tagSearchSexualTagIdsSpoilerOn: [...tagSearchSexualTagIdsSpoilerOn],
        tagSearchSexualTraitIdsSpoilerOff: [...tagSearchSexualTraitIdsSpoilerOff],
        tagSearchSexualTraitIdsSpoilerOn: [...tagSearchSexualTraitIdsSpoilerOn],
        minVotes,
        tagRoleFilter,
        preferCharacterAverage,
        resultSort,
        sortDirection
      }
    });
  }, [data, persistenceReady, workerReady, mode, deferredSelectedVns, deferredSelectedCharacters, activePriorityTags, activePriorityTraits, tagLimit, traitLimit, profileSampleRounds, renderShowSpoiler, tagSearchTags, tagSearchTraits, tagSearchTagGroupsSpoilerOff, tagSearchTagGroupsSpoilerOn, tagSearchTraitGroupsSpoilerOff, tagSearchTraitGroupsSpoilerOn, tagSearchSexualTagIdsSpoilerOff, tagSearchSexualTagIdsSpoilerOn, tagSearchSexualTraitIdsSpoilerOff, tagSearchSexualTraitIdsSpoilerOn, minVotes, tagRoleFilter, preferCharacterAverage, resultSort, sortDirection]);

  useEffect(() => {
    recommendationRequestIdRef.current += 1;
    setWorkerComputing(false);
    setWorkerProgress(null);
    setWorkerResult(emptyWorkerResult());
    setShowRecommendations(false);
  }, [mode, deferredSelectedVns, deferredSelectedCharacters, activePriorityTags, activePriorityTraits, tagLimit, traitLimit, profileSampleRounds, tagSearchTags, tagSearchTraits, tagSearchTagGroupsSpoilerOff, tagSearchTagGroupsSpoilerOn, tagSearchTraitGroupsSpoilerOff, tagSearchTraitGroupsSpoilerOn, tagSearchSexualTagIdsSpoilerOff, tagSearchSexualTagIdsSpoilerOn, tagSearchSexualTraitIdsSpoilerOff, tagSearchSexualTraitIdsSpoilerOn, minVotes, tagRoleFilter, preferCharacterAverage, resultSort, sortDirection]);

  const activeWorkerResult = renderShowSpoiler ? workerResult.spoilerOn : workerResult.spoilerOff;

  const vnRecommendations = useMemo<Recommendation<Vn>[]>(() => activeWorkerResult.vnRecommendations
    .map((item) => {
      const vn = vnById.get(item.id);
      return vn ? { ...vn, ...item } : null;
    })
    .filter(Boolean)
    .map((item) => item as Recommendation<Vn>), [activeWorkerResult.vnRecommendations, vnById]);

  const characterRecommendations = useMemo<Recommendation<Character>[]>(() => activeWorkerResult.characterRecommendations
    .map((item) => {
      const character = characterById.get(item.id);
      return character ? { ...character, ...item } : null;
    })
    .filter(Boolean)
    .map((item) => item as Recommendation<Character>), [activeWorkerResult.characterRecommendations, characterById]);

  const tagSearchVnResults = useMemo<Recommendation<Vn>[]>(() => activeWorkerResult.tagSearchVnResults
    .map((item) => {
      const vn = vnById.get(item.id);
      return vn ? { ...vn, ...item } : null;
    })
    .filter(Boolean)
    .map((item) => item as Recommendation<Vn>), [activeWorkerResult.tagSearchVnResults, vnById]);

  const tagSearchCharacterResults = useMemo<Recommendation<Character>[]>(() => activeWorkerResult.tagSearchCharacterResults
    .map((item) => {
      const character = characterById.get(item.id);
      return character ? { ...character, ...item } : null;
    })
    .filter(Boolean)
    .map((item) => item as Recommendation<Character>), [activeWorkerResult.tagSearchCharacterResults, characterById]);

  const mixedTagResults = useMemo<MixedTagResult[]>(() => activeWorkerResult.mixedTagResults
    .map((item) => {
      const vn = vnById.get(item.vnId);
      const character = characterById.get(item.characterId);
      if (!vn || !character) return null;
      const vnRef = activeWorkerResult.tagSearchVnResults.find((result) => result.id === item.vnId);
      const characterRef = activeWorkerResult.tagSearchCharacterResults.find((result) => result.id === item.characterId);
      if (!vnRef || !characterRef) return null;
      return { vn: { ...vn, ...vnRef }, character: { ...character, ...characterRef }, similarity: item.similarity, priorityMatched: item.priorityMatched, priorityTotal: item.priorityTotal, priorityConfidence: item.priorityConfidence };
    })
    .filter(Boolean)
    .map((item) => item as MixedTagResult), [activeWorkerResult.mixedTagResults, activeWorkerResult.tagSearchVnResults, activeWorkerResult.tagSearchCharacterResults, vnById, characterById]);

  const dataBuildDate = data?.buildDateUtc8 ?? (data ? formatUtc8Date(data.generatedAt) : null);

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

  const clearSelections = () => {
    if (mode === 'vn') setSelectedVns([]);
    else if (mode === 'character') setSelectedCharacters([]);
  };

  const hasSelectedSamples = mode === 'vn' ? selectedVns.length > 0 : selectedCharacters.length > 0;

  const sortedVnRecommendations = vnRecommendations;
  const sortedCharacterRecommendations = characterRecommendations;
  const sortedTagSearchVnResults = tagSearchVnResults;
  const sortedTagSearchCharacterResults = tagSearchCharacterResults;
  const sortedMixedTagResults = mixedTagResults;
  const tagModeHasCriteria = Boolean(tagSearchTags.size || tagSearchTraits.size);
  const currentModeHasCriteria = mode === 'vn' ? Boolean(selectedVns.length) : mode === 'character' ? Boolean(selectedCharacters.length) : tagModeHasCriteria;
  const currentModeComputing = workerComputing && currentModeHasCriteria;
  const profilePanelComputing = (mode === 'vn' || mode === 'character') && profileComputing;
  const tagModeResultCount = tagSearchTags.size && tagSearchTraits.size ? sortedMixedTagResults.length : tagSearchTags.size ? sortedTagSearchVnResults.length : tagSearchTraits.size ? sortedTagSearchCharacterResults.length : 0;
  const activeResultCount = mode === 'vn' ? sortedVnRecommendations.length : mode === 'character' ? sortedCharacterRecommendations.length : tagModeResultCount;
  const activePageCount = pageCount(activeResultCount);
  const currentResultPage = Math.min(resultPage, activePageCount);
  const formatWorkerProgress = (progress?: { current: number; total: number }) => progress && progress.total > 0 ? `（${Math.min(progress.current, progress.total)}/${progress.total}）` : '';
  const recommendationStatusText = showRecommendations
    ? `${t.candidates}：${activeResultCount.toLocaleString()}，${t.perPage} ${RESULTS_PER_PAGE}，${t.currentPage} ${currentResultPage} / ${activePageCount} ${t.page}`
    : t.choosePage;
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

  useEffect(() => {
    if (!showRecommendations || currentModeComputing || !activeResultCount) return;
    requestVisibleRecommendationDetails();
  }, [showRecommendations, currentModeComputing, activeResultCount, currentResultPage, renderShowSpoiler, mode, tagSearchTags.size, tagSearchTraits.size, sortedVnRecommendations, sortedCharacterRecommendations, sortedTagSearchVnResults, sortedTagSearchCharacterResults, sortedMixedTagResults]);

  const showRecommendationResults = () => {
    startRecommendationSearch();
  };

  const changeResultPage = (page: number) => {
    const nextPage = Math.min(activePageCount, Math.max(1, page));
    setResultPage(nextPage);
    window.requestAnimationFrame(() => {
      resetScrollTop(recommendationListRef.current);
      if (isMobile) scrollToPanelTop(recommendationResultsRef.current);
    });
  };

  const profileItems = mode === 'vn'
    ? [...vnProfile.entries()].filter(([id]) => {
      const meta = tagMeta.get(id);
      return (renderShowBlockedTags || !meta?.blocked) && (renderShowTechnicalTags || !meta?.tech || priorityTags.has(id));
    }).sort((a, b) => b[1] - a[1])
    : [...characterProfile.entries()].sort((a, b) => b[1] - a[1]);
  const groupedProfileTraits = mode === 'character' ? profileTraitGroups(profileItems, traitMeta, renderShowSexual, metaLanguage, uiLanguage) : [];

  const togglePriority = (id: number) => {
    const setter = mode === 'vn' ? setPriorityTags : setPriorityTraits;
    startTransition(() => {
      setter((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    });
  };

  const progressRingValue = Math.min(100, Math.max(0, loadState.progress));

  if (error) return <LoadingErrorView error={error} language={uiLanguage} darkMode={darkMode} />;
  if (!appReady || !data) return <main className={`shell loadingShell ${darkMode ? 'themeDark' : 'themeLight'}`}><section className="panel loadingPanel"><div className="progressRing"><svg viewBox="0 0 132 132" aria-hidden="true"><circle className="progressRingTrack" cx="66" cy="66" r="54" pathLength="100" /><circle className="progressRingValue" cx="66" cy="66" r="54" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progressRingValue} /></svg><span>{progressRingValue}%</span></div><strong>{t.loading}</strong><p className="loadingStage">{localizedStage(loadState.stage, uiLanguage)}</p>{loadState.detail ? <div className="loadingDetails"><span>{t.loadingDetailLoaded}：{formatBytes(loadState.detail.loaded)}</span><span>{t.loadingDetailTotal}：{loadState.detail.total ? formatBytes(loadState.detail.total) : t.loadingUnknown}</span><span>{t.loadingDetailSpeed}：{loadState.detail.speed ? formatSpeed(loadState.detail.speed) : t.loadingCalculating}</span></div> : null}</section></main>;

  return (
    <main className={`shell ${darkMode ? 'themeDark' : 'themeLight'}`}>
      <header className="hero">
        <div>
          <div className="heroContent">
            <div>
              <p className="eyebrow">{t.source}</p>
              <h1>VNDB Profile Search</h1>
              <div className="heroControls">
                <button className="themeToggle" onClick={() => setDarkMode((value) => !value)}>{darkMode ? t.themeLight : t.themeDark}</button>
                <div className="languageControlsCompact">
                  <div className="languageTools compactLanguageTools" aria-label={t.metaLanguageLabel}>
                    <span>{t.metaLanguage}</span>
                    <button className={metaLanguage === 'zh' ? 'active' : ''} onClick={() => setMetaLanguage('zh')}>中文</button>
                    <button className={metaLanguage === 'ja' ? 'active' : ''} onClick={() => setMetaLanguage('ja')}>日本語</button>
                    <button className={metaLanguage === 'origin' ? 'active' : ''} onClick={() => setMetaLanguage('origin')}>origin</button>
                  </div>
                  <div className="languageTools compactLanguageTools" aria-label={t.uiLanguageLabel}>
                    <span>{t.uiLanguage}</span>
                    <button className={uiLanguage === 'zh' ? 'active' : ''} onClick={() => setUiLanguage('zh')}>中文</button>
                    <button className={uiLanguage === 'ja' ? 'active' : ''} onClick={() => setUiLanguage('ja')}>日本語</button>
                    <button className={uiLanguage === 'en' ? 'active' : ''} onClick={() => setUiLanguage('en')}>English</button>
                  </div>
                </div>
              </div>
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
          <label><input type="checkbox" checked={showSexual} onChange={(event) => { const checked = event.target.checked; startTransition(() => setShowSexual(checked)); }} /> {t.showR18}</label>
          <label><input type="checkbox" checked={showSpoiler} onChange={(event) => { const checked = event.target.checked; startTransition(() => setShowSpoiler(checked)); }} /> {t.allowSpoiler}</label>
          {(mode === 'vn' || mode === 'tag') ? <label><input type="checkbox" checked={showBlockedTags} onChange={(event) => { const checked = event.target.checked; startTransition(() => setShowBlockedTags(checked)); }} /> {t.showBlockedTags}</label> : null}
          {(mode === 'vn' || mode === 'tag') ? <label><input type="checkbox" checked={showTechnicalTags} onChange={(event) => { const checked = event.target.checked; startTransition(() => setShowTechnicalTags(checked)); }} /> {t.showTechnicalTags}</label> : null}
        </div>
        <div className="toolbarRow toolbarSpecific">
          {mode !== 'tag' ? <label className="searchBox">
            <span>{mode === 'vn' ? t.searchVn : t.searchCharacter}</span>
            <input value={query} onChange={(event) => setActiveQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setActiveSubmittedQuery(query); }} />
          </label> : null}
          {mode !== 'tag' ? <button onClick={() => setActiveSubmittedQuery(query)}>{t.searchLocal}</button> : null}
        </div>
      </section>

      {mode === 'tag' ? <TagSearchPanel tags={data.tags} traits={data.traits} tagMeta={tagMeta} traitMeta={traitMeta} tagUsageCounts={tagUsageCounts} traitUsageCounts={traitUsageCounts} selectedTags={tagSearchTags} selectedTraits={tagSearchTraits} setSelectedTags={setTagSearchTags} setSelectedTraits={setTagSearchTraits} showSexual={renderShowSexual} showSpoiler={renderShowSpoiler} showBlockedTags={renderShowBlockedTags} showTechnicalTags={renderShowTechnicalTags} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} /> : <section className="grid two">
          <div className="panel localSearchPanel" ref={localSearchPanelRef}>
          <h2>{t.localResults}</h2>
          <p className="resultMeta">{t.candidates}：{searchResults.length.toLocaleString()}，{t.currentPage} {currentLocalSearchPage} / {localSearchPageCount} {t.page}</p>
          <div className="resultActions localSearchActions">
            <button onClick={() => changeLocalSearchPage(currentLocalSearchPage - 1)} disabled={currentLocalSearchPage <= 1}>{isMobile ? t.previousItem : t.previous}</button>
            <button onClick={() => changeLocalSearchPage(currentLocalSearchPage + 1)} disabled={currentLocalSearchPage >= localSearchPageCount}>{isMobile ? t.nextItem : t.next}</button>
          </div>
          <div ref={localSearchListRef} className={`list localSearchList ${isMobile ? 'mobileVnLocalList' : ''}`}>
            {visibleSearchResults.map((item) => mode === 'vn'
              ? <VnCard key={`vn-${(item as Vn).id}`} vn={item as Vn} meta={tagMeta} showSexual={renderShowSexual} showSpoiler={renderShowSpoiler} showBlockedTags={renderShowBlockedTags} showTechnicalTags={renderShowTechnicalTags} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} priorityMatched={priorityTags.size ? priorityMatch(priorityTags, makeVector((item as Vn).tags, tagMeta, 'tag', renderShowSpoiler, false, activePriorityTags)) : undefined} priorityTotal={priorityTags.size || undefined} priorityConfidenceDecimals={2} onAdd={() => addSelection(item)} />
              : <CharacterCard key={`ch-${(item as Character).id}`} character={item as Character} vns={vnById} meta={traitMeta} showSexual={renderShowSexual} showSpoiler={renderShowSpoiler} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} preferAverage={preferCharacterAverage} onAdd={() => addSelection(item)} />)}
          </div>
        </div>
        <div className="panel sampleProfilePanel" ref={sampleProfilePanelRef}>
          <div className="samplePanelHead">
            <h2>{t.selectedSamples}</h2>
            <button className="sampleClearButton" onClick={clearSelections} disabled={!hasSelectedSamples}>{t.clear}</button>
          </div>
          <div className="list compact selectedSampleList">
            {mode === 'vn'
              ? selectedVns.map((vn) => <VnCard key={`selected-vn-${vn.id}`} vn={vn} meta={tagMeta} showSexual={renderShowSexual} showSpoiler={renderShowSpoiler} showBlockedTags={renderShowBlockedTags} showTechnicalTags={renderShowTechnicalTags} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} detail={vnDetails[vn.id]} showMedia showDescription={false} priorityMatched={priorityTags.size ? priorityMatch(priorityTags, makeVector(vn.tags, tagMeta, 'tag', renderShowSpoiler, false, activePriorityTags)) : undefined} priorityTotal={priorityTags.size || undefined} priorityConfidenceDecimals={2} onRemove={() => setSelectedVns((list) => list.filter((it) => it.id !== vn.id))} />)
              : selectedCharacters.map((character) => <CharacterCard key={`selected-ch-${character.id}`} character={character} vns={vnById} meta={traitMeta} showSexual={renderShowSexual} showSpoiler={renderShowSpoiler} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} preferAverage={preferCharacterAverage} detail={characterDetails[character.id]} showMedia showDescription={false} onRemove={() => setSelectedCharacters((list) => list.filter((it) => it.id !== character.id))} />)}
          </div>
          <div className="profileHead">
            <h3>{t.profile}</h3>
          </div>
          {profilePanelComputing ? <div className="empty profileComputingNotice">{t.computing}</div> : mode === 'vn' ? <div className="chips profileChips">
            {profileItems.map(([id, value]) => {
              const meta = tagMeta.get(id);
              if (!meta) return null;
              const name = metaName(meta, renderShowSexual, metaLanguage, uiLanguage);
              const priority = priorityTags.has(id);
              const chipSpoilerClass = spoilerClass(vnProfileSpoilers.get(id) ?? 0);
              return <button key={`g-${id}`} className={`chip profileTracked ${meta.sexual ? 'sexual' : ''} ${meta.tech ? 'technical' : ''} ${meta.blocked ? 'blocked' : ''} ${chipSpoilerClass} ${priority ? 'priority' : ''}`} onClick={() => togglePriority(id)} title={metaTooltip(meta, renderShowSexual, metaLanguage, uiLanguage)}>{priority ? '★ ' : ''}{name} {value.toFixed(2)}</button>;
            })}
          </div> : <div className="traitGroupList profileChips">
            {groupedProfileTraits.map(([label, items]) => <div className="traitGroup" key={`profile-group-${label}`}>
              <div className="traitGroupLabel">{label}</div>
              <div className="chips">
                {items.map(([id, value]) => {
                  const meta = traitMeta.get(id);
                  if (!meta) return null;
                  const name = metaName(meta, renderShowSexual, metaLanguage, uiLanguage);
                  const priority = priorityTraits.has(id);
                  const chipSpoilerClass = spoilerClass(characterProfileSpoilers.get(id) ?? 0);
                  return <button key={`i-${id}`} className={`chip profileTracked ${meta.sexual ? 'sexual' : ''} ${chipSpoilerClass} ${priority ? 'priority' : ''}`} onClick={() => togglePriority(id)} title={metaTooltip(meta, renderShowSexual, metaLanguage, uiLanguage)}>{priority ? '★ ' : ''}{name} {value.toFixed(2)}</button>;
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
            {currentModeComputing ? <div className="recommendationProgress">
              {workerProgress?.randomize ? <p>{t.randomizingProfile}{formatWorkerProgress(workerProgress.randomize)}</p> : null}
              {workerProgress?.search ? <p>{t.computing}{formatWorkerProgress(workerProgress.search)}</p> : null}
              {workerProgress?.fit ? <p>{t.fittingResults}</p> : null}
              {!workerProgress ? <p>{t.computing}</p> : null}
            </div> : <p>{recommendationStatusText}</p>}
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
            {(mode === 'vn' || mode === 'character' || mode === 'tag') ? <label className="votes limitControl">{t.profileSampleRounds} <input type="number" min={1} max={1024} value={profileSampleRounds} onChange={(event) => setProfileSampleRounds(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /></label> : null}
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
            <button onClick={showRecommendationResults} disabled={currentModeComputing || !currentModeHasCriteria || !workerReady}>{t.loadPage}</button>
          </div>
        </div>
        {showRecommendations && activeResultCount > 0 ? <div ref={recommendationListRef} className="list results">
          {mode === 'vn'
            ? visibleVnRecommendations.map((vn) => <VnCard key={`rec-vn-${vn.id}`} vn={vn} meta={tagMeta} showSexual={renderShowSexual} showSpoiler={renderShowSpoiler} showBlockedTags={renderShowBlockedTags} showTechnicalTags={renderShowTechnicalTags} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} vns={vnById} detail={recommendationDetails[`v${vn.id}`]} showMedia similarity={vn.similarity} overlap={vn.overlap} priorityMatched={vn.priorityMatched} priorityTotal={vn.priorityTotal} priorityConfidence={vn.priorityConfidence} relations={vn.relations} />)
            : mode === 'character'
              ? visibleCharacterRecommendations.map((character) => <CharacterCard key={`rec-ch-${character.id}`} character={character} vns={vnById} meta={traitMeta} showSexual={renderShowSexual} showSpoiler={renderShowSpoiler} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} preferAverage={preferCharacterAverage} detail={recommendationDetails[`c${character.id}`]} showMedia similarity={character.similarity} overlap={character.overlap} priorityMatched={character.priorityMatched} priorityTotal={character.priorityTotal} priorityConfidence={character.priorityConfidence} />)
              : tagSearchTags.size && tagSearchTraits.size
                ? visibleMixedTagResults.map((result) => <MixedTagCard key={`mixed-${result.vn.id}-${result.character.id}`} result={result} tagMeta={tagMeta} traitMeta={traitMeta} vns={vnById} showSexual={renderShowSexual} showSpoiler={renderShowSpoiler} showBlockedTags={renderShowBlockedTags} showTechnicalTags={renderShowTechnicalTags} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} vnDetail={recommendationDetails[`v${result.vn.id}`]} characterDetail={recommendationDetails[`c${result.character.id}`]} minVotes={minVotes} roleFilter={tagRoleFilter} />)
                : tagSearchTags.size
                  ? visibleTagSearchVnResults.map((vn) => <VnCard key={`tag-vn-${vn.id}`} vn={vn} meta={tagMeta} showSexual={renderShowSexual} showSpoiler={renderShowSpoiler} showBlockedTags={renderShowBlockedTags} showTechnicalTags={renderShowTechnicalTags} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} vns={vnById} detail={recommendationDetails[`v${vn.id}`]} showMedia similarity={vn.similarity} overlap={vn.overlap} priorityMatched={vn.priorityMatched} priorityTotal={vn.priorityTotal} priorityConfidence={vn.priorityConfidence} />)
                  : visibleTagSearchCharacterResults.map((character) => <CharacterCard key={`tag-ch-${character.id}`} character={character} vns={vnById} meta={traitMeta} showSexual={renderShowSexual} showSpoiler={renderShowSpoiler} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} preferAverage={preferCharacterAverage} detail={recommendationDetails[`c${character.id}`]} showMedia similarity={character.similarity} overlap={character.overlap} priorityMatched={character.priorityMatched} priorityTotal={character.priorityTotal} priorityConfidence={character.priorityConfidence} minVotes={minVotes} roleFilter={tagRoleFilter} />)}
        </div> : showRecommendations && !currentModeComputing ? <div className="empty">{t.noRecommendationResults}</div> : null}
      </section>

      <footer className="footer">
        {dataBuildDate ? <div>{`${t.dataLastUpdated}：UTC+08:00 ${dataBuildDate}`}</div> : null}
        <div>{t.license}</div>
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

function usageEntriesToSetMap(entries: [number, number[]][] | undefined, metas: Meta[]) {
  if (!entries) return null;
  const source = new Map(entries.map(([id, itemIds]) => [id, new Set(itemIds)]));
  return new Map(metas.map((metaItem) => [metaItem.id, source.get(metaItem.id) ?? new Set<number>()]));
}

function directMetaUsageSets(items: Array<{ id: number; tags?: Pair[]; traits?: TraitPair[] }>, metas: Meta[], meta: Map<number, Meta>, field: 'tags' | 'traits', kind: 'tag' | 'trait', includeSpoiler: boolean) {
  const direct = new Map<number, Set<number>>();
  for (const item of items) {
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
  return new Map(metas.map((metaItem) => [metaItem.id, direct.get(metaItem.id) ?? new Set<number>()]));
}

function aggregateMetaUsageCounts(directSets: Map<number, Set<number>>, metas: Meta[], kind: 'tag' | 'trait', showSexual: boolean, showSpoiler: boolean, showBlockedTags = true, showTechnicalTags = true) {
  const children = metaChildrenMap(metas);
  const aggregate = new Map<number, Set<number>>();
  const usageFor = (item: Meta, path = new Set<number>()): Set<number> => {
    if (path.has(item.id)) return new Set();
    const cached = aggregate.get(item.id);
    if (cached) return cached;
    const nextPath = new Set(path);
    nextPath.add(item.id);
    const result = new Set(directSets.get(item.id) ?? []);
    for (const child of children.get(item.id) ?? []) {
      if (!metaAllowedByFilters(child, kind, showSexual, showSpoiler, showBlockedTags, showTechnicalTags)) continue;
      for (const usageId of usageFor(child, nextPath)) result.add(usageId);
    }
    aggregate.set(item.id, result);
    return result;
  };
  return new Map(metas.map((metaItem) => [metaItem.id, metaAllowedByFilters(metaItem, kind, showSexual, showSpoiler, showBlockedTags, showTechnicalTags) ? usageFor(metaItem).size : 0]));
}

function TagSearchPanel({ tags, traits, tagMeta, traitMeta, tagUsageCounts, traitUsageCounts, selectedTags, selectedTraits, setSelectedTags, setSelectedTraits, showSexual, showSpoiler, showBlockedTags, showTechnicalTags, metaLanguage, uiLanguage, t }: { tags: Meta[]; traits: Meta[]; tagMeta: Map<number, Meta>; traitMeta: Map<number, Meta>; tagUsageCounts: Map<number, number>; traitUsageCounts: Map<number, number>; selectedTags: Set<number>; selectedTraits: Set<number>; setSelectedTags: React.Dispatch<React.SetStateAction<Set<number>>>; setSelectedTraits: React.Dispatch<React.SetStateAction<Set<number>>>; showSexual: boolean; showSpoiler: boolean; showBlockedTags: boolean; showTechnicalTags: boolean; metaLanguage: MetaLanguage; uiLanguage: UiLanguage; t: Record<string, string> }) {
  const [tagSelectorHeight, setTagSelectorHeight] = useState(() => loadMetaSelectorState('tag')?.height ?? 520);
  const [traitSelectorHeight, setTraitSelectorHeight] = useState(() => loadMetaSelectorState('trait')?.height ?? 520);
  const [tagCollapseVersion, setTagCollapseVersion] = useState(0);
  const [traitCollapseVersion, setTraitCollapseVersion] = useState(0);
  return <section className="tagSearchGrid">
    <div className="panel">
      <div className="sectionHead compactHead">
        <div><h2>{t.tagPanelTitle}</h2><p>{t.tagPanelDesc}</p></div>
        <div className="buttonRow"><button onClick={() => setTagCollapseVersion((version) => version + 1)}>{t.collapseAll}</button><button onClick={() => setSelectedTags(new Set())} disabled={!selectedTags.size}>{t.clear}</button></div>
      </div>
      <MetaSelector kind="tag" items={tags} meta={tagMeta} usageCounts={tagUsageCounts} selected={selectedTags} setSelected={setSelectedTags} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags={showBlockedTags} showTechnicalTags={showTechnicalTags} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} height={tagSelectorHeight} setHeight={setTagSelectorHeight} collapseVersion={tagCollapseVersion} />
    </div>
    <div className="panel">
      <div className="sectionHead compactHead">
        <div><h2>{t.traitPanelTitle}</h2><p>{t.traitPanelDesc}</p></div>
        <div className="buttonRow"><button onClick={() => setTraitCollapseVersion((version) => version + 1)}>{t.collapseAll}</button><button onClick={() => setSelectedTraits(new Set())} disabled={!selectedTraits.size}>{t.clear}</button></div>
      </div>
      <MetaSelector kind="trait" items={traits} meta={traitMeta} usageCounts={traitUsageCounts} selected={selectedTraits} setSelected={setSelectedTraits} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags showTechnicalTags metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} height={traitSelectorHeight} setHeight={setTraitSelectorHeight} collapseVersion={traitCollapseVersion} />
    </div>
  </section>;
}

function metaTreeGroupClass(kind: 'tag' | 'trait', label: string, groupItems: Meta[], meta: Map<number, Meta>) {
  let groupMeta: Meta | undefined;
  if (kind === 'tag') {
    groupMeta = TAG_TREE_GROUP_ROOT_IDS.has(Number(label)) ? meta.get(Number(label)) : undefined;
    if (!groupMeta) {
      const fallbackClass: Record<string, MetaFilterClass> = { cont: 'normal', ero: 'sexual', tech: 'technical', other: 'normal' };
      return ` metaRootGroup metaRootGroup-${fallbackClass[label] ?? 'normal'}`;
    }
  } else {
    groupMeta = groupItems[0] ? traitGroupMeta(groupItems[0], meta) : undefined;
  }
  return ` metaRootGroup metaRootGroup-${groupMeta ? metaFilterClass(groupMeta, kind) : 'normal'}`;
}

function metaSelectorGroupTooltip(kind: 'tag' | 'trait', label: string, groupItems: Meta[], meta: Map<number, Meta>, showSexual: boolean, metaLanguage: MetaLanguage, uiLanguage: UiLanguage, t: Record<string, string>) {
  if (kind === 'tag' && TAG_TREE_GROUP_ROOT_IDS.has(Number(label)) && groupItems[0]) return metaTooltip(groupItems[0], showSexual, metaLanguage, uiLanguage);
  if (kind === 'trait') {
    const group = groupItems.map((item) => traitGroupMeta(item, meta)).find(Boolean);
    if (group) return metaTooltip(group, showSexual, metaLanguage, uiLanguage);
  }
  const descriptions: Record<string, string> = {
    cont: t.metaCategoryContentTooltip,
    ero: t.metaCategoryR18Tooltip,
    tech: t.metaCategoryTechnicalTooltip,
    other: t.metaCategoryOtherTooltip
  };
  return descriptions[label] ?? label;
}

function SelectedMetaSummary({ selected, meta, showSexual, metaLanguage, uiLanguage, t, toggle }: { selected: Set<number>; meta: Map<number, Meta>; showSexual: boolean; metaLanguage: MetaLanguage; uiLanguage: UiLanguage; t: Record<string, string>; toggle: (id: number) => void }) {
  const selectedItems = [...selected].map((id) => meta.get(id)).filter((item): item is Meta => Boolean(item)).sort((a, b) => metaName(a, showSexual, metaLanguage, uiLanguage).localeCompare(metaName(b, showSexual, metaLanguage, uiLanguage)));
  if (!selectedItems.length) return null;
  return <div className="selectedMetaBox">
    <div className="selectedMetaTitle">{t.selectedMeta} <span>{selectedItems.length}</span></div>
    <div className="selectedMetaList">
      {selectedItems.map((item) => {
        const ancestors = metaAncestors(item, meta);
        return <div className="selectedMetaItem" key={`selected-meta-${item.id}`}>
          <button className="chip selectedMetaChip" title={metaTooltip(item, showSexual, metaLanguage, uiLanguage)} onClick={() => toggle(item.id)}>★ {metaName(item, showSexual, metaLanguage, uiLanguage)}</button>
          {ancestors.length ? <div className="selectedMetaParents"><span>{t.parentMeta}</span>{ancestors.map((parent) => <span key={`selected-meta-${item.id}-parent-${parent.id}`} className={metaChipClass(parent)} title={metaTooltip(parent, showSexual, metaLanguage, uiLanguage)}>{metaName(parent, showSexual, metaLanguage, uiLanguage)}</span>)}</div> : null}
        </div>;
      })}
    </div>
  </div>;
}

function MetaSelector({ kind, items, meta, usageCounts, selected, setSelected, showSexual, showSpoiler, showBlockedTags, showTechnicalTags, metaLanguage, uiLanguage, t, height, setHeight, collapseVersion }: { kind: 'tag' | 'trait'; items: Meta[]; meta: Map<number, Meta>; usageCounts: Map<number, number>; selected: Set<number>; setSelected: React.Dispatch<React.SetStateAction<Set<number>>>; showSexual: boolean; showSpoiler: boolean; showBlockedTags: boolean; showTechnicalTags: boolean; metaLanguage: MetaLanguage; uiLanguage: UiLanguage; t: Record<string, string>; height: number; setHeight: React.Dispatch<React.SetStateAction<number>>; collapseVersion: number }) {
  const persistedSelectorState = useMemo(() => loadMetaSelectorState(kind), [kind]);
  const [query, setQuery] = useState(() => persistedSelectorState?.query ?? '');
  const [openNodeIds, setOpenNodeIds] = useState<Set<number>>(() => new Set(persistedSelectorState?.openNodeIds ?? []));
  const [openGroupLabels, setOpenGroupLabels] = useState<Set<string>>(() => new Set(persistedSelectorState?.openGroupLabels ?? []));
  const restoredScrollRef = useRef(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = selectorRef.current?.getBoundingClientRect().height ?? height;
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    let nextHeight = startHeight;
    let frame = 0;
    target.setPointerCapture(pointerId);
    const applyHeight = () => {
      frame = 0;
      if (selectorRef.current) selectorRef.current.style.height = `${nextHeight}px`;
    };
    const move = (moveEvent: PointerEvent) => {
      nextHeight = Math.max(260, startHeight + moveEvent.clientY - startY);
      if (!frame) frame = window.requestAnimationFrame(applyHeight);
    };
    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (selectorRef.current) selectorRef.current.style.height = `${nextHeight}px`;
      setHeight(nextHeight);
      try {
        target.releasePointerCapture(pointerId);
      } catch {
      }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };
  useEffect(() => {
    if (!collapseVersion) return;
    setOpenNodeIds(new Set());
    setOpenGroupLabels(new Set());
  }, [collapseVersion]);
  useEffect(() => {
    if (restoredScrollRef.current) return;
    const element = selectorRef.current;
    if (!element) return;
    restoredScrollRef.current = true;
    window.requestAnimationFrame(() => {
      element.scrollTop = persistedSelectorState?.scrollTop ?? 0;
    });
  }, [persistedSelectorState]);
  useEffect(() => {
    const element = selectorRef.current;
    const state = {
      query,
      openNodeIds: [...openNodeIds],
      openGroupLabels: [...openGroupLabels],
      scrollTop: element?.scrollTop ?? persistedSelectorState?.scrollTop ?? 0,
      height
    };
    const timeout = window.setTimeout(() => saveMetaSelectorState(kind, state), 120);
    return () => window.clearTimeout(timeout);
  }, [kind, query, openNodeIds, openGroupLabels, height, persistedSelectorState]);
  const deferredQuery = useDeferredValue(query);
  const treeIndex = useMemo(() => {
    const treeItems = items;
    const itemIds = new Set(treeItems.map((item) => item.id));
    const children = new Map<number, Meta[]>();
    const groupRootIds = kind === 'tag' ? TAG_TREE_GROUP_ROOT_IDS : new Set<number>();
    for (const item of treeItems) {
      for (const parentId of item.parents ?? []) {
        if (!itemIds.has(parentId)) continue;
        const list = children.get(parentId) ?? [];
        list.push(item);
        children.set(parentId, list);
      }
    }
    for (const list of children.values()) list.sort((a, b) => compareMetaTreeName(a, b, true, metaLanguage));
    const searchNames = new Map<number, string>();
    const searchDescriptions = new Map<number, string>();
    for (const item of treeItems) {
      searchNames.set(item.id, metaAllNames(item));
      searchDescriptions.set(item.id, metaAllDescriptions(item));
    }
    return { treeItems, itemIds, children, searchNames, searchDescriptions, groupRootIds };
  }, [items, metaLanguage, meta, kind]);
  const isAllowedByFilter = useCallback((item: Meta) => metaAllowedByFilters(item, kind, showSexual, showSpoiler, showBlockedTags, showTechnicalTags), [kind, showSexual, showSpoiler, showBlockedTags, showTechnicalTags]);
  const hasAllowedParentPath = useCallback((item: Meta, path = new Set<number>()): boolean => {
    if (path.has(item.id)) return false;
    const nextPath = new Set(path);
    nextPath.add(item.id);
    const parentIds = (item.parents ?? []).filter((parentId) => treeIndex.itemIds.has(parentId) && !treeIndex.groupRootIds.has(parentId));
    if (!parentIds.length) return true;
    return parentIds.some((parentId) => {
      const parent = meta.get(parentId);
      return Boolean(parent && isAllowedByFilter(parent) && hasAllowedParentPath(parent, nextPath));
    });
  }, [treeIndex.itemIds, treeIndex.groupRootIds, meta, isAllowedByFilter]);
  const isVisible = useCallback((item: Meta) => {
    if (!treeIndex.itemIds.has(item.id)) return false;
    if (!isAllowedByFilter(item)) return false;
    return hasAllowedParentPath(item);
  }, [treeIndex.itemIds, isAllowedByFilter, hasAllowedParentPath]);
  const hasVisibleParent = useCallback((item: Meta) => (item.parents ?? []).some((parentId) => {
    const parent = meta.get(parentId);
    return parent ? isVisible(parent) : false;
  }), [meta, isVisible]);
  const isDescendantOf = useCallback((item: Meta, ancestorId: number, path = new Set<number>()): boolean => {
    if (path.has(item.id)) return false;
    if ((item.parents ?? []).includes(ancestorId)) return true;
    const nextPath = new Set(path);
    nextPath.add(item.id);
    return (item.parents ?? []).some((parentId) => {
      const parent = meta.get(parentId);
      return parent ? isDescendantOf(parent, ancestorId, nextPath) : false;
    });
  }, [meta]);
  const shouldDisplayUnderParent = useCallback((parent: Meta, child: Meta) => !(child.parents ?? []).some((parentId) => {
    if (parentId === parent.id) return false;
    const otherParent = meta.get(parentId);
    return otherParent ? isVisible(otherParent) && isDescendantOf(otherParent, parent.id) : false;
  }), [meta, isVisible, isDescendantOf]);
  const hasVisibleDisplayChildren = useCallback((item: Meta, visibleIds: Set<number> | null) => (treeIndex.children.get(item.id) ?? []).some((child) => isVisible(child) && shouldDisplayUnderParent(item, child) && (!visibleIds || visibleIds.has(child.id))), [treeIndex.children, isVisible, shouldDisplayUnderParent]);
  const compareMetaTreeDisplay = useCallback((a: Meta, b: Meta, visibleIds: Set<number> | null) => {
    const childDiff = Number(hasVisibleDisplayChildren(b, visibleIds)) - Number(hasVisibleDisplayChildren(a, visibleIds));
    return childDiff || compareMetaTreeName(a, b, true, metaLanguage);
  }, [hasVisibleDisplayChildren, metaLanguage]);
  const q = text(deferredQuery);
  const filteredTree = useMemo(() => {
    if (!q) return { visibleIds: null as Set<number> | null, matchedIds: new Set<number>() };
    const titleMatchedIds = new Set<number>();
    for (const item of treeIndex.treeItems) {
      if (item.applicable === false || !isVisible(item)) continue;
      if ((treeIndex.searchNames.get(item.id) ?? '').includes(q)) titleMatchedIds.add(item.id);
    }
    const matchedIds = titleMatchedIds.size ? titleMatchedIds : new Set<number>();
    if (!titleMatchedIds.size) {
      for (const item of treeIndex.treeItems) {
        if (item.applicable === false || !isVisible(item)) continue;
        if ((treeIndex.searchDescriptions.get(item.id) ?? '').includes(q)) matchedIds.add(item.id);
      }
    }
    const visibleIds = new Set<number>();
    const addVisibleAncestors = (item: Meta, path = new Set<number>()) => {
      if (path.has(item.id)) return;
      const nextPath = new Set(path);
      nextPath.add(item.id);
      const displayParentIds = (item.parents ?? []).filter((parentId) => {
        const parent = meta.get(parentId);
        return parent && treeIndex.itemIds.has(parentId) && isVisible(parent) && shouldDisplayUnderParent(parent, item);
      });
      if (!displayParentIds.length) return;
      for (const parentId of displayParentIds) {
        visibleIds.add(parentId);
        const parent = meta.get(parentId);
        if (parent) addVisibleAncestors(parent, nextPath);
      }
    };
    for (const id of matchedIds) {
      visibleIds.add(id);
      const item = meta.get(id);
      if (item) addVisibleAncestors(item);
    }
    return { visibleIds, matchedIds };
  }, [q, treeIndex, isVisible, meta, shouldDisplayUnderParent]);
  const selectedDescendantIds = useMemo(() => {
    const ids = new Set<number>();
    for (const id of selected) {
      const item = meta.get(id);
      if (!item) continue;
      for (const ancestor of metaAncestors(item, meta)) ids.add(ancestor.id);
    }
    for (const id of selected) ids.delete(id);
    return ids;
  }, [selected, meta]);
  const labels: Record<string, string> = { cont: t.metaCategoryContent, ero: 'R18', tech: t.metaCategoryTechnical, other: t.metaCategoryOther };
  const toggle = useCallback((id: number) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }), [setSelected]);
  const groupEntries = useMemo(() => {
    const groups = new Map<string, Meta[]>();
    const addToGroup = (label: string, item: Meta) => {
      const list = groups.get(label) ?? [];
      if (!list.some((current) => current.id === item.id)) list.push(item);
      groups.set(label, list);
    };
    for (const item of treeIndex.treeItems) {
      if (!isVisible(item)) continue;
      if (filteredTree.visibleIds && !filteredTree.visibleIds.has(item.id)) continue;
      if (hasVisibleParent(item)) continue;
      const label = kind === 'tag' && treeIndex.groupRootIds.has(item.id) ? String(item.id) : kind === 'tag' ? item.cat ?? 'other' : traitGroupLabel(item, meta, showSexual, metaLanguage, uiLanguage);
      if (kind === 'trait' && item.applicable === false && label === metaName(item, true, metaLanguage, uiLanguage)) {
        const childItems = (treeIndex.children.get(item.id) ?? []).filter((child) => isVisible(child) && shouldDisplayUnderParent(item, child) && (!filteredTree.visibleIds || filteredTree.visibleIds.has(child.id)));
        for (const child of childItems) addToGroup(label, child);
        continue;
      }
      addToGroup(label, item);
    }
    for (const list of groups.values()) list.sort((a, b) => compareMetaTreeDisplay(a, b, filteredTree.visibleIds));
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [treeIndex.treeItems, treeIndex.children, isVisible, filteredTree.visibleIds, hasVisibleParent, shouldDisplayUnderParent, compareMetaTreeDisplay, kind, meta]);
  const saveScrollState = useCallback(() => {
    const element = selectorRef.current;
    saveMetaSelectorState(kind, {
      query,
      openNodeIds: [...openNodeIds],
      openGroupLabels: [...openGroupLabels],
      scrollTop: element?.scrollTop ?? 0,
      height
    });
  }, [kind, query, openNodeIds, openGroupLabels, height]);
  return <div className="metaSelectorWrap">
    <label className="metaFilter"><span>{kind === 'tag' ? t.tagFilter : t.traitFilter}</span><input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <SelectedMetaSummary selected={selected} meta={meta} showSexual={showSexual} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} toggle={toggle} />
    <div ref={selectorRef} className="metaSelector" style={{ height }} onScroll={saveScrollState}>
      {groupEntries.map(([label, groupItems]) => <details key={`${kind}-group-${label}`} className={metaTreeGroupClass(kind, label, groupItems, meta)} open={Boolean(q) || openGroupLabels.has(label)} onToggle={(event) => {
        const open = event.currentTarget.open;
        setOpenGroupLabels((current) => {
          if (open === current.has(label)) return current;
          const next = new Set(current);
          if (open) next.add(label);
          else next.delete(label);
          return next;
        });
      }}>
        <summary title={metaSelectorGroupTooltip(kind, label, groupItems, meta, showSexual, metaLanguage, uiLanguage, t)}>{kind === 'tag' && treeIndex.groupRootIds.has(Number(label)) ? metaName(groupItems[0], showSexual, metaLanguage, uiLanguage) : labels[label] ?? label} <span>{kind === 'tag' && treeIndex.groupRootIds.has(Number(label)) ? (treeIndex.children.get(groupItems[0]?.id ?? 0) ?? []).filter((child) => isVisible(child) && shouldDisplayUnderParent(groupItems[0], child) && (!filteredTree.visibleIds || filteredTree.visibleIds.has(child.id))).length : groupItems.length}</span></summary>
        <div className="metaTree">
          {groupItems.map((item) => treeIndex.groupRootIds.has(Number(label))
            ? (treeIndex.children.get(item.id) ?? [])
              .filter((child) => isVisible(child) && shouldDisplayUnderParent(item, child) && (!filteredTree.visibleIds || filteredTree.visibleIds.has(child.id)))
              .sort((a, b) => compareMetaTreeDisplay(a, b, filteredTree.visibleIds))
              .map((child) => <MetaTreeNode key={`${kind}-tree-${label}-${child.id}`} item={child} children={treeIndex.children} isVisible={isVisible} shouldDisplayUnderParent={shouldDisplayUnderParent} compareMetaTreeDisplay={compareMetaTreeDisplay} visibleIds={filteredTree.visibleIds} usageCounts={usageCounts} selected={selected} selectedDescendantIds={selectedDescendantIds} openNodeIds={openNodeIds} setOpenNodeIds={setOpenNodeIds} toggle={toggle} showSexual={showSexual} metaLanguage={metaLanguage} uiLanguage={uiLanguage} matchedIds={filteredTree.matchedIds} query={q} path={new Set([item.id])} />)
            : <MetaTreeNode key={`${kind}-tree-${label}-${item.id}`} item={item} children={treeIndex.children} isVisible={isVisible} shouldDisplayUnderParent={shouldDisplayUnderParent} compareMetaTreeDisplay={compareMetaTreeDisplay} visibleIds={filteredTree.visibleIds} usageCounts={usageCounts} selected={selected} selectedDescendantIds={selectedDescendantIds} openNodeIds={openNodeIds} setOpenNodeIds={setOpenNodeIds} toggle={toggle} showSexual={showSexual} metaLanguage={metaLanguage} uiLanguage={uiLanguage} matchedIds={filteredTree.matchedIds} query={q} path={new Set()} />)}
        </div>
      </details>)}
    </div>
    <button className="resizeHandle" type="button" onPointerDown={startResize}>{t.resizeListHeight}</button>
    <div className="resizeHelp">{t.resizeListHeightHelp}</div>
  </div>;
}

function MetaTreeNode({ item, children, isVisible, shouldDisplayUnderParent, compareMetaTreeDisplay, visibleIds, usageCounts, selected, selectedDescendantIds, openNodeIds, setOpenNodeIds, toggle, showSexual, metaLanguage, uiLanguage, matchedIds, query, path }: { item: Meta; children: Map<number, Meta[]>; isVisible: (item: Meta) => boolean; shouldDisplayUnderParent: (parent: Meta, child: Meta) => boolean; compareMetaTreeDisplay: (a: Meta, b: Meta, visibleIds: Set<number> | null) => number; visibleIds: Set<number> | null; usageCounts: Map<number, number>; selected: Set<number>; selectedDescendantIds: Set<number>; openNodeIds: Set<number>; setOpenNodeIds: React.Dispatch<React.SetStateAction<Set<number>>>; toggle: (id: number) => void; showSexual: boolean; metaLanguage: MetaLanguage; uiLanguage: UiLanguage; matchedIds: Set<number>; query: string; path: Set<number> }) {
  const childItems = (children.get(item.id) ?? [])
    .filter((child) => child.id !== item.id && isVisible(child) && shouldDisplayUnderParent(item, child) && (!visibleIds || visibleIds.has(child.id)) && !path.has(child.id))
    .sort((a, b) => compareMetaTreeDisplay(a, b, visibleIds));
  const highlighted = Boolean(query && matchedIds.has(item.id));
  const canSelect = item.searchable !== false || childItems.length > 0;
  const selectedCurrent = selected.has(item.id);
  const descendantSelected = selectedDescendantIds.has(item.id);
  const childCountText = childItems.length ? ` ${childItems.length}` : '';
  const chip = <button className={`chip ${selectedCurrent ? 'selectedMetaChip' : `${item.sexual ? 'sexual' : ''} ${item.tech ? 'technical' : ''} ${item.blocked ? 'blocked' : ''}`} ${descendantSelected ? 'descendantSelected' : ''} ${highlighted ? 'matched' : ''}`} title={metaTooltip(item, showSexual, metaLanguage, uiLanguage)} onClick={(event) => { event.preventDefault(); if (canSelect) toggle(item.id); }}>{selectedCurrent ? '★ ' : ''}{descendantSelected ? '◆ ' : ''}{metaName(item, showSexual, metaLanguage, uiLanguage)}{childCountText}</button>;
  const usage = <span className="metaUsageCount">{(usageCounts.get(item.id) ?? 0).toLocaleString()}</span>;
  if (!childItems.length) return <div className="metaTreeLeaf"><div className="metaTreeRow"><span className="metaTreeLeft"><span className="metaExpandPlaceholder" />{chip}</span>{usage}</div></div>;
  const nextPath = new Set(path);
  nextPath.add(item.id);
  const nodeOpen = Boolean(query) || openNodeIds.has(item.id);
  return <details className="metaTreeNode" open={nodeOpen} onToggle={(event) => {
    const open = event.currentTarget.open;
    setOpenNodeIds((current) => {
      if (open === current.has(item.id)) return current;
      const next = new Set(current);
      if (open) next.add(item.id);
      else next.delete(item.id);
      return next;
    });
  }}>
    <summary><div className="metaTreeRow"><span className="metaTreeLeft"><span className="metaExpandArrow">▸</span>{chip}</span>{usage}</div></summary>
    {nodeOpen ? <div className="metaTreeChildren">
      {childItems.map((child) => <MetaTreeNode key={`tree-child-${item.id}-${child.id}`} item={child} children={children} isVisible={isVisible} shouldDisplayUnderParent={shouldDisplayUnderParent} compareMetaTreeDisplay={compareMetaTreeDisplay} visibleIds={visibleIds} usageCounts={usageCounts} selected={selected} selectedDescendantIds={selectedDescendantIds} openNodeIds={openNodeIds} setOpenNodeIds={setOpenNodeIds} toggle={toggle} showSexual={showSexual} metaLanguage={metaLanguage} uiLanguage={uiLanguage} matchedIds={matchedIds} query={query} path={nextPath} />)}
    </div> : null}
  </details>;
}

function MixedTagCard({ result, tagMeta, traitMeta, vns, showSexual, showSpoiler, showBlockedTags, showTechnicalTags, metaLanguage, uiLanguage, t, vnDetail, characterDetail, minVotes, roleFilter }: { result: MixedTagResult; tagMeta: Map<number, Meta>; traitMeta: Map<number, Meta>; vns: Map<number, Vn>; showSexual: boolean; showSpoiler: boolean; showBlockedTags: boolean; showTechnicalTags: boolean; metaLanguage: MetaLanguage; uiLanguage: UiLanguage; t: Record<string, string>; vnDetail?: Detail; characterDetail?: Detail; minVotes?: number; roleFilter?: CharacterRoleFilter }) {
  return <article className="mixedCard">
    <div className="metrics"><span>{t.combinedSimilarity} {(result.similarity * 100).toFixed(1)}%</span><span>{t.priorityConfidence} {result.priorityMatched}/{result.priorityTotal}（{(Math.min(result.priorityConfidence, 1) * 100).toFixed(0)}%）</span></div>
    <div className="mixedColumns">
      <VnCard vn={result.vn} meta={tagMeta} showSexual={showSexual} showSpoiler={showSpoiler} showBlockedTags={showBlockedTags} showTechnicalTags={showTechnicalTags} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} detail={vnDetail} showMedia similarity={result.vn.similarity} overlap={result.vn.overlap} priorityMatched={result.vn.priorityMatched} priorityTotal={result.vn.priorityTotal} priorityConfidence={result.vn.priorityConfidence} />
      <CharacterCard character={result.character} vns={vns} meta={traitMeta} showSexual={showSexual} showSpoiler={showSpoiler} metaLanguage={metaLanguage} uiLanguage={uiLanguage} t={t} detail={characterDetail} showMedia similarity={result.character.similarity} overlap={result.character.overlap} priorityMatched={result.character.priorityMatched} priorityTotal={result.character.priorityTotal} priorityConfidence={result.character.priorityConfidence} minVotes={minVotes} roleFilter={roleFilter} />
    </div>
  </article>;
}

function MetaChip({ item, meta, kind, showSexual, metaLanguage, uiLanguage }: { item: Pair | TraitPair; meta: Map<number, Meta>; kind: 'tag' | 'trait'; showSexual: boolean; metaLanguage: MetaLanguage; uiLanguage: UiLanguage }) {
  const metaItem = meta.get(item[0]);
  if (!metaItem) return null;
  const name = metaName(metaItem, showSexual, metaLanguage, uiLanguage);
  const score = kind === 'tag' ? ` ${Number(item[1]).toFixed(1)}` : '';
  const spoilerValue = itemSpoiler(item, kind);
  return <a className={`chip ${metaItem.sexual ? 'sexual' : ''} ${metaItem.tech ? 'technical' : ''} ${metaItem.blocked ? 'blocked' : ''} ${spoilerClass(spoilerValue)}`} href={vndbUrl(kind === 'tag' ? 'g' : 'i', item[0])} target="_blank" rel="noreferrer" title={metaTooltip(metaItem, showSexual, metaLanguage, uiLanguage)}>{name}{score}</a>;
}

function ProducerLinks({ producers, t }: { producers: Producer[]; t: Record<string, string> }) {
  const unique = producers.filter((producer, index, list) => list.findIndex((item) => item.id === producer.id) === index);
  if (!unique.length) return null;
  return <div className="mini">{t.producers}：{unique.slice(0, 5).map((producer, index) => <React.Fragment key={`producer-${producer.id}-${index}`}>{index ? ' / ' : ''}<a href={vndbUrl('p', producer.id)} target="_blank" rel="noreferrer">{producer.name}</a></React.Fragment>)}</div>;
}

function VnRelationLabel({ relation, language }: { relation: VnRelationType; language: UiLanguage }) {
  const labels: Record<UiLanguage, Record<string, string>> = {
    zh: { seq: '续作', preq: '前作', set: '同设定', alt: '另一个版本', char: '共享角色', side: '外传', par: '本篇', ser: '同系列', fan: 'Fan disc', orig: '原作' },
    ja: { seq: '続編', preq: '前作', set: '同じ設定', alt: '別バージョン', char: '共通キャラクター', side: '外伝', par: '本編', ser: '同シリーズ', fan: 'Fan disc', orig: '原作' },
    en: { seq: 'Sequel', preq: 'Prequel', set: 'Same setting', alt: 'Alternative version', char: 'Shares characters', side: 'Side story', par: 'Parent story', ser: 'Same series', fan: 'Fan disc', orig: 'Original game' }
  };
  return labels[language][relation] ?? relation;
}

function VnRelations({ relations, vns, t, language }: { relations: VnRelation[]; vns: Map<number, Vn>; t: Record<string, string>; language: UiLanguage }) {
  const items = relations.map(([id, relation]) => ({ id, relation, vn: vns.get(id) })).filter((item) => item.vn).slice(0, 5);
  if (!items.length) return null;
  return <div className="mini relationList"><div>{t.relatedVns}：</div>{items.map(({ id, relation, vn }) => <div key={`related-vn-${id}-${relation}`}><VnRelationLabel relation={relation} language={language} />：<a href={vndbUrl('v', id)} target="_blank" rel="noreferrer">{vn?.title ?? `v${id}`}</a></div>)}</div>;
}

function priorityConfidenceText(priorityMatched: number | undefined, priorityTotal: number | undefined, priorityConfidence: number | undefined, decimals: number) {
  if (!priorityTotal) return null;
  const confidence = Math.min(priorityConfidence ?? ((priorityMatched ?? 0) / priorityTotal), 1) * 100;
  return `${priorityMatched ?? 0}/${priorityTotal}（${confidence.toFixed(decimals)}%）`;
}

function VnCard({ vn, meta, showSexual, showSpoiler, showBlockedTags = true, showTechnicalTags = true, metaLanguage, uiLanguage, t, vns, onAdd, onRemove, detail, showMedia = false, showDescription = true, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence, priorityConfidenceDecimals = 0, relations = [] }: { vn: Vn; meta: Map<number, Meta>; showSexual: boolean; showSpoiler: boolean; showBlockedTags?: boolean; showTechnicalTags?: boolean; metaLanguage: MetaLanguage; uiLanguage?: UiLanguage; t?: Record<string, string>; vns?: Map<number, Vn>; onAdd?: () => void; onRemove?: () => void; detail?: Detail; showMedia?: boolean; showDescription?: boolean; similarity?: number; overlap?: number; priorityMatched?: number; priorityTotal?: number; priorityConfidence?: number; priorityConfidenceDecimals?: number; relations?: VnRelation[] }) {
  const texts = t ?? UI_TEXT.zh;
  const language = uiLanguage ?? 'zh';
  const producers = detail?.developers?.length ? detail.developers : [...vn.developers, ...vn.publishers];
  const description = showDescription && detail?.description ? cleanDescription(detail.description) : '';
  const descriptionClassName = description.length < 320 ? 'cardDescriptionScroll shortDescription' : 'cardDescriptionScroll';
  const priorityConfidenceLabel = priorityConfidenceText(priorityMatched, priorityTotal, priorityConfidence, priorityConfidenceDecimals);
  return (
    <article className={`card ${showMedia ? '' : 'noMedia'}`}>
      {showMedia ? detail?.imageUrl ? <img src={detail.imageUrl} loading="lazy" /> : <div className="placeholder">VN</div> : null}
      <div className="cardBody">
        <div className="cardHead">
          <div><h3><a href={vndbUrl('v', vn.id)} target="_blank" rel="noreferrer">{vn.title}</a></h3>{vn.original && vn.original !== vn.title ? <p>{vn.original}</p> : null}</div>
          {onAdd ? <button onClick={onAdd}>{texts.addSample}</button> : null}
          {onRemove ? <button className="danger" onClick={onRemove}>{texts.remove}</button> : null}
        </div>
        <div className="metrics"><span>v{vn.id}</span><span>{texts.rating} {vn.rating.toFixed(1)}</span><span>{vn.votes} {texts.votes}</span>{detail?.loading ? <span>{texts.detailsLoading}</span> : null}{detail?.error ? <span>{texts.detailsFailed}</span> : null}{similarity !== undefined ? <span>{texts.similarity} {(similarity * 100).toFixed(1)}%</span> : null}{overlap !== undefined ? <span>{texts.overlap} {overlap}</span> : null}{priorityConfidenceLabel ? <span>{texts.priorityConfidence} {priorityConfidenceLabel}</span> : null}</div>
        <ProducerLinks producers={producers} t={texts} />
        {t && uiLanguage && vns ? <VnRelations relations={relations} vns={vns} t={t} language={uiLanguage} /> : null}
        {description ? <div className={descriptionClassName}>
          <p className="description">{description}</p>
        </div> : null}
        <div className="cardMetaScroll">
          <div className="chips cardChips">{visibleItems(vn.tags, meta, 'tag', showSexual, showSpoiler, showBlockedTags, showTechnicalTags).map((tag, index) => <MetaChip key={`vn-tag-${vn.id}-${tag[0]}-${index}`} item={tag} meta={meta} kind="tag" showSexual={showSexual} metaLanguage={metaLanguage} uiLanguage={language} />)}</div>
        </div>
      </div>
    </article>
  );
}

function CharacterCard({ character, vns, meta, showSexual, showSpoiler, metaLanguage, uiLanguage = 'zh', t, preferAverage = false, onAdd, onRemove, detail, showMedia = false, showDescription = true, similarity, overlap, priorityMatched, priorityTotal, priorityConfidence, priorityConfidenceDecimals = 0, minVotes, roleFilter }: { character: Character; vns: Map<number, Vn>; meta: Map<number, Meta>; showSexual: boolean; showSpoiler: boolean; metaLanguage: MetaLanguage; uiLanguage?: UiLanguage; t: Record<string, string>; preferAverage?: boolean; onAdd?: () => void; onRemove?: () => void; detail?: Detail; showMedia?: boolean; showDescription?: boolean; similarity?: number; overlap?: number; priorityMatched?: number; priorityTotal?: number; priorityConfidence?: number; priorityConfidenceDecimals?: number; minVotes?: number; roleFilter?: CharacterRoleFilter }) {
  const displayedVns = character.vns.filter(([id, role]) => (minVotes === undefined || (vns.get(id)?.votes ?? 0) >= minVotes) && (!roleFilter || roleAllowed(role, roleFilter)));
  const displayedScores = displayedVns.map(([id]) => vns.get(id)?.average ?? 0).filter((score) => score > 0);
  const averageScore = displayedScores.length ? displayedScores.reduce((sum, score) => sum + score, 0) / displayedScores.length : characterAverageScore(character, vns);
  const description = showDescription && detail?.description ? cleanDescription(detail.description) : '';
  const descriptionClassName = description.length < 320 ? 'cardDescriptionScroll shortDescription' : 'cardDescriptionScroll';
  const priorityConfidenceLabel = priorityConfidenceText(priorityMatched, priorityTotal, priorityConfidence, priorityConfidenceDecimals);
  return (
    <article className={`card ${showMedia ? '' : 'noMedia'}`}>
      {showMedia ? detail?.imageUrl ? <img src={detail.imageUrl} loading="lazy" /> : <div className="placeholder">CH</div> : null}
      <div className="cardBody">
        <div className="cardHead">
          <div><h3><a href={vndbUrl('c', character.id)} target="_blank" rel="noreferrer">{character.name}</a></h3>{character.original && character.original !== character.name ? <p>{character.original}</p> : null}</div>
          {onAdd ? <button onClick={onAdd}>{t.addSample}</button> : null}
          {onRemove ? <button className="danger" onClick={onRemove}>{t.remove}</button> : null}
        </div>
        <div className="metrics"><span>c{character.id}</span><span>{t.associationScore} {character.score.toFixed(1)}</span>{averageScore ? <span>{t.vnAverage} {averageScore.toFixed(1)}</span> : null}{preferAverage ? <span>{t.averageWeighted}</span> : null}{detail?.loading ? <span>{t.detailsLoading}</span> : null}{detail?.error ? <span>{t.detailsFailed}</span> : null}{similarity !== undefined ? <span>{t.similarity} {(similarity * 100).toFixed(1)}%</span> : null}{overlap !== undefined ? <span>{t.overlap} {overlap}</span> : null}{priorityConfidenceLabel ? <span>{t.priorityConfidence} {priorityConfidenceLabel}</span> : null}</div>
        <div className="mini characterAppearances"><div>{t.characterAppearances}：</div>{displayedVns.slice(0, 4).map(([id, role], index) => <div key={`character-vn-${character.id}-${id}-${index}`}><a href={vndbUrl('v', id)} target="_blank" rel="noreferrer">{vns.get(id)?.title ?? `v${id}`}</a>（{characterRoleText(role, t)}）</div>)}</div>
        {description ? <div className={descriptionClassName}>
          <p className="description">{description}</p>
        </div> : null}
        <div className="cardMetaScroll">
          <div className="traitGroupList cardTraitGroups">{traitGroups(character.traits, meta, showSexual, showSpoiler, metaLanguage, uiLanguage).map(([label, items]) => <div className="traitGroup" key={`character-group-${character.id}-${label}`}>
            <div className="traitGroupLabel">{label}</div>
            <div className="chips">{items.map((trait, index) => <MetaChip key={`character-trait-${character.id}-${trait[0]}-${index}`} item={trait} meta={meta} kind="trait" showSexual={showSexual} metaLanguage={metaLanguage} uiLanguage={uiLanguage} />)}</div>
          </div>)}</div>
        </div>
      </div>
    </article>
  );
}

const container = document.getElementById('root')!;
const globalWithRoot = globalThis as typeof globalThis & { __vndbPrototypeRoot?: Root };
const root = globalWithRoot.__vndbPrototypeRoot ?? createRoot(container);
globalWithRoot.__vndbPrototypeRoot = root;
const renderGlobalError = (reason: unknown) => {
  const error: LoadError = { message: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined, stage: 'errorRuntime', progress: 100, detail: null };
  root.render(<LoadingErrorView error={error} />);
};
window.addEventListener('error', (event) => renderGlobalError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => renderGlobalError(event.reason));
root.render(<AppErrorBoundary><App /></AppErrorBoundary>);
