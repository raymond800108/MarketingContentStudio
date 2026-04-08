export type Locale = "en" | "zh-TW" | "de";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  "zh-TW": "繁中",
  de: "DE",
};

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "zh-TW": "繁體中文",
  de: "Deutsch",
};

const translations = {
  // ── Nav ──
  "nav.studio": { en: "Studio", "zh-TW": "工作室", de: "Studio" },
  "nav.social": { en: "Social", "zh-TW": "社群", de: "Sozial" },
  "nav.dashboard": { en: "Dashboard", "zh-TW": "儀表板", de: "Dashboard" },
  "nav.noProfile": { en: "No profile", "zh-TW": "未選擇", de: "Kein Profil" },
  "nav.changeCategory": { en: "Change category...", "zh-TW": "更換類別...", de: "Kategorie wechseln..." },

  // ── Onboarding ──
  "onboarding.brandPlaceholder": { en: "Your brand name", "zh-TW": "您的品牌名稱", de: "Ihr Markenname" },
  "onboarding.brandHint": { en: "Optional — you can set this later", "zh-TW": "選填 — 可稍後設定", de: "Optional — kann sp\u00e4ter gesetzt werden" },
  "onboarding.title": { en: "What do you create?", "zh-TW": "您創作什麼產品？", de: "Was erstellen Sie?" },
  "onboarding.subtitle": { en: "Pick your product category to get a tailored AI content studio", "zh-TW": "選擇產品類別以獲取專屬 AI 內容工作室", de: "W\u00e4hlen Sie Ihre Produktkategorie f\u00fcr ein ma\u00dfgeschneidertes AI-Inhaltsstudio" },
  "onboarding.dropPhoto": { en: "Or drop a product photo", "zh-TW": "或拖放產品照片", de: "Oder legen Sie ein Produktfoto ab" },
  "onboarding.autoDetect": { en: "We'll auto-detect your category", "zh-TW": "我們將自動偵測您的類別", de: "Wir erkennen Ihre Kategorie automatisch" },
  "onboarding.comingSoon": { en: "Coming soon", "zh-TW": "即將推出", de: "Demnächst" },

  // ── Studio ──
  "studio.staticImage": { en: "Static Image", "zh-TW": "靜態圖片", de: "Standbild" },
  "studio.video": { en: "Video", "zh-TW": "影片", de: "Video" },
  "studio.sourceImages": { en: "Source Images", "zh-TW": "來源圖片", de: "Quellbilder" },
  "studio.dropImages": { en: "Drop your product images here", "zh-TW": "將產品圖片拖放至此", de: "Produktbilder hier ablegen" },
  "studio.fileTypes": { en: "PNG, JPG, or WebP", "zh-TW": "PNG、JPG 或 WebP", de: "PNG, JPG oder WebP" },
  "studio.browseFiles": { en: "Browse Files", "zh-TW": "瀏覽檔案", de: "Dateien durchsuchen" },
  "studio.add": { en: "Add", "zh-TW": "新增", de: "Hinzuf\u00fcgen" },
  "studio.aspectRatio": { en: "Aspect ratio", "zh-TW": "長寬比", de: "Seitenverh\u00e4ltnis" },
  "studio.videoModel": { en: "Video model", "zh-TW": "影片模型", de: "Videomodell" },
  "studio.generate": { en: "Generate", "zh-TW": "生成", de: "Generieren" },
  "studio.templates": { en: "Templates", "zh-TW": "模板", de: "Vorlagen" },
  "studio.generatedResults": { en: "Generated Results", "zh-TW": "生成結果", de: "Ergebnisse" },
  "studio.generating": { en: "Generating your content...", "zh-TW": "正在生成內容...", de: "Inhalt wird generiert..." },
  "studio.generatingTime": { en: "This usually takes 30-60 seconds", "zh-TW": "通常需要 30-60 秒", de: "Dies dauert normalerweise 30-60 Sekunden" },
  "studio.emptyResults": { en: "Generated content will appear here", "zh-TW": "生成的內容將顯示在這裡", de: "Generierter Inhalt erscheint hier" },
  "studio.emptyHint": { en: "Pick a template and generate", "zh-TW": "選擇模板並生成", de: "Vorlage w\u00e4hlen und generieren" },
  "studio.downloadVideo": { en: "Download Video", "zh-TW": "下載影片", de: "Video herunterladen" },
  "studio.square": { en: "Square", "zh-TW": "正方形", de: "Quadrat" },
  "studio.landscape": { en: "Landscape", "zh-TW": "橫向", de: "Querformat" },
  "studio.portrait": { en: "Portrait", "zh-TW": "直向", de: "Hochformat" },
  "studio.wide": { en: "Wide", "zh-TW": "寬屏", de: "Breitbild" },
  "studio.tall": { en: "Tall", "zh-TW": "長屏", de: "Hochformat" },

  // ── Dashboard ──
  "dashboard.title": { en: "Dashboard", "zh-TW": "儀表板", de: "Dashboard" },
  "dashboard.brandSettings": { en: "Brand Settings", "zh-TW": "品牌設定", de: "Markeneinstellungen" },
  "dashboard.brandName": { en: "Brand Name", "zh-TW": "品牌名稱", de: "Markenname" },
  "dashboard.save": { en: "Save", "zh-TW": "儲存", de: "Speichern" },
  "dashboard.activeProfile": { en: "Active Profile", "zh-TW": "使用中的設定檔", de: "Aktives Profil" },
  "dashboard.noProfile": { en: "No profile selected", "zh-TW": "未選擇設定檔", de: "Kein Profil ausgew\u00e4hlt" },
  "dashboard.history": { en: "Generation History", "zh-TW": "生成歷史", de: "Generierungsverlauf" },
  "dashboard.clear": { en: "Clear", "zh-TW": "清除", de: "L\u00f6schen" },
  "dashboard.emptyHistory": { en: "Your generation history will appear here", "zh-TW": "您的生成歷史將顯示在這裡", de: "Ihr Generierungsverlauf erscheint hier" },
  "dashboard.emptyHistoryHint": { en: "Generate content in the Studio to see it here", "zh-TW": "在工作室中生成內容即可在此查看", de: "Erstellen Sie Inhalte im Studio, um sie hier zu sehen" },

  // ── Social ──
  "social.title": { en: "Social Media", "zh-TW": "社群媒體", de: "Soziale Medien" },
  "social.blotatoConnected": { en: "Blotato Connected", "zh-TW": "Blotato 已連接", de: "Blotato verbunden" },
  "social.apiKeyPlaceholder": { en: "Blotato API key", "zh-TW": "Blotato API 金鑰", de: "Blotato API-Schl\u00fcssel" },
  "social.getKey": { en: "Get key", "zh-TW": "取得金鑰", de: "Schl\u00fcssel holen" },
  "social.contentHistory": { en: "Content History", "zh-TW": "內容歷史", de: "Inhaltsverlauf" },
  "social.emptyContent": { en: "Generate content in Studio to see it here", "zh-TW": "在工作室中生成內容即可在此查看", de: "Erstellen Sie Inhalte im Studio" },
  "social.dragHint": { en: "Drag content onto the calendar", "zh-TW": "將內容拖放到日曆上", de: "Inhalte auf den Kalender ziehen" },
  "social.exportPreset": { en: "Export Preset", "zh-TW": "匯出預設", de: "Exportvorlage" },
  "social.presetHint": { en: "Select a preset, then drag content onto calendar", "zh-TW": "選擇預設，然後將內容拖放到日曆上", de: "Vorlage w\u00e4hlen, dann Inhalt auf den Kalender ziehen" },
  "social.accounts": { en: "Accounts", "zh-TW": "帳號", de: "Konten" },
  "social.today": { en: "Today", "zh-TW": "今天", de: "Heute" },
  "social.noCaption": { en: "No caption", "zh-TW": "無標題", de: "Keine Beschriftung" },
  "social.editPost": { en: "Edit Post", "zh-TW": "編輯貼文", de: "Beitrag bearbeiten" },
  "social.postTime": { en: "Post Time", "zh-TW": "發布時間", de: "Uhrzeit" },
  "social.timezone": { en: "Timezone", "zh-TW": "時區", de: "Zeitzone" },
  "social.caption": { en: "Caption", "zh-TW": "標題文字", de: "Beschriftung" },
  "social.aiCaption": { en: "AI Caption", "zh-TW": "AI 文案", de: "KI-Text" },
  "social.generating": { en: "Generating...", "zh-TW": "生成中...", de: "Generierung..." },
  "social.captionPlaceholder": { en: "Write your post caption or click AI Caption...", "zh-TW": "輸入貼文標題或點擊 AI 文案...", de: "Beschriftung eingeben oder KI-Text klicken..." },
  "social.publishTo": { en: "Publish to account", "zh-TW": "發布至帳號", de: "Ver\u00f6ffentlichen an Konto" },
  "social.selectAccount": { en: "Select account...", "zh-TW": "選擇帳號...", de: "Konto ausw\u00e4hlen..." },
  "social.save": { en: "Save", "zh-TW": "儲存", de: "Speichern" },
  "social.publishBlotato": { en: "Publish via Blotato", "zh-TW": "透過 Blotato 發布", de: "\u00dcber Blotato ver\u00f6ffentlichen" },
  "social.cancel": { en: "Cancel", "zh-TW": "取消", de: "Abbrechen" },
  "social.selectCategory": { en: "Select a product category first", "zh-TW": "請先選擇產品類別", de: "Bitte w\u00e4hlen Sie zuerst eine Produktkategorie" },
  "social.draft": { en: "draft", "zh-TW": "草稿", de: "Entwurf" },
  "social.scheduled": { en: "scheduled", "zh-TW": "已排程", de: "Geplant" },
  "social.published": { en: "published", "zh-TW": "已發布", de: "Ver\u00f6ffentlicht" },

  // ── Dashboard API Usage ──
  "dashboard.apiUsage": { en: "API Usage", "zh-TW": "API 用量", de: "API-Nutzung" },
  "dashboard.totalCalls": { en: "Total Calls", "zh-TW": "總呼叫次數", de: "Aufrufe gesamt" },
  "dashboard.successRate": { en: "Success Rate", "zh-TW": "成功率", de: "Erfolgsrate" },
  "dashboard.avgResponse": { en: "Avg Response", "zh-TW": "平均回應", de: "Durchschn. Antwort" },
  "dashboard.errors": { en: "Errors", "zh-TW": "錯誤", de: "Fehler" },
  "dashboard.byService": { en: "By Service", "zh-TW": "依服務", de: "Nach Dienst" },
  "dashboard.byAction": { en: "By Action", "zh-TW": "依操作", de: "Nach Aktion" },
  "dashboard.recentCalls": { en: "Recent API Calls", "zh-TW": "最近 API 呼叫", de: "Letzte API-Aufrufe" },
  "dashboard.noApiCalls": { en: "No API calls recorded yet", "zh-TW": "尚無 API 呼叫記錄", de: "Noch keine API-Aufrufe aufgezeichnet" },
  "dashboard.noApiHint": { en: "Generate content or publish posts to see usage data", "zh-TW": "生成內容或發布貼文以查看用量資料", de: "Erstellen Sie Inhalte oder ver\u00f6ffentlichen Sie Beitr\u00e4ge" },
  "dashboard.calls": { en: "calls", "zh-TW": "次", de: "Aufrufe" },
  "dashboard.success": { en: "success", "zh-TW": "成功", de: "Erfolg" },
  "dashboard.error": { en: "error", "zh-TW": "錯誤", de: "Fehler" },
  "dashboard.clearUsage": { en: "Clear", "zh-TW": "清除", de: "L\u00f6schen" },
  "dashboard.imageGen": { en: "Image Generation", "zh-TW": "圖片生成", de: "Bildgenerierung" },
  "dashboard.videoGen": { en: "Video Generation", "zh-TW": "影片生成", de: "Videogenerierung" },
  "dashboard.productAnalysis": { en: "Product Analysis", "zh-TW": "產品分析", de: "Produktanalyse" },
  "dashboard.captionGen": { en: "Caption Generation", "zh-TW": "文案生成", de: "Textgenerierung" },
  "dashboard.fileUpload": { en: "File Upload", "zh-TW": "檔案上傳", de: "Datei-Upload" },
  "dashboard.publish": { en: "Publish Post", "zh-TW": "發布貼文", de: "Beitrag ver\u00f6ffentlichen" },
  "dashboard.mediaUpload": { en: "Media Upload", "zh-TW": "媒體上傳", de: "Medien-Upload" },
  "dashboard.fetchAccounts": { en: "Fetch Accounts", "zh-TW": "取得帳號", de: "Konten abrufen" },
  "dashboard.schedules": { en: "Schedules", "zh-TW": "排程", de: "Zeitpläne" },

  // ── Profile Names & Descriptions ──
  "profile.clothing": { en: "Clothing & Fashion", "zh-TW": "服飾與時尚", de: "Kleidung & Mode" },
  "profile.clothing.desc": { en: "Dresses, tops, outerwear, pants, accessories", "zh-TW": "洋裝、上衣、外套、褲子、配件", de: "Kleider, Oberteile, Jacken, Hosen, Accessoires" },
  "profile.jewelry": { en: "Jewelry & Accessories", "zh-TW": "珠寶與配飾", de: "Schmuck & Accessoires" },
  "profile.jewelry.desc": { en: "Rings, necklaces, earrings, bracelets, watches — fine and fashion jewelry", "zh-TW": "戒指、項鍊、耳環、手鍊、手錶 — 精品與時尚珠寶", de: "Ringe, Halsketten, Ohrringe, Armbänder, Uhren — edler und modischer Schmuck" },
  "profile.furniture": { en: "Furniture & Home", "zh-TW": "家具與家居", de: "Möbel & Wohnen" },
  "profile.furniture.desc": { en: "Sofas, tables, chairs, shelving, lighting — furniture and home decor", "zh-TW": "沙發、桌子、椅子、層架、燈具 — 家具與家居裝飾", de: "Sofas, Tische, Stühle, Regale, Beleuchtung — Möbel und Wohndeko" },

  // ── Clothing Templates ──
  "tpl.flat-lay.name": { en: "Flat Lay", "zh-TW": "平鋪拍攝", de: "Flachbild" },
  "tpl.flat-lay.desc": { en: "Overhead flat lay on clean surface with styled arrangement", "zh-TW": "俯拍平鋪於乾淨表面，搭配造型擺設", de: "Draufsicht auf sauberer Fläche mit stilvoller Anordnung" },
  "tpl.on-hanger.name": { en: "On Hanger Studio", "zh-TW": "衣架攝影棚", de: "Bügel-Studio" },
  "tpl.on-hanger.desc": { en: "Displayed on premium hanger showing full silhouette", "zh-TW": "展示於高級衣架上，呈現完整輪廓", de: "Auf Premium-Bügel mit voller Silhouette" },
  "tpl.ghost-mannequin.name": { en: "Ghost Mannequin", "zh-TW": "隱形人台", de: "Geist-Mannequin" },
  "tpl.ghost-mannequin.desc": { en: "Invisible mannequin showing 3D shape without a model", "zh-TW": "隱形人台呈現立體造型，無需模特兒", de: "Unsichtbare Büste zeigt 3D-Form ohne Model" },
  "tpl.street-style.name": { en: "Street Style", "zh-TW": "街拍風格", de: "Street Style" },
  "tpl.street-style.desc": { en: "Urban editorial with model in city setting, candid style", "zh-TW": "都市街拍風格，模特兒於城市場景中自然拍攝", de: "Urban-Editorial mit Model in Stadtkulisse, natürlicher Stil" },
  "tpl.editorial-model.name": { en: "Editorial Model", "zh-TW": "時尚大片", de: "Editorial-Model" },
  "tpl.editorial-model.desc": { en: "High-fashion editorial with professional model", "zh-TW": "高端時尚大片搭配專業模特兒", de: "High-Fashion-Editorial mit professionellem Model" },
  "tpl.consistent-model.name": { en: "Consistent Model", "zh-TW": "固定模特兒", de: "Einheitliches Model" },
  "tpl.consistent-model.desc": { en: "Same model across all looks — upload character reference", "zh-TW": "所有造型使用同一模特兒 — 上傳角色參考", de: "Gleiches Model für alle Looks — Referenz hochladen" },
  "tpl.detail-texture.name": { en: "Detail & Texture", "zh-TW": "細節與質感", de: "Detail & Textur" },
  "tpl.detail-texture.desc": { en: "Macro close-up on fabric texture, stitching and details", "zh-TW": "微距拍攝布料質感、縫線與細節", de: "Makroaufnahme von Stoffstruktur, Nähten und Details" },
  "tpl.lifestyle-casual.name": { en: "Lifestyle Casual", "zh-TW": "休閒生活", de: "Lifestyle Casual" },
  "tpl.lifestyle-casual.desc": { en: "Relaxed lifestyle setting with warm, authentic atmosphere", "zh-TW": "輕鬆生活場景，溫暖真實的氛圍", de: "Entspanntes Lifestyle-Setting mit warmer, authentischer Atmosphäre" },
  "tpl.lookbook-studio.name": { en: "Lookbook Studio", "zh-TW": "型錄攝影棚", de: "Lookbook-Studio" },
  "tpl.lookbook-studio.desc": { en: "Clean studio lookbook shot showing full garment on model", "zh-TW": "乾淨攝影棚型錄照，展示模特兒完整穿搭", de: "Saubere Studio-Lookbook-Aufnahme mit vollem Outfit" },
  "tpl.seasonal-outdoor.name": { en: "Seasonal Outdoor", "zh-TW": "季節戶外", de: "Saisonales Outdoor" },
  "tpl.seasonal-outdoor.desc": { en: "Seasonal outdoor setting with golden hour lighting", "zh-TW": "季節性戶外場景搭配黃金時刻光線", de: "Saisonale Außenaufnahme mit goldenem Stundenlicht" },
  "tpl.mix-match.name": { en: "Mix & Match", "zh-TW": "混搭穿搭", de: "Mix & Match" },
  "tpl.mix-match.desc": { en: "Styled outfit pairing showing how to wear the piece", "zh-TW": "穿搭造型組合，展示搭配方式", de: "Gestylte Outfit-Kombination mit Tragetipps" },
  "tpl.ugc-model.name": { en: "UGC Style", "zh-TW": "UGC 風格", de: "UGC-Stil" },
  "tpl.ugc-model.desc": { en: "Authentic UGC-style for social media campaigns", "zh-TW": "真實 UGC 風格，適合社群媒體行銷", de: "Authentischer UGC-Stil für Social-Media-Kampagnen" },

  // ── Jewelry Templates ──
  "tpl.clean-neutral.name": { en: "Clean & Neutral", "zh-TW": "乾淨中性", de: "Clean & Neutral" },
  "tpl.clean-neutral.desc": { en: "Pure white or soft neutral seamless background with balanced studio lighting", "zh-TW": "純白或柔和中性無縫背景，均衡攝影棚燈光", de: "Reinweißer oder neutral-weicher Hintergrund mit ausgewogener Studiobeleuchtung" },
  "tpl.elemental-artistic.name": { en: "Elemental & Artistic", "zh-TW": "元素藝術", de: "Elementar & Künstlerisch" },
  "tpl.elemental-artistic.desc": { en: "Water droplets, smoke wisps or prism light refractions around the piece", "zh-TW": "水珠、煙霧或稜鏡光線折射環繞飾品", de: "Wassertropfen, Rauchschwaden oder Prisma-Lichtbrechungen" },
  "tpl.detail-closeup.name": { en: "Detail Close-Up", "zh-TW": "細節特寫", de: "Detail-Nahaufnahme" },
  "tpl.detail-closeup.desc": { en: "Extreme macro focus on engravings, metal joins and gemstone settings", "zh-TW": "超微距聚焦雕刻、金屬接合與寶石鑲嵌", de: "Extrem-Makro auf Gravuren, Metallverbindungen und Edelsteinfassungen" },
  "tpl.packaging-box.name": { en: "Packaging Box", "zh-TW": "包裝盒", de: "Verpackungsbox" },
  "tpl.packaging-box.desc": { en: "Inside an open luxury jewellery box with plush cushion interior", "zh-TW": "置於打開的奢華珠寶盒中，絨面襯墊內裝", de: "In offener Luxus-Schmuckbox mit Plüschpolster" },
  "tpl.natural-branches.name": { en: "Natural Branches", "zh-TW": "自然枝幹", de: "Natürliche Zweige" },
  "tpl.natural-branches.desc": { en: "Draped over sculptural tree branch with organic curves and bark texture", "zh-TW": "懸掛於雕塑感樹枝上，自然曲線與樹皮紋理", de: "Über skulpturalem Ast mit organischen Kurven und Rindenstruktur" },
  "tpl.vintage-heritage.name": { en: "Vintage Heritage", "zh-TW": "復古傳承", de: "Vintage Heritage" },
  "tpl.vintage-heritage.desc": { en: "Classic heritage setting with aged linen, warm tones and old-world elegance", "zh-TW": "經典傳承場景，陳舊亞麻、暖色調與舊世界優雅", de: "Klassisches Heritage-Setting mit gealtertem Leinen und warmen Tönen" },
  "tpl.moss-rock.name": { en: "Moss & Rock", "zh-TW": "苔蘚岩石", de: "Moos & Stein" },
  "tpl.moss-rock.desc": { en: "Nestled on moss-covered rock with soft cream background, editorial top view", "zh-TW": "置於苔蘚覆蓋的岩石上，奶油色背景，俯視拍攝", de: "Auf moosbedecktem Stein mit weichem Cremehintergrund" },
  "tpl.glass-display.name": { en: "Glass Display Box", "zh-TW": "玻璃展示盒", de: "Glas-Vitrine" },
  "tpl.glass-display.desc": { en: "Museum-grade glass showcase on polished marble base with soft highlights", "zh-TW": "博物館級玻璃展示櫃，拋光大理石底座，柔和高光", de: "Museale Glasvitrine auf poliertem Marmorsockel" },
  "tpl.natural-surface.name": { en: "Natural Surface", "zh-TW": "天然表面", de: "Natürliche Oberfläche" },
  "tpl.natural-surface.desc": { en: "Raw stone, marble, sand or wood surface with organic texture contrast", "zh-TW": "原石、大理石、沙或木質表面，有機紋理對比", de: "Rohstein, Marmor, Sand oder Holz mit organischem Texturkontrast" },
  "tpl.dark-dramatic.name": { en: "Dark & Dramatic", "zh-TW": "暗黑戲劇", de: "Dunkel & Dramatisch" },
  "tpl.dark-dramatic.desc": { en: "Deep black backdrop with bold directional key light and crisp highlights", "zh-TW": "深黑背景搭配大膽方向性主光與銳利高光", de: "Tiefschwarzer Hintergrund mit kräftigem Führungslicht" },
  "tpl.creative-floating.name": { en: "Creative Floating", "zh-TW": "創意懸浮", de: "Kreatives Schweben" },
  "tpl.creative-floating.desc": { en: "Levitating mid-air with soft shadow beneath, weightless artistic composition", "zh-TW": "半空中懸浮，下方柔和陰影，失重藝術構圖", de: "Schwebend in der Luft mit weichem Schatten, schwerelos" },
  "tpl.high-end-model.name": { en: "High-End Model", "zh-TW": "高端模特兒", de: "High-End-Model" },
  "tpl.high-end-model.desc": { en: "Luxury brand campaign — stylish model wearing your jewelry in editorial style", "zh-TW": "奢侈品牌形象 — 時尚模特兒佩戴珠寶的時尚大片", de: "Luxusmarken-Kampagne — stylisches Model trägt Ihren Schmuck" },
  "tpl.clean-white-studio.name": { en: "Clean White Studio", "zh-TW": "純白攝影棚", de: "Reines Weiß-Studio" },
  "tpl.clean-white-studio.desc": { en: "Transforms any messy photo into a clean white background product shot", "zh-TW": "將任何雜亂照片轉換為乾淨白背景產品照", de: "Verwandelt jedes Foto in ein sauberes Produktbild mit weißem Hintergrund" },

  // ── Furniture Templates ──
  "tpl.white-studio.name": { en: "White Studio", "zh-TW": "白色攝影棚", de: "Weißes Studio" },
  "tpl.white-studio.desc": { en: "Clean white studio backdrop for e-commerce catalog", "zh-TW": "乾淨白色攝影棚背景，適合電商目錄", de: "Sauberer weißer Studio-Hintergrund für E-Commerce" },
  "tpl.room-modern.name": { en: "Modern Room Scene", "zh-TW": "現代居室場景", de: "Modernes Zimmer" },
  "tpl.room-modern.desc": { en: "Contemporary modern living space with curated styling", "zh-TW": "當代現代居住空間，精心策劃的造型", de: "Zeitgenössischer moderner Wohnraum mit kuratiertem Styling" },
  "tpl.room-cozy.name": { en: "Cozy Room Scene", "zh-TW": "溫馨居室場景", de: "Gemütliches Zimmer" },
  "tpl.room-cozy.desc": { en: "Warm, inviting room with soft textiles and warm lighting", "zh-TW": "溫暖舒適的房間，柔軟織物與溫暖燈光", de: "Warmer, einladender Raum mit weichen Textilien" },
  "tpl.detail-material.name": { en: "Material Detail", "zh-TW": "材質細節", de: "Materialdetail" },
  "tpl.detail-material.desc": { en: "Macro close-up on wood grain, fabric, joinery details", "zh-TW": "微距特寫木紋、布料、接合細節", de: "Makroaufnahme von Holzmaserung, Stoff und Verbindungen" },
  "tpl.lifestyle-overhead.name": { en: "Lifestyle Overhead", "zh-TW": "生活俯拍", de: "Lifestyle-Draufsicht" },
  "tpl.lifestyle-overhead.desc": { en: "Top-down overhead view showing the piece in daily life", "zh-TW": "俯拍視角展示家具在日常生活中的樣貌", de: "Draufsicht auf das Möbelstück im Alltag" },
  "tpl.scale-human.name": { en: "Scale with Person", "zh-TW": "人物比例", de: "Maßstab mit Person" },
  "tpl.scale-human.desc": { en: "Person interacting with furniture to show real-world scale", "zh-TW": "人物與家具互動，展示真實比例", de: "Person interagiert mit Möbel zur Größenveranschaulichung" },
  "tpl.catalog-angle.name": { en: "Catalog 3/4 Angle", "zh-TW": "目錄 3/4 角度", de: "Katalog 3/4-Winkel" },
  "tpl.catalog-angle.desc": { en: "Classic three-quarter angle showing depth and form", "zh-TW": "經典四分之三角度展示深度與造型", de: "Klassischer Dreiviertelwinkel mit Tiefe und Form" },
  "tpl.seasonal-styled.name": { en: "Seasonal Styling", "zh-TW": "季節佈置", de: "Saisonales Styling" },
  "tpl.seasonal-styled.desc": { en: "Room styled with seasonal decor and atmosphere", "zh-TW": "房間搭配季節性裝飾與氛圍", de: "Raum mit saisonaler Dekoration und Atmosphäre" },
  "tpl.outdoor-patio.name": { en: "Outdoor / Patio", "zh-TW": "戶外 / 露台", de: "Außenbereich / Terrasse" },
  "tpl.outdoor-patio.desc": { en: "Outdoor patio or garden setting with natural light", "zh-TW": "戶外露台或花園場景，自然光線", de: "Außenterrasse oder Gartenszene mit natürlichem Licht" },
  "tpl.window-light.name": { en: "Window Light", "zh-TW": "窗光", de: "Fensterlicht" },
  "tpl.window-light.desc": { en: "Natural window light with soft shadows and warm atmosphere", "zh-TW": "自然窗光搭配柔和陰影與溫暖氛圍", de: "Natürliches Fensterlicht mit weichen Schatten" },
  "tpl.dark-moody.name": { en: "Dark & Moody", "zh-TW": "暗色氛圍", de: "Dunkel & Stimmungsvoll" },
  "tpl.dark-moody.desc": { en: "Dark dramatic setting with accent lighting", "zh-TW": "暗色戲劇性場景搭配重點照明", de: "Dunkles dramatisches Setting mit Akzentbeleuchtung" },
  "tpl.minimalist-space.name": { en: "Minimalist Space", "zh-TW": "極簡空間", de: "Minimalistischer Raum" },
  "tpl.minimalist-space.desc": { en: "Ultra-minimal space emphasizing pure form and design", "zh-TW": "極簡空間強調純粹造型與設計", de: "Ultra-minimaler Raum mit Betonung auf reine Form" },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, locale: Locale): string {
  const entry = translations[key];
  return entry[locale] || entry.en;
}

/** Lookup a translation key that may or may not exist; returns fallback if missing */
export function tMaybe(key: string, locale: Locale, fallback: string): string {
  const entry = (translations as Record<string, Record<string, string>>)[key];
  if (!entry) return fallback;
  return entry[locale] || entry.en || fallback;
}

export default translations;
